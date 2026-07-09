import { supabase } from './supabase'

// Shared data layer for the feedback chat thread — used by BOTH the client sheet
// (FeedbackButton) and the admin console (FeedbackAdmin). The app's only realtime channel
// lives here, so there's one subscribe/teardown contract.

export type FeedbackAuthor = 'client' | 'admin' | 'bot' | 'system'

export type FeedbackMsg = {
  id: string
  feedback_id: string
  author: FeedbackAuthor
  author_email: string | null
  body: string
  created_at: string
}

const SELECT = 'id, feedback_id, author, author_email, body, created_at'

// Load a feedback item's whole thread, oldest-first (chat order). RLS scopes it: a family
// member only reads threads on their own items; the admin reads any.
export async function loadThread(feedbackId: string): Promise<FeedbackMsg[]> {
  const { data, error } = await supabase
    .from('feedback_messages')
    .select(SELECT)
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as FeedbackMsg[]
}

// Insert a chat message (author 'client' or 'admin' — bot/system are service-role only).
// author_id is MANDATORY: the RLS WITH CHECK pins it to auth.uid(), so omitting it rejects
// the insert. After a successful write, best-effort ping the counterparty-push fn.
export async function sendMessage(opts: {
  feedbackId: string
  author: 'client' | 'admin'
  body: string
  userId: string
  userEmail: string | null
}): Promise<FeedbackMsg> {
  const { data, error } = await supabase
    .from('feedback_messages')
    .insert({
      feedback_id: opts.feedbackId,
      author: opts.author,
      author_id: opts.userId,
      author_email: opts.userEmail,
      body: opts.body,
    })
    .select(SELECT)
    .single()
  if (error) throw error
  const msg = data as FeedbackMsg
  supabase.functions.invoke('notify-feedback-reply', { body: { message_id: msg.id } }).catch(() => {})
  return msg
}

// Live thread: fire onInsert for every new message on this item. RLS applies to realtime,
// so a client only streams their own item's messages and the admin streams all. Returns an
// unsubscribe fn — always call it on teardown.
export function subscribeThread(feedbackId: string, onInsert: (m: FeedbackMsg) => void): () => void {
  const ch = supabase
    .channel(`fb-msg-${feedbackId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'feedback_messages', filter: `feedback_id=eq.${feedbackId}` },
      (payload) => onInsert(payload.new as FeedbackMsg),
    )
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}

// Chat timestamp. A full timestamptz parses correctly WITH its offset, so `new Date()` is
// right here — unlike a date-only 'YYYY-MM-DD', which needs lib/format's local-parts trick.
export function formatMsgTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? time : `${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} · ${time}`
}

// Map the internal pipeline status (+ the human archive flag) to a CLEAN client-facing
// pill. The client never sees internal words like 'awaiting_review'/'failed'; the archive
// is the owner's "done" signal, so it wins over any status.
export function clientPill(status: string, archivedAt: string | null): { label: string; tone: 'done' | 'wip' | 'new' } {
  if (archivedAt) return { label: 'טופל', tone: 'done' }
  if (status === 'new' || status === 'sent') return { label: 'התקבל', tone: 'new' }
  return { label: 'בטיפול', tone: 'wip' }
}
