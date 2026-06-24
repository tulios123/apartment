import { House, FileText, Bank, Coins, Key } from '@phosphor-icons/react'
import { useOnboarding } from './context'

// Light, informative intro before the documents step — the first "bookend" the
// user sees after login. Previews the four setup themes so the flow doesn't feel
// endless, then a full-width "מתחילים" into the wizard.
const ITEMS = [
  { Icon: FileText, label: 'הנכס', sub: 'חוזה רכישה, כתובת, מחיר ושטח' },
  { Icon: Bank, label: 'מימון', sub: 'מסלולי משכנתא, גרייס והלוואות' },
  { Icon: Coins, label: 'השקעה', sub: 'הון עצמי, עלויות נלוות ובלון' },
  { Icon: Key, label: 'הכנסות', sub: 'שכירות, תזכורות וביטוח' },
]

export function WelcomeStep() {
  const { advance } = useOnboarding()
  return (
    <div className="onboarding-welcome">
      <div className="onboarding-welcome-top">
        <div className="onboarding-welcome-mark"><House size={28} weight="duotone" color="var(--accent)" /></div>
        <h1 className="onboarding-welcome-title">ברוכים הבאים</h1>
        <p className="onboarding-welcome-sub">נגדיר את הנכס שלך בכמה שלבים קצרים.<br />כ-3 דקות — והכול אופציונלי.</p>
      </div>

      <div className="onboarding-welcome-divider" />

      <div className="onboarding-welcome-list">
        {ITEMS.map(({ Icon, label, sub }) => (
          <div className="onboarding-welcome-row" key={label}>
            <div className="onboarding-welcome-icon"><Icon size={18} color="var(--accent)" /></div>
            <div>
              <div className="onboarding-welcome-label">{label}</div>
              <div className="onboarding-welcome-rowsub">{sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="onboarding-welcome-spacer" />

      <button type="button" className="btn-onboard-primary onboarding-cta-full" onClick={() => advance('documents')}>
        מתחילים
      </button>
    </div>
  )
}
