import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Lightbulb, Camera, X, PaperPlaneTilt, ArrowRight } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { screenLabel } from '../lib/screenLabel'
import { currentEditContext } from '../lib/editContext'
import { registerFeedbackOpener } from '../lib/feedbackController'
import { uploadFeedbackScreenshot } from '../lib/storage'
import {
  loadThread, sendMessage, subscribeThread, formatMsgTime, clientPill,
  type FeedbackMsg,
} from '../lib/feedbackMessages'
import BottomSheet from './ui/BottomSheet'
import './feedback.css'

// In-app feedback. Anyone in the family can report a bug or suggest an idea, and — new in
// Phase 2 — follow it as a conversation: the "המשוב שלי" tab lists their reports with a
// status, and each opens a chat thread where the owner's replies land and they can reply
// back. The note lands in `feedback`; the thread lives in `feedback_messages`.
type Category = 'bug' | 'feature'
const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'bug', label: 'תקלה' },
  { key: 'feature', label: 'רעיון' },
]

const CAT_LABEL: Record<string, string> = { bug: 'תקלה', feature: 'רעיון', question: 'משוב', other: 'משוב' }

type MyItem = {
  id: string
  note: string
  category: string | null
  status: string
  archived_at: string | null
  created_at: string
}

type View = 'send' | 'list' | 'thread'

