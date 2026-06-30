import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { resetListCache, GOOGLE_TASKS_ENABLED } from '../lib/googleTasks'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
import { screenLabel } from '../lib/screenLabel'
import {
  pushSupported,
  pushConfigured,
  isInstalledPWA,
  isIOS,
  isSubscribed,
  enablePush,
  disablePush,
  sendTestNotification,
} from '../lib/push'

const GENERATION_KEY = 'monthly_generation'
// The dev/test account (reached via the ?manager login) is the manager console:
// it keeps the reset tools on the live app AND reads everyone's feedback. Family
// accounts (incl. the owner's personal email) never see these. Must stay in sync
// with the feedback table's RLS admin email (see migration 031).
const MANAGER_EMAIL = 'dev@test.local'

type PushState = 'loading' | 'unsupported' | 'not-installed' | 'default' | 'granted' | 'denied'

interface FeedbackRow {
  id: string
  email: string | null
  note: string
  path: string | null
  created_at: string
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [pushState, setPushState] = useState<PushState>('loading')
  const [pushBusy, setPushBusy] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  // UX-04: inline, auto-dismissing status toast instead of the native blocking alert().
  const [status, setStatus] = useState<string | null>(null)
  function showStatus(msg: string) {
    setStatus(msg)
    setTimeout(() => setStatus(null), 3500)
  }

  const isAdmin = user?.email === MANAGER_EMAIL
  // Technical/debug controls (reset, manual generation re-run) — manager/dev only,
  // never shown to family accounts.
  const showDevTools = import.meta.env.DEV || isAdmin
  // Real provider, not a hardcoded "Google" — magic-link users sign in via email.
  const providerLabel = user?.app_metadata?.provider === 'google' ? 'Google' : 'אימייל'

  const [themePref, setThemePrefState] = useState<ThemePref>(getThemePref())
  function changeTheme(p: ThemePref) { setThemePref(p); setThemePrefState(p) }

  useEffect(() => {
    refreshPushState()
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('feedback')
      .select('id, email, note, path, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => setFeedback(data ?? []))
  }, [isAdmin])

  async function deleteFeedback(id: string) {
    const removed = feedback.find(f => f.id === id)
    setFeedback(prev => prev.filter(f => f.id !== id))
    const { error } = await supabase.from('feedback').delete().eq('id', id)
    if (error && removed) {
      // Restore the optimistically-removed row so the inbox stays truthful.
      setFeedback(prev => [removed, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)))
      showStatus('מחיקת ההצעה נכשלה — נסו שוב')
    }
  }

  async function refreshPushState() {
    if (!pushSupported()) { setPushState('unsupported'); return }
    const perm = Notification.permission
    if (perm === 'denied') { setPushState('denied'); return }
    if (perm === 'granted') {
      setPushState((await isSubscribed()) ? 'granted' : 'default')
      return
    }
    // perm === 'default': on iOS push only works once added to the home screen.
    if (isIOS() && !isInstalledPWA()) { setPushState('not-installed'); return }
    setPushState('default')
  }

