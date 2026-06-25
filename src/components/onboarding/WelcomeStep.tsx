import { Fragment } from 'react'
import { FileText, Bank, Coins, Key, Clock, CaretDown } from '@phosphor-icons/react'
import { useOnboarding } from './context'

// First bookend after login — a full-screen intro (no card "bubble"). A navy brand
// band reaches the top of the screen, then a minimal, airy stepper previews the four
// setup themes with a connecting arrow between each, and a single CTA anchored low.
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
      <div className="onboarding-welcome-hero">
        <div className="onboarding-welcome-logo">
          <svg width="32" height="32" viewBox="0 0 512 512" aria-hidden="true">
            <path d="M120 250 L246 130 a14 14 0 0 1 20 0 L392 250 Z" fill="var(--hero-navy)" />
            <rect x="158" y="236" width="196" height="160" rx="18" fill="var(--hero-navy)" />
            <rect x="230" y="312" width="52" height="84" rx="12" fill="#2A7DE1" />
            <rect x="196" y="284" width="38" height="38" rx="9" fill="#2A7DE1" />
          </svg>
        </div>
        <div className="onboarding-welcome-brand">Apartment</div>
        <div className="onboarding-welcome-brandsub">ניהול ההשקעה בדירה שלך</div>
        <div className="onboarding-welcome-time">
          <Clock size={14} weight="bold" /> כ‑3 דקות · אפשר לדלג בכל שלב
        </div>
      </div>

      <div className="onboarding-welcome-content">
        <div className="onboarding-welcome-lead">נגדיר את הדירה שלך בארבעה נושאים קצרים</div>

        <div className="onboarding-welcome-steps">
          {ITEMS.map(({ Icon, label, sub }, i) => (
            <Fragment key={label}>
              <div className="onboarding-welcome-row">
                <div className="onboarding-welcome-icon"><Icon size={26} weight="duotone" color="var(--accent)" /></div>
                <div>
                  <div className="onboarding-welcome-label">{label}</div>
                  <div className="onboarding-welcome-rowsub">{sub}</div>
                </div>
              </div>
              {i < ITEMS.length - 1 && (
                <div className="onboarding-welcome-arrow">
                  <span className="onboarding-welcome-arrow-lane"><CaretDown size={18} weight="bold" /></span>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="onboarding-welcome-cta-wrap">
        <button type="button" className="btn-onboard-primary onboarding-cta-full" onClick={() => advance('documents')}>
          מתחילים
        </button>
      </div>
    </div>
  )
}
