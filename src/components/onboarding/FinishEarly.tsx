import { useOnboarding } from './context'

// Escape hatch shown on the optional steps: commit whatever's entered so far and
// jump straight to the finish screen. Lets a user who only wants the property in
// stop after Purchase instead of clicking "דלג" through five screens — the welcome
// screen already promises "אפשר לדלג ולהוסיף בהמשך".
export function FinishEarly() {
  const { requestFinish, saving, pendingFinish } = useOnboarding()
  return (
    <button type="button" className="onboarding-finish-early" onClick={requestFinish} disabled={saving || pendingFinish}>
      {saving ? 'שומר…' : pendingFinish ? 'רגע, מסיימים לקרוא את המסמכים…' : 'סיים עכשיו · אפשר להשלים את השאר בהמשך'}
    </button>
  )
}