  async function enableNotifications() {
    if (!user) return
    setPushBusy(true)
    try {
      await enablePush(user.id)
      setPushState('granted')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'denied') setPushState('denied')
      else showStatus('שגיאה בהפעלת התראות: ' + msg)
    } finally {
      setPushBusy(false)
    }
  }

  async function disableNotifications() {
    setPushBusy(true)
    try {
      await disablePush()
      setPushState('default')
    } catch (e) {
      showStatus('שגיאה: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setPushBusy(false)
    }
  }

  async function testNotification() {
    try {
      await sendTestNotification()
    } catch (e) {
      showStatus('שגיאה: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function resetGenerationCache() {
    localStorage.removeItem(GENERATION_KEY)
    resetListCache()
    showStatus('המטמון אופס — הגנרציה החודשית תרוץ מחדש בטעינה הבאה')
  }

  async function resetAllData() {
    if (!user) return
    setResetting(true)
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('owner_id', user.id)

      await supabase.from('transactions').delete().eq('owner_id', user.id)
      await supabase.from('tasks').delete().eq('owner_id', user.id)
      await supabase.from('documents').delete().eq('owner_id', user.id)
      await supabase.from('recurring_items').delete().eq('owner_id', user.id)
      await supabase.from('investment_costs').delete().eq('owner_id', user.id)
      await supabase.from('insurance_policies').delete().eq('owner_id', user.id)
      await supabase.from('contracts').delete().eq('owner_id', user.id)
      await supabase.from('mortgage_tracks').delete().eq('owner_id', user.id)
      await supabase.from('mortgages').delete().eq('owner_id', user.id)
      // loans (monthly + balloon) carry owner_id and a SET NULL property FK, so a
      // property delete leaves them orphaned — clear them explicitly before properties.
      await supabase.from('loans').delete().eq('owner_id', user.id)
      await supabase.from('properties').delete().eq('owner_id', user.id)

      if (docs && docs.length > 0) {
        await supabase.storage.from('documents').remove(docs.map(d => d.storage_path))
      }

      localStorage.removeItem(GENERATION_KEY)
      window.location.reload()
    } catch (e) {
      showStatus('שגיאה: ' + (e instanceof Error ? e.message : String(e)))
      setResetting(false)
      setConfirmReset(false)
    }
  }

  return (
    <div className="page settings-page">
      <div className="page-header settings-header">
        <Link to="/" className="settings-back" aria-label="חזרה למסך הראשי"><ArrowRight size={20} /></Link>
        <h1>הגדרות</h1>
      </div>

      <div className="settings-sections">
        <section className="settings-section">
          <h2>חשבון</h2>
          <div className="settings-row">
            <span className="settings-label">אימייל</span>
            <span className="settings-value">{user?.email ?? '—'}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">ספק</span>
            <span className="settings-value">{providerLabel}</span>
          </div>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={signOut}>יציאה מהחשבון</button>
          </div>
        </section>

        <section className="settings-section">
          <h2>מראה</h2>
          <p className="settings-note">בחרו מצב תצוגה. "לפי המכשיר" יתחלף אוטומטית בין יום ללילה לפי הגדרות הטלפון.</p>
          <div className="toggle-group" style={{ marginTop: 6 }}>
            <button type="button" className={`toggle-btn${themePref === 'light' ? ' active' : ''}`} onClick={() => changeTheme('light')}>בהיר</button>
            <button type="button" className={`toggle-btn${themePref === 'dark' ? ' active' : ''}`} onClick={() => changeTheme('dark')}>כהה</button>
            <button type="button" className={`toggle-btn${themePref === 'system' ? ' active' : ''}`} onClick={() => changeTheme('system')}>לפי המכשיר</button>
          </div>
        </section>

        <section className="settings-section">
          <h2>התראות</h2>
          <p className="settings-note">
            קבלו התראה לנייד כשמשהו דורש טיפול — אישור גביית שכר דירה, תשלומים, חידוש חוזה ומשימות שעבר זמנן. נשלחת פעם ביום, רק כשיש משהו ממתין.
          </p>
          {pushState === 'unsupported' && (
            <p className="settings-note">הדפדפן הזה לא תומך בהתראות.</p>
          )}
          {pushState === 'not-installed' && (
            <p className="settings-note">
              כדי לקבל התראות ב-iPhone צריך קודם להוסיף את האפליקציה למסך הבית (שיתוף ← הוסף למסך הבית) ולפתוח אותה משם.
            </p>
          )}
          {pushState === 'denied' && (
            <p className="settings-note">
              ההתראות חסומות. ניתן לאפשר אותן מחדש בהגדרות המכשיר עבור האפליקציה.
            </p>
          )}
          {pushState === 'default' && !pushConfigured() && (
            <p className="settings-note">ההתראות יופעלו בקרוב.</p>
          )}
          {pushState === 'granted' ? (
            <div className="settings-actions" style={{ alignItems: 'center', gap: 12 }}>
              <span className="settings-value" style={{ color: 'var(--success-text, #1a7f37)', fontWeight: 600 }}>מופעל ✓</span>
              <button className="btn-secondary" onClick={testNotification} disabled={pushBusy}>
                שלח התראת בדיקה
              </button>
              <button className="btn-secondary" onClick={disableNotifications} disabled={pushBusy}>
                {pushBusy ? '...' : 'כבה'}
              </button>
            </div>
          ) : pushState === 'default' && pushConfigured() ? (
            <div className="settings-actions">
              <button className="btn-secondary" onClick={enableNotifications} disabled={pushBusy}>
                {pushBusy ? 'מפעיל...' : 'הפעל התראות'}
              </button>
            </div>
          ) : null}
        </section>

        {GOOGLE_TASKS_ENABLED && (
        <section className="settings-section">
          <h2>סנכרון Google Tasks</h2>
          <p className="settings-note">
            סנכרון דו-כיווני עם רשימת &quot;apartment&quot; ב-Google Tasks. הטוקן תקף כשעה אחרי ההתחברות — אם הסנכרון נפסק, יש להתחבר מחדש.
          </p>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={() => { resetListCache(); showStatus('מטמון רשימת Google אופס') }}>
              אפס מטמון רשימה
            </button>
          </div>
        </section>
        )}

        {showDevTools && (
        <section className="settings-section">
          <h2>גנרציה חודשית</h2>
          <p className="settings-note">
            הגנרציה החודשית יוצרת עסקאות ומשימות מפריטים קבועים ומתריעה על חידושי חוזה. רצה אוטומטית פעם בחודש.
          </p>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={resetGenerationCache}>
              הרץ שוב חודש זה
            </button>
          </div>
        </section>
        )}

        {isAdmin && (
          <section className="settings-section">
            <h2>הצעות לשיפור {feedback.length > 0 && `(${feedback.length})`}</h2>
            {feedback.length === 0 ? (
              <p className="settings-note">עדיין אין הצעות.</p>
            ) : (
              <div className="settings-feedback-list">
                {feedback.map(f => (
                  <div key={f.id} className="settings-feedback-row">
                    <p className="settings-feedback-note">{f.note}</p>
                    <div className="settings-feedback-meta">
                      <span>{f.path && <span className="settings-feedback-screen">{screenLabel(f.path)}</span>}{f.email ?? '—'} · {new Date(f.created_at).toLocaleDateString('he-IL')}</span>
                      <button className="settings-feedback-del" onClick={() => deleteFeedback(f.id)} aria-label="מחק">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {showDevTools && (
        <section className="settings-section">
          <h2>פיתוח ובדיקה</h2>
          <p className="settings-note">
            מחיקת כל הנתונים ופתיחת מחדש של אשף הקליטה — שימושי לבדיקת הונבורדינג מחדש.
          </p>
          <div className="settings-actions">
            {!confirmReset ? (
              <button className="btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setConfirmReset(true)}>
                איפוס כל הנתונים
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>בטוח? כל הנתונים יימחקו.</span>
                <button className="btn-secondary" onClick={() => setConfirmReset(false)} disabled={resetting}>ביטול</button>
                <button className="btn-primary" style={{ background: 'var(--danger)' }} onClick={resetAllData} disabled={resetting}>
                  {resetting ? 'מאפס...' : 'מחק הכל'}
                </button>
              </div>
            )}
          </div>
        </section>
        )}
      </div>

      {status && <div className="settings-toast" role="status" aria-live="polite">{status}</div>}
    </div>
  )
}
