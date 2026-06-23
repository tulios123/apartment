import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Lightbulb, X } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './feedback.css'

// A small always-available "suggest an improvement" button. Notes land in the
// `feedback` table; the app owner reads them from Settings (admin-only section).
export default function FeedbackButton() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(false)

  async function submit() {
    if (!note.trim() || !user) return
    setSending(true)
    setErr(false)
    const { error } = await supabase.from('feedback').insert({
      owner_id: user.id,
      email: user.email ?? null,
      note: note.trim(),
      path: pathname,
      user_agent: navigator.userAgent,
    })
    setSending(false)
    if (error) { setErr(true); return }
    setSent(true)
    setNote('')
    setTimeout(() => { setOpen(false); setSent(false) }, 1400)
  }

  return (
    <>
      <button className="fb-fab" aria-label="הצעה לשיפור" onClick={() => setOpen(true)}>
        <Lightbulb size={18} weight="fill" />
      </button>

      {open && (
        <div className="fb-overlay" onClick={() => setOpen(false)}>
          <div className="fb-sheet" onClick={e => e.stopPropagation()}>
            <div className="fb-head">
              <span>הצעה לשיפור</span>
              <button className="fb-close" onClick={() => setOpen(false)} aria-label="סגור"><X size={16} /></button>
            </div>
            {sent ? (
              <p className="fb-thanks">תודה! ההצעה נשמרה ✓</p>
            ) : (
              <>
                <textarea
                  autoFocus
                  value={note}
                  onChange={e => { setNote(e.target.value); setErr(false) }}
                  placeholder="מה אפשר לשפר? מה חסר או מבלבל?"
                  rows={4}
                />
                {err && <p className="fb-err">לא הצלחנו לשמור — נסו שוב</p>}
                <button className="fb-send" onClick={submit} disabled={sending || !note.trim()}>
                  {sending ? 'שולח...' : 'שליחה'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
