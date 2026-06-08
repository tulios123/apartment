import { useAuth } from '../contexts/AuthContext'
import { resetListCache } from '../lib/googleTasks'

const GENERATION_KEY = 'monthly_generation'

export default function Settings() {
  const { user, signOut } = useAuth()

  function resetGenerationCache() {
    localStorage.removeItem(GENERATION_KEY)
    resetListCache()
    alert('מטמון אופס — הגנרציה החודשית תרוץ מחדש בטעינה הבאה')
  }

  return (
    <div className="page settings-page">
      <div className="page-header">
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
            <span className="settings-value">Google</span>
          </div>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={signOut}>יציאה מהחשבון</button>
          </div>
        </section>

        <section className="settings-section">
          <h2>סנכרון Google Tasks</h2>
          <p className="settings-note">
            סנכרון דו-כיווני עם רשימת &quot;apartment&quot; ב-Google Tasks. הטוקן תקף כשעה אחרי ההתחברות — אם הסנכרון נפסק, יש להתחבר מחדש.
          </p>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={() => { resetListCache(); alert('מטמון רשימת Google אופס') }}>
              אפס מטמון רשימה
            </button>
          </div>
        </section>

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
      </div>
    </div>
  )
}
