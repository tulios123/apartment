import { useState, useRef } from 'react'
import { Lightbulb, Camera, X } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { screenLabel } from '../lib/screenLabel'
import { currentEditContext } from '../lib/editContext'
import { uploadFeedbackScreenshot } from '../lib/storage'
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
  // Optional screenshot: keep the File for upload + a preview object-URL for the thumbnail.
  const [shot, setShot] = useState<File | null>(null)
  const [shotUrl, setShotUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickShot(file: File | null) {
    if (shotUrl) URL.revokeObjectURL(shotUrl)   // release the previous preview
    setShot(file)
    setShotUrl(file ? URL.createObjectURL(file) : null)
  }

  function openForm() {
    const path = screen ?? (typeof window !== 'undefined' ? window.location.pathname : '')
    setCtx({ path, edit: currentEditContext() })
    setCategory('bug')
    setNote('')
    pickShot(null)
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
    // Save the note first (and get its id) so a failed screenshot upload never loses it.
    let ins = await supabase.from('feedback').insert({ ...base, category, context: ctx.edit }).select('id').single()
    // Resilience: if the category/context columns aren't live yet (migration not
    // applied, or PostgREST schema-cache lag), still save the note without them.
    if (ins.error && /category|context|column|schema|PGRST204/i.test(ins.error.message ?? '')) {
      ins = await supabase.from('feedback').insert(base).select('id').single()
    }
    if (ins.error || !ins.data) { setSending(false); setErr(true); return }
    const feedbackId = ins.data.id as string

    // Optional screenshot — best-effort. The note is already saved, so an upload
    // failure (or the screenshot column/bucket not being live yet) never blocks the send.
    if (shot) {
      try {
        const path = await uploadFeedbackScreenshot(shot, feedbackId, user.id)
        await supabase.from('feedback').update({ screenshot_path: path }).eq('id', feedbackId)
      } catch { /* ignore — the note is saved without the image */ }
    }

    setSending(false)
    // Notify the owner — best-effort, never block the thank-you on it.
    supabase.functions
      .invoke('notify-feedback', { body: { category, screen: ctx.path, editContext: ctx.edit, note: base.note, hasScreenshot: !!shot } })
      .catch(() => {})
    setSent(true)
    setNote('')
    pickShot(null)
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

            <div className="fb-attach">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { pickShot(e.target.files?.[0] ?? null); e.target.value = '' }}
              />
              {shotUrl ? (
                <div className="fb-shot-preview">
                  <img src={shotUrl} alt="תצוגה מקדימה של הצילום" />
                  <button type="button" className="fb-shot-remove" onClick={() => pickShot(null)} aria-label="הסרת הצילום">
                    <X size={13} weight="bold" />
                  </button>
                </div>
              ) : (
                <button type="button" className="fb-attach-btn" onClick={() => fileRef.current?.click()}>
                  <Camera size={17} weight="duotone" /> צירוף צילום מסך
                </button>
              )}
            </div>

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