export default function FeedbackButton({ screen }: { screen?: string } = {}) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('send')

  // ── Send form ──
  const [category, setCategory] = useState<Category>('bug')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(false)
  // Snapshot screen + open-edit at the moment the user opens the form — before this
  // sheet mounts — so the feedback sheet never records *itself* as the context.
  const [ctx, setCtx] = useState<{ path: string; edit: string | null }>({ path: '', edit: null })
  // Several screenshots may be attached; each carries its preview object-URL. Add or remove
  // freely before sending (nothing is uploaded until submit).
  const [shots, setShots] = useState<{ file: File; url: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  // The post-submit "thank you" auto-close timer — held so opening a thread (e.g. via a
  // deep-link) during the 1.5s window can cancel it instead of being slammed shut.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function clearCloseTimer() { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }

  // ── My-feedback list + thread ──
  const [myItems, setMyItems] = useState<MyItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [threadItem, setThreadItem] = useState<MyItem | null>(null)
  const [messages, setMessages] = useState<FeedbackMsg[]>([])
  const [reply, setReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  function addShots(files: FileList | null) {
    if (!files || files.length === 0) return
    const picked = Array.from(files).map(file => ({ file, url: URL.createObjectURL(file) }))
    setShots(prev => [...prev, ...picked])
  }
  function removeShot(idx: number) {
    setShots(prev => {
      const s = prev[idx]
      if (s) URL.revokeObjectURL(s.url)
      return prev.filter((_, i) => i !== idx)
    })
  }
  function clearShots() {
    setShots(prev => { prev.forEach(s => URL.revokeObjectURL(s.url)); return [] })
  }

  function openForm() {
    clearCloseTimer()
    const path = screen ?? (typeof window !== 'undefined' ? window.location.pathname : '')
    setCtx({ path, edit: currentEditContext() })
    setCategory('bug')
    setNote('')
    clearShots()
    setErr(false)
    setSent(false)
    setView('send')
    setOpen(true)
  }

  // Let any edit surface open this same sheet via openFeedback(). openForm reads the live
  // context at call time, so a single registration per mount is enough.
  useEffect(() => {
    registerFeedbackOpener(openForm)
    return () => { registerFeedbackOpener(null); clearCloseTimer() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMyList = useCallback(async () => {
    if (!user) return
    setLoadingList(true)
    // RLS scopes this to the caller's own rows. Fall back if archived_at (migration 039)
    // isn't live yet, so the list still loads during the window before the owner deploys.
    const primary = await supabase.from('feedback')
      .select('id, note, category, status, archived_at, created_at')
      .order('created_at', { ascending: false })
    let data = primary.data as Record<string, unknown>[] | null
    if (primary.error && /archived_at|status|column|schema|PGRST204/i.test(primary.error.message ?? '')) {
      const fb = await supabase.from('feedback')
        .select('id, note, category, created_at')
        .order('created_at', { ascending: false })
      data = fb.data as Record<string, unknown>[] | null
    }
    const rows = (data ?? []).map(r => ({
      id: String(r.id),
      note: String(r.note ?? ''),
      category: (r.category as string | null) ?? null,
      status: (r.status as string) ?? 'new',
      archived_at: (r.archived_at as string | null) ?? null,
      created_at: String(r.created_at ?? ''),
    }))
    setMyItems(rows)
    setLoadingList(false)
  }, [user])

  // Refresh the list whenever the user switches to it.
  useEffect(() => {
    if (open && view === 'list') loadMyList()
  }, [open, view, loadMyList])

  const openThread = useCallback((item: MyItem) => {
    clearCloseTimer()
    setSent(false)   // a deep-link during the post-submit "thank you" window opens the thread, not the thanks
    setThreadItem(item)
    setMessages([])
    setReply('')
    setView('thread')
    setOpen(true)
  }, [])

  // Deep-link: a push tap on an admin reply / "handled" lands on /?fb=<id>. Open that
  // thread and strip the param so it doesn't re-fire. Falls back to the always-present
  // columns during the pre-deploy window (status/archived_at not live) so the link resolves.
  useEffect(() => {
    const fb = searchParams.get('fb')
    if (!fb || !user) return
    const next = new URLSearchParams(searchParams)
    next.delete('fb')
    setSearchParams(next, { replace: true })
    let alive = true
    ;(async () => {
      const full = await supabase.from('feedback')
        .select('id, note, category, status, archived_at, created_at').eq('id', fb).maybeSingle()
      let item = full.data as MyItem | null
      if (full.error && /archived_at|status|column|schema|PGRST204/i.test(full.error.message ?? '')) {
        const min = await supabase.from('feedback').select('id, note, category, created_at').eq('id', fb).maybeSingle()
        const d = min.data as Record<string, unknown> | null
        item = d ? { id: String(d.id), note: String(d.note ?? ''), category: (d.category as string | null) ?? null, status: 'new', archived_at: null, created_at: String(d.created_at ?? '') } : null
      }
      if (alive && item) openThread(item)
    })()
    return () => { alive = false }
  }, [searchParams, user, openThread, setSearchParams])

  // Load + live-subscribe the open thread.
  useEffect(() => {
    if (view !== 'thread' || !threadItem) return
    const id = threadItem.id
    let alive = true
    loadThread(id).then(m => { if (alive) setMessages(m) }).catch(() => {})
    const unsub = subscribeThread(id, (m) => {
      setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
      // A 'system' line means the admin resolved or reopened. feedback itself isn't streamed,
      // so refresh archived_at here to hide/show the composer for this session.
      if (m.author === 'system') {
        supabase.from('feedback').select('archived_at').eq('id', id).maybeSingle()
          .then(({ data }) => {
            if (alive && data) setThreadItem(prev => prev && prev.id === id ? { ...prev, archived_at: (data as { archived_at: string | null }).archived_at } : prev)
          })
      }
    })
    return () => { alive = false; unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, threadItem?.id])

  async function submit() {
    if (!note.trim() || !user) return
    setSending(true)
    setErr(false)
    const base = {
      owner_id: user.id,
      email: user.email ?? null,
      note: note.trim(),
      path: ctx.path,
      user_agent: navigator.userAgent,
    }
    let ins = await supabase.from('feedback').insert({ ...base, category, context: ctx.edit }).select('id').single()
    if (ins.error && /category|context|column|schema|PGRST204/i.test(ins.error.message ?? '')) {
      ins = await supabase.from('feedback').insert(base).select('id').single()
    }
    if (ins.error || !ins.data) { setSending(false); setErr(true); return }
    const feedbackId = ins.data.id as string

    // Upload every attached screenshot (best-effort each), then record the list.
    const paths: string[] = []
    for (const s of shots) {
      try { paths.push(await uploadFeedbackScreenshot(s.file, feedbackId, user.id)) }
      catch { /* skip this one — the note is saved regardless */ }
    }
    if (paths.length) {
      // screenshot_paths is the source of truth; keep the legacy single column = first image.
      await supabase.from('feedback').update({ screenshot_paths: paths, screenshot_path: paths[0] }).eq('id', feedbackId)
    }

    setSending(false)
    // Notify the owner — best-effort, never block the thank-you on it. Pass feedback_id so
    // the admin's push deep-links straight to the new item.
    supabase.functions
      .invoke('notify-feedback', { body: { category, screen: ctx.path, editContext: ctx.edit, note: base.note, hasScreenshot: shots.length > 0, feedback_id: feedbackId } })
      .catch(() => {})
    setSent(true)
    setNote('')
    clearShots()
    clearCloseTimer()
    closeTimer.current = setTimeout(() => { setSent(false); setView('send'); setOpen(false); closeTimer.current = null }, 1500)
  }

  async function sendReply() {
    const body = reply.trim()
    if (!body || !user || !threadItem) return
    setSendingReply(true)
    try {
      const msg = await sendMessage({ feedbackId: threadItem.id, author: 'client', body, userId: user.id, userEmail: user.email ?? null })
      setMessages(prev => prev.some(x => x.id === msg.id) ? prev : [...prev, msg])
      setReply('')
    } catch { /* keep the draft so nothing is lost */ }
    setSendingReply(false)
  }

  function closeSheet() {
    clearCloseTimer()
    setOpen(false)
    setView('send')
    setThreadItem(null)
  }

  // Feedback is tied to a signed-in account (RLS: owner_id = auth.uid()); no bubble pre-auth.
  if (!user) return null

  const contextLabel = screenLabel(ctx.path) + (ctx.edit ? ` · ${ctx.edit}` : '')
  const sheetTitle = view === 'thread' ? 'המשוב שלי' : 'משוב'
  const archived = !!threadItem?.archived_at
  // Client only ever sees the CLIENT channel (RLS already enforces this; filter by channel
  // — not author — so this is a real second layer, catching any owner→bot 'admin' message).
  const visibleMsgs = messages.filter(m => m.channel !== 'bot')

  return (
    <>
      <button className="fb-fab" aria-label="שליחת משוב" onClick={openForm}>
        <Lightbulb size={18} weight="fill" />
      </button>

      <BottomSheet open={open} onClose={closeSheet} title={sheetTitle} track={false} minimizable={false} elevated>
        {sent ? (
          <p className="fb-thanks">תודה! המשוב נשלח ✓</p>
        ) : view === 'thread' ? (
          // ── Thread view ──
          <div className="fb-thread-wrap">
            <button className="fb-thread-back" onClick={() => setView('list')}>
              <ArrowRight size={18} /> חזרה לרשימה
            </button>
            <div className="fb-thread">
              {threadItem && (
                <div className="fb-msg from-client">
                  <div className="fb-bubble">{threadItem.note}</div>
                  <span className="fb-msg-time">{formatMsgTime(threadItem.created_at)}</span>
                </div>
              )}
              {visibleMsgs.map(m => (
                m.author === 'system' ? (
                  <div key={m.id} className="fb-msg-system">{m.body}</div>
                ) : (
                  <div key={m.id} className={`fb-msg ${m.author === 'admin' ? 'from-admin' : 'from-client'}`}>
                    <div className="fb-bubble">{m.body}</div>
                    <span className="fb-msg-time">{formatMsgTime(m.created_at)}</span>
                  </div>
                )
              ))}
            </div>
            {archived ? (
              <p className="fb-thread-closed">הפנייה טופלה. תודה! 💛</p>
            ) : (
              <div className="fb-composer">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="כתיבת תגובה…"
                  rows={2}
                />
                <button className="fb-composer-send" onClick={sendReply} disabled={sendingReply || !reply.trim()} aria-label="שליחת תגובה">
                  <PaperPlaneTilt size={18} weight="fill" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Segmented toggle: send a new report | see my reports */}
            <div className="fb-seg" role="group" aria-label="תצוגת משוב">
              <button type="button" aria-pressed={view === 'send'} className={`fb-seg-btn${view === 'send' ? ' active' : ''}`} onClick={() => setView('send')}>שליחה</button>
              <button type="button" aria-pressed={view === 'list'} className={`fb-seg-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>המשוב שלי</button>
            </div>

            {view === 'send' ? (
              <div className="fb-form">
                <p className="fb-sub">מצאת תקלה או יש לך רעיון? ספרו לנו — וצרפו תיאור קצר.</p>

                <div className="fb-cats" role="group" aria-label="סוג המשוב">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      className={`fb-cat${category === c.key ? ' active' : ''}`}
                      aria-pressed={category === c.key}
                      onClick={() => setCategory(c.key)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <textarea
                  autoFocus
                  value={note}
                  onChange={e => { setNote(e.target.value); setErr(false) }}
                  placeholder="מה קרה? מה חסר או מבלבל?"
                  rows={4}
                />

                <div className="fb-attach">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => { addShots(e.target.files); e.target.value = '' }}
                  />
                  <div className="fb-shots">
                    {shots.map((s, i) => (
                      <div key={i} className="fb-shot-preview">
                        <img src={s.url} alt="תצוגה מקדימה של הצילום" />
                        <button type="button" className="fb-shot-remove" onClick={() => removeShot(i)} aria-label="הסרת הצילום">
                          <X size={13} weight="bold" />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="fb-attach-btn" onClick={() => fileRef.current?.click()}>
                      <Camera size={17} weight="duotone" /> {shots.length ? 'עוד צילום' : 'צירוף צילום מסך'}
                    </button>
                  </div>
                </div>

                <div className="fb-screen-note">מתוך: {contextLabel}</div>
                {err && <p className="fb-err">לא הצלחנו לשלוח — נסו שוב</p>}

                <div className="fb-actions">
                  <button className="fb-send" onClick={submit} disabled={sending || !note.trim()}>
                    {sending ? 'שולח...' : 'שליחה'}
                  </button>
                  <button className="fb-cancel" type="button" onClick={closeSheet}>ביטול</button>
                </div>
              </div>
            ) : (
              // ── My-feedback list ──
              <div className="fb-my-list">
                {loadingList ? (
                  <p className="fb-sub" style={{ textAlign: 'center', padding: '18px 0' }}>טוען…</p>
                ) : myItems.length === 0 ? (
                  <p className="fb-sub" style={{ textAlign: 'center', padding: '18px 0' }}>עדיין לא שלחת משוב. נשמח לשמוע!</p>
                ) : (
                  myItems.map(it => {
                    const pill = clientPill(it.status, it.archived_at)
                    return (
                      <button key={it.id} className="fb-my-item" onClick={() => openThread(it)}>
                        <div className="fb-my-top">
                          <span className={`fb-pill ${pill.tone}`}>{pill.label}</span>
                          <span className="fb-my-cat">{CAT_LABEL[it.category ?? ''] ?? 'משוב'}</span>
                          <span className="fb-my-date">{formatMsgTime(it.created_at)}</span>
                        </div>
                        <p className="fb-my-note">{it.note}</p>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}
      </BottomSheet>
    </>
  )
}
