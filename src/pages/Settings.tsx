import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { resetListCache } from '../lib/googleTasks'

const GENERATION_KEY = 'monthly_generation'
const MANAGER_EMAIL = 'dev@test.local'

export default function Settings() {
  const { user, signOut } = useAuth()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  function resetGenerationCache() {
    localStorage.removeItem(GENERATION_KEY)
    resetListCache()
    alert('מטמון אופס — הגנרציה החודשית תרוץ מחדש בטעינה הבאה')
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
      await supabase.from('properties').delete().eq('owner_id', user.id)

      if (docs && docs.length > 0) {
        await supabase.storage.from('documents').remove(docs.map(d => d.storage_path))
      }

      localStorage.removeItem(GENERATION_KEY)
      window.location.reload()
    } catch (e) {
      alert('שגיאה: ' + (e instanceof Error ? e.message : String(e)))
      setResetting(false)
      setConfirmReset(false)
    }
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

        {(import.meta.env.DEV || user?.email === MANAGER_EMAIL) && (
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
    </div>
  )
}
