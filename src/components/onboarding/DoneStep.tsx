import { CheckCircle, ArrowLeft } from '@phosphor-icons/react'
import { pushSupported, pushConfigured, isInstalledPWA, isIOS } from '../../lib/push'
import { useOnboarding } from './context'

export function DoneStep() {
  const { onComplete, error, notifOn, notifBusy, enableNotifications } = useOnboarding()

  return (
    <>
      <div className="onboarding-done-icon"><CheckCircle weight="fill" size={64} color="var(--success)" /></div>
      <h2 className="onboarding-title">הכל מוכן!</h2>
      <p className="onboarding-subtitle">
        הנכס שלך הוגדר בהצלחה.<br />תוכל לנהל משכנתא, ביטוח, עלויות ותשלומים קבועים מתוך האפליקציה.
      </p>
      {error && <p className="onboarding-error" role="alert" style={{ textAlign: 'center' }}>{error}</p>}

      {(() => {
        if (notifOn) {
          return <p className="onboarding-subtitle onboarding-optional" style={{ textAlign: 'center' }}>🔔 התראות הופעלו — נזכיר לך כשמשהו דורש טיפול.</p>
        }
        if (!pushSupported() || !pushConfigured()) return null
        if (isIOS() && !isInstalledPWA()) {
          return <p className="onboarding-subtitle onboarding-optional" style={{ textAlign: 'center' }}>רוצה תזכורות? ב-iPhone צריך קודם להוסיף את האפליקציה למסך הבית (שיתוף ← הוסף למסך הבית), ואז להפעיל התראות בהגדרות.</p>
        }
        return (
          <div className="onboarding-actions" style={{ justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <p className="onboarding-subtitle" style={{ textAlign: 'center', margin: 0 }}>רוצה לקבל תזכורות על גביית שכר דירה, תשלומים וחידושי חוזה?</p>
            <button type="button" className="btn-onboard-skip" onClick={enableNotifications} disabled={notifBusy}>
              {notifBusy ? 'מפעיל...' : '🔔 הפעל תזכורות'}
            </button>
          </div>
        )
      })()}

      <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
        <button className="btn-onboard-primary" onClick={() => { window.history.replaceState(null, '', '/'); onComplete() }}>למסך הראשי <ArrowLeft size={16} /></button>
      </div>
    </>
  )
}
