import { useState, useEffect, useRef } from 'react'
import { House, EnvelopeSimple, Lock } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { MANAGER_EMAIL } from '../lib/admin'

export default function Login() {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  // A1: the manager sign-in is hidden from the family release — surfaced only when
  // the URL carries ?admin=1 (there is no signed-in identity to gate on pre-auth).
  const adminMode = new URLSearchParams(window.location.search).get('admin') === '1'
  const emailRef = useRef<HTMLInputElement>(null)

  // Magic-link sign-in: enter email → get a sign-in link. Session persists after,
  // so it's a one-time step per device.
  const [email, setEmail] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [googleError, setGoogleError] = useState('')

  // Manager (dev test account) password login.
  const [showManager, setShowManager] = useState(false)
  const [mgrPwd, setMgrPwd] = useState('')
  const [mgrError, setMgrError] = useState('')

  // Lock the body like the app shell so iOS Safari doesn't pop its top/bottom
  // toolbars on drag. Login never needs to scroll. Released on unmount (→ app/onboarding).
  useEffect(() => {
    document.body.classList.add('login-locked')
    return () => document.body.classList.remove('login-locked')
  }, [])

  const handleSignIn = async () => {
    setBusy(true)
    setGoogleError('')
    try {
      await signInWithGoogle()
    } catch {
      setGoogleError('ההתחברות ל‑Google נכשלה — נסו שוב')
    } finally {
      setBusy(false)
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    // B10: the CTA stays solid/active at all times; tapping it without an email
    // focuses the field and shows a short reason instead of sitting greyed-out.
    if (!email.trim()) { setLinkError('הזינו כתובת מייל'); emailRef.current?.focus(); return }
    setLinkBusy(true)
    setLinkError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setLinkBusy(false)
    if (error) { setLinkError('לא הצלחנו לשלוח קישור — בדקו את כתובת המייל ונסו שוב'); return }
    setLinkSent(true)
  }

  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMgrError('')
    const { error } = await supabase.auth.signInWithPassword({ email: MANAGER_EMAIL, password: mgrPwd })
    if (error) {
      setMgrError('סיסמה שגויה')
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-card2">
          {/* Navy brand hero — ties the login to the splash and the app's status bar. */}
          <div className="login-hero">
            <div className="login-hero-mark"><House weight="duotone" size={31} color="#fff" /></div>
            <div className="login-hero-title">ניהול דירה</div>
            <div className="login-hero-sub">ניהול ההשקעה בדירה שלך</div>
          </div>

          <div className="login-body">
            {/* Email sign-in link */}
            {!linkSent ? (
              <form className="login-email-form2" onSubmit={sendLink}>
                <input
                  ref={emailRef}
                  type="email" inputMode="email" autoComplete="email" dir="ltr"
                  placeholder="כתובת מייל"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setLinkError('') }}
                />
                <button type="submit" className="login-send-btn" disabled={linkBusy}>
                  <EnvelopeSimple size={18} weight="bold" /> {linkBusy ? 'שולח...' : 'שליחת קישור כניסה'}
                </button>
              </form>
            ) : (
              <div className="login-email-form2">
                <p className="login-info">שלחנו קישור ל-{email.trim()} — פתחו את המייל ולחצו עליו כדי להיכנס.</p>
                <button type="button" className="login-manager-link" onClick={() => { setLinkSent(false); setLinkError('') }}>
                  שנה מייל או שלח שוב
                </button>
              </div>
            )}
            {linkError && <p className="login-error">{linkError}</p>}

            <div className="login-divider2"><span>או</span></div>

            <button className="btn-google2" onClick={handleSignIn} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {busy ? 'מתחבר...' : 'המשך עם Google'}
            </button>
            {googleError && <p className="login-error">{googleError}</p>}

            {/* Manager (dev test account) login — only when ?admin=1 is present (A1) */}
            {adminMode && (!showManager ? (
              <button className="login-manager-link login-manager-link--foot" onClick={() => setShowManager(true)}>
                כניסת מנהל
              </button>
            ) : (
              <form className="login-manager-form" onSubmit={handleManagerLogin}>
                <input
                  type="password" autoComplete="current-password"
                  placeholder="סיסמת מנהל"
                  value={mgrPwd}
                  onChange={e => { setMgrPwd(e.target.value); setMgrError('') }}
                  autoFocus
                />
                <button type="submit" className="btn-manager" disabled={busy || !mgrPwd}>
                  {busy ? 'מתחבר...' : 'כניסה'}
                </button>
                {mgrError && <p className="login-error">{mgrError}</p>}
              </form>
            ))}
          </div>
        </div>

        <div className="login-trust"><Lock size={13} weight="fill" /> המידע שלך פרטי ומאובטח</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', justifyContent: 'center', marginTop: '14px', fontSize: '12px' }}>
          <a href="/legal/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>מדיניות פרטיות</a>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <a href="/legal/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>תנאי שימוש</a>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <a href="/legal/accessibility" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>נגישות</a>
        </div>
      </div>
    </div>
  )
}
