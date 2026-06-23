import { House, ArrowLeft } from '@phosphor-icons/react'
import { useOnboarding } from './context'

export function WelcomeStep() {
  const { advance } = useOnboarding()
  return (
    <form onSubmit={e => { e.preventDefault(); advance('purchase') }}>
      <div className="onboarding-icon"><House size={44} color="var(--accent)" /></div>
      <h1 className="onboarding-title">ברוך הבא!</h1>
      <p className="onboarding-subtitle">
        בואו נגדיר את הנכס שלך בכמה שלבים קצרים.<br />
        רק פרטי הרכישה נדרשים — כל השאר אופציונלי, אפשר לדלג ולהוסיף בהמשך.
      </p>
      <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
        <button type="submit" className="btn-onboard-primary">התחל <ArrowLeft size={16} /></button>
      </div>
    </form>
  )
}
