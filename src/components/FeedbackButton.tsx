import { useState } from 'react'
import { Lightbulb } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { screenLabel } from '../lib/screenLabel'
import { currentEditContext } from '../lib/editContext'
import BottomSheet from './ui/BottomSheet'
import './feedback.css'

// In-app feedback. Anyone in the family can report a bug or suggest an idea; the
// note lands in the `feedback` table (owner reads it from Settings) and fires a push
// to the owner. Each note captures the exact screen — including the onboarding step
// (`screen` prop) and any edit surface open at the time (lib/editContext).
type Category = 'bug' | 'feature' | 'question' | 'other'
const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'bug', label: 'תקלה' },
  { key: 'feature', label: 'רעיון' },
  { key: 'question', label: 'שאלה' },
  { key: 'other', label: 'אחר' },
]

export default function FeedbackButton({ screen }: { screen?: string } = {}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>('bug')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(false)
  // Snapshot screen + open-edit at the moment the user opens the form — before this
  // sheet mounts — so the feedback sheet never records *itself* as the context.
  const [ctx, setCtx] = useState<{ path: string; edit: string | null }>({ path: '', edit: null })

  function openForm() {
    const path = screen ?? (typeof window !== 'undefined' ? window.location.pathname : '')
    setCtx({ path, edit: currentEditContext() })
    setCategory('bug')
    setNote('')
    setErr(false)
    setSent(false)
    setOpen(true)
  }

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
    let { error } = await supabase.from('feedback').insert({ ...base, category, context: ctx.edit })
    // Resilience: if the category/context columns aren't live yet (migration not
    // applied, or PostgREST schema-cache lag), still save the note without them.
    if (error && /category|context|column|schema|PGRST204/i.test(error.message ?? '')) {
      ;({ error } = await supabase.from('feedback').insert(base))
    }
    setSending(false)
    if (error) { setErr(true); return }
    // Notify the owner — best-effort, never block the thank-you on it.
    supabase.functions
      .invoke('notify-feedback', { body: { category, screen: ctx.path, editContext: ctx.edit, note: base.note } })
      .catch(() => {})
    setSent(true)
    setNote('')
    setTimeout(() => { setOpen(false); setSent(false) }, 1500)
  }

  // Feedback is tied to a signed-in account (RLS: owner_id = auth.uid()); no bubble
  // pre-auth. Now shown to every family member, not just the manager.
  if (!user) return null

  const contextLabel = screenLabel(ctx.path) + (ctx.edit ? ` · ${ctx.edit}` : '')

  return (
    <>
      <button className="fb-fab" aria-label="שליחת משוב" onClick={openForm}>
        <Lightbulb size={18} weight="fill" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="שליחת משוב" track={false} minimizable={false}>
        {sent ? (
          <p className="fb-thanks">תודה! המשוב נשלח ✓</p>
        ) : (
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

            <div className="fb-screen-note">מתוך: {contextLabel}</div>
            {err && <p className="fb-err">לא הצלחנו לשלוח — נסו שוב</p>}

            <div className="fb-actions">
              <button className="fb-send" onClick={submit} disabled={sending || !note.trim()}>
                {sending ? 'שולח...' : 'שליחה'}
              </button>
              <button className="fb-cancel" type="button" onClick={() => setOpen(false)}>ביטול</button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  )
}
