import { useState, useEffect } from 'react'
import { House } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const MANAGER_EMAIL = 'dev@test.local'

export default function Login() {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)

  // Shared email for both password and magic-link sign-in.
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState('')
  const [info, setInfo] = useState('')

  // Magic-link option (sends a sign-in link to the email — works on the free tier
  // where the email body can't be customised to show a code).
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

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
    try {
      await signInWithGoogle()
    } finally {
      setBusy(false)
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwBusy(true)
    setPwError('')
    setInfo('')
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pwd,
        options: { emailRedirectTo: window.location.origin },
      })
      setPwBusy(false)
      if (error) { setPwError(error.message === 'User already registered' ? 'כבר קיים חשבון עם המייל הזה — התחבר' : 'ההרשמה נכשלה — נסה שוב'); return }
      // With email confirmation OFF a session is returned and we route in automatically.
      // With it ON there's no session yet — tell the user to confirm via the emailed link.
      if (!data.session) setInfo('שלחנו מייל לאישור — פתח אותו ולחץ על הקישור, ואז התחבר.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd })
      setPwBusy(false)
      if (error) { setPwError('מייל או סיסמה שגויים'); return }
      // On success, AuthContext's onAuthStateChange updates the session and routes in.
    }
  }

  async function sendLink() {
    setLinkBusy(true)
    setPwError('')
    setInfo('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setLinkBusy(false)
    if (error) { setPwError('לא הצלחנו לשלוח קישור — בדוק את המייל ונסה שוב'); return }
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
      <div className="login-card">
        <div className="login-logo"><House weight="duotone" size={40} color="var(--accent)" /></div>
        <h1>ניהול דירה</h1>
        <p className="login-subtitle">התחבר כדי להמשיך</p>

        {/* Email + password — stays fully in-app */}
        <form className="login-email-form" onSubmit={submitPassword}>
          <input
            type="email" inputMode="email" autoComplete="email" dir="ltr"
            placeholder="כתובת מייל"
            value={email}
            onChange={e => { setEmail(e.target.value); setPwError(''); setInfo('') }}
          />
          <input
            type="password"
            autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
            dir="ltr"
            placeholder={authMode === 'signup' ? 'בחר סיסמה (6 תווים לפחות)' : 'סיסמה'}
            value={pwd}
            onChange={e => { setPwd(e.target.value); setPwError(''); setInfo('') }}
          />
          <button type="submit" className="btn-primary login-email-btn"
            disabled={pwBusy || !email.trim() || pwd.length < 6}>
            {pwBusy ? 'רגע...' : authMode === 'signup' ? 'הרשמה' : 'כניסה'}
          </button>
        </form>
        <button type="button" className="login-manager-link"
          onClick={() => { setAuthMode(m => m === 'signin' ? 'signup' : 'signin'); setPwError(''); setInfo('') }}>
          {authMode === 'signin' ? 'אין לך חשבון? להרשמה' : 'יש לך חשבון? לכניסה'}
        </button>
        {pwError && <p className="login-error">{pwError}</p>}
        {info && <p className="login-info">{info}</p>}

        {/* Magic-link alternative */}
        {!linkSent ? (
          <button type="button" className="login-manager-link" onClick={sendLink} disabled={linkBusy || !email.trim()}>
            {linkBusy ? 'שולח...' : 'או שלחו לי קישור כניסה למייל'}
          </button>
        ) : (
          <p className="login-info">שלחנו קישור ל-{email.trim()} — פתח את המייל ולחץ עליו כדי להיכנס.</p>
        )}

        <div className="login-divider"><span>או</span></div>

        <button className="btn-google" onClick={handleSignIn} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {busy ? 'מתחבר...' : 'התחברות עם Google'}
        </button>

        {/* Manager (dev test account) login */}
        {!showManager ? (
          <button className="login-manager-link" onClick={() => setShowManager(true)}>
            כניסת מנהל
          </button>
        ) : (
          <form className="login-manager-form" onSubmit={handleManagerLogin}>
            <input
              type="password" inputMode="numeric" autoComplete="current-password"
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
        )}
      </div>
    </div>
  )
}
