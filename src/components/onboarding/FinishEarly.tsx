import { useOnboarding } from './context'

// Escape hatch shown on the optional steps: commit whatever's entered so far and
// jump straight to the finish screen. Lets a user who only wants the property in
// stop after Purchase instead of clicking "דלג" through five screens — the welcome
// screen already promises "אפשר לדלג ולהוסיף בהמשך".
export function FinishEarly() {
  const { handleFinish, saving } = useOnboarding()
  return (
    <button type="button" className="onboarding-finish-early" onClick={handleFinish} disabled={saving}>
      {saving ? 'שומר…' : 'סיים עכשיו · אפשר להשלים את השאר בהמשך'}
    </button>
  )
}
