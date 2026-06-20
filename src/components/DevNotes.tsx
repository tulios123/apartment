import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Note, CaretDown, Trash } from '@phosphor-icons/react'

const STORAGE_KEY = 'dev-notes-v1'

function screenLabel(pathname: string): string {
  if (pathname === '/') return 'מסך ראשי'
  if (pathname.startsWith('/finances/recurring')) return 'תזרים — חוזרים'
  if (pathname.startsWith('/finances')) return 'תזרים'
  if (pathname.startsWith('/wealth/liabilities')) return 'הון — התחייבויות'
  if (pathname.startsWith('/wealth')) return 'הון'
  if (pathname.startsWith('/property/tasks')) return 'ניהול — משימות'
  if (pathname.startsWith('/property/documents')) return 'ניהול — מסמכים'
  if (pathname.startsWith('/property/rental')) return 'ניהול — שכירות'
  if (pathname.startsWith('/property')) return 'ניהול'
  if (pathname.startsWith('/settings')) return 'הגדרות'
  return pathname
}

function loadNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function saveNotes(n: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(n))
}

export default function DevNotes() {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes)
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Track SPA route changes without needing react-router context
  useEffect(() => {
    const sync = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', sync)
    const origPush = history.pushState.bind(history)
    const origReplace = history.replaceState.bind(history)
    history.pushState = (...a) => { origPush(...a); sync() }
    history.replaceState = (...a) => { origReplace(...a); sync() }
    return () => {
      window.removeEventListener('popstate', sync)
      history.pushState = origPush
      history.replaceState = origReplace
    }
  }, [])

  // Auto-focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 80)
  }, [open, pathname])

  function update(text: string) {
    setNotes(prev => {
      const next = { ...prev, [pathname]: text }
      saveNotes(next)
      return next
    })
  }

  function deleteScreen() {
    setNotes(prev => {
      const next = { ...prev }
      delete next[pathname]
      saveNotes(next)
      return next
    })
  }

  const current = notes[pathname] ?? ''
  const others = Object.entries(notes).filter(([k, v]) => k !== pathname && v.trim())
  const totalScreens = Object.values(notes).filter(v => v.trim()).length

  const ui = (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="הערות פיתוח"
        style={{
          position: 'fixed',
          bottom: 110,
          left: 16,
          zIndex: 9998,
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: '#1a1a2e',
          color: '#fff',
          border: '2px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
          opacity: open ? 1 : 0.7,
          transition: 'opacity 0.15s',
        }}
      >
        <Note size={18} weight="fill" />
        {totalScreens > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: '#e74c3c',
            color: '#fff',
            borderRadius: '50%',
            width: 16,
            height: 16,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>{totalScreens}</span>
        )}
      </button>

      {/* Bottom sheet */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(0,0,0,0.3)',
            }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            zIndex: 9999,
            background: 'var(--surface)',
            borderTop: '2px solid #1a1a2e',
            borderRadius: '14px 14px 0 0',
            padding: '14px 16px 24px',
            boxShadow: '0 -6px 32px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: '70vh',
            overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Note size={16} weight="fill" style={{ color: '#1a1a2e', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 13, flex: 1, color: 'var(--text)' }}>
                {screenLabel(pathname)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {pathname}
              </span>
              {current.trim() && (
                <button onClick={deleteScreen} title="מחק הערות מסך זה"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  <Trash size={15} />
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                <CaretDown size={18} />
              </button>
            </div>

            {/* Main textarea */}
            <textarea
              ref={textareaRef}
              value={current}
              onChange={e => update(e.target.value)}
              placeholder={`הערות לשיפור — ${screenLabel(pathname)}`}
              dir="rtl"
              rows={6}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1.5px solid var(--border)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
                background: 'var(--surface)',
                color: 'var(--text)',
                lineHeight: 1.55,
              }}
            />

            {/* Other screens */}
            {others.length > 0 && (
              <details style={{ fontSize: 12 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', userSelect: 'none' }}>
                  הערות ממסכים אחרים ({others.length})
                </summary>
                <div style={{
                  marginTop: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  paddingTop: 4,
                }}>
                  {others.map(([k, v]) => (
                    <div key={k} style={{
                      background: 'var(--surface-alt, var(--bg))',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '8px 10px',
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>
                        {screenLabel(k)}
                        <span style={{ fontWeight: 400, marginRight: 4, opacity: 0.6, fontFamily: 'monospace' }}>{k}</span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Export button */}
            {totalScreens > 0 && (
              <button
                onClick={() => {
                  const text = Object.entries(notes)
                    .filter(([, v]) => v.trim())
                    .map(([k, v]) => `## ${screenLabel(k)} (${k})\n${v}`)
                    .join('\n\n---\n\n')
                  navigator.clipboard.writeText(text).catch(() => {})
                }}
                style={{
                  alignSelf: 'flex-start',
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                העתק הכל ל-clipboard
              </button>
            )}
          </div>
        </>
      )}
    </>
  )

  return createPortal(ui, document.body)
}
