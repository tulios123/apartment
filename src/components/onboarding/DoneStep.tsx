import { House, Check, MapPin, Bell, CloudCheck, ArrowLeft } from '@phosphor-icons/react'
import { pushSupported, pushConfigured, isInstalledPWA, isIOS } from '../../lib/push'
import { formatCurrency } from './types'
import { useOnboarding } from './context'

export function DoneStep() {
  const {
    onComplete, error, notifOn, notifBusy, enableNotifications,
    street, city, price, totalPrincipal, monthlyRent, equityAmount, derivedEquityAmount,
  } = useOnboarding()

  const address = [street, city].filter(Boolean).join(', ')
  const rent = parseFloat(monthlyRent) || 0
  const equity = equityAmount || derivedEquityAmount || 0
  // Reflect what was just set up — a payoff that turns a generic success screen into
  // "look what you built". Only show metrics that actually have a value.
  const metrics = [
    price > 0 && { label: 'שווי נכס', value: formatCurrency(price), income: false },
    totalPrincipal > 0 && { label: 'משכנתא', value: formatCurrency(totalPrincipal), income: false },
    rent > 0 && { label: 'שכ״ד חודשי', value: formatCurrency(rent), income: true },
    equity > 0 && { label: 'הון עצמי', value: formatCurrency(equity), income: false },
  ].filter(Boolean) as { label: string; value: string; income: boolean }[]

  return (
    <div className="onboarding-done">
      <div className="onboarding-done-hero">
        <span className="onboarding-confetti c1" aria-hidden />
        <span className="onboarding-confetti c2" aria-hidden />
        <span className="onboarding-confetti c3" aria-hidden />
        <span className="onboarding-confetti c4" aria-hidden />
        <div className="onboarding-done-badge">
          <House size={38} weight="duotone" color="var(--accent)" />
          <span className="onboarding-done-check"><Check size={15} weight="bold" color="#fff" /></span>
        </div>
        <h2 className="onboarding-done-title">הכל מוכן!</h2>
        <p className="onboarding-done-sub">הנכס שלך מוגדר — אפשר להתחיל לנהל.</p>
      </div>

      {(address || metrics.length > 0) && (
        <div className="onboarding-prop-card">
          {address && (
            <div className="onboarding-prop-addr">
              <MapPin size={17} weight="fill" color="var(--accent)" />
              <span>{address}</span>
            </div>
          )}
          {metrics.length > 0 && (
            <div className="onboarding-metric-grid">
              {metrics.map(m => (
                <div className="onboarding-metric" key={m.label}>
                  <span className="onboarding-metric-label">{m.label}</span>
                  <span className={`onboarding-metric-value${m.income ? ' income' : ''}`}>{m.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="onboarding-error" role="alert" style={{ textAlign: 'center', marginTop: 12 }}>{error}</p>}

      <div className="onboarding-done-spacer" />

      {(() => {
        if (notifOn) {
          return (
            <div className="onboarding-notif-card is-on">
              <Bell size={20} weight="fill" color="var(--success-text)" />
              <span className="onboarding-notif-text">התראות הופעלו — נזכיר לך כשמשהו דורש טיפול.</span>
            </div>
          )
        }
        if (!pushSupported() || !pushConfigured()) return null
        if (isIOS() && !isInstalledPWA()) {
          return <p className="onboarding-done-hint">רוצה תזכורות? ב-iPhone צריך קודם להוסיף את האפליקציה למסך הבית (שיתוף ← הוסף למסך הבית), ואז להפעיל התראות.</p>
        }
        return (
          <div className="onboarding-notif-card">
            <Bell size={20} weight="duotone" color="var(--accent)" />
            <span className="onboarding-notif-text">תזכורות על גבייה, תשלומים וחידושי חוזה</span>
            <button type="button" className="onboarding-notif-btn" onClick={enableNotifications} disabled={notifBusy}>
              {notifBusy ? 'מפעיל…' : 'הפעלה'}
            </button>
          </div>
        )
      })()}

      <button className="btn-onboard-primary onboarding-done-cta"
        onClick={() => { window.history.replaceState(null, '', '/'); onComplete() }}>
        כניסה לאפליקציה <ArrowLeft size={18} weight="bold" />
      </button>

      <p className="onboarding-done-saving"><CloudCheck size={14} /> המסמכים נשמרים ברקע</p>
    </div>
  )
}
