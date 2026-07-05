import { useOnboarding } from './context'

// Manager/dev-only "fill example" affordance, pinned to the top of each step
// (previously a button down in the action bar). Renders nothing for real users.
export function FillExampleTop({ onFill }: { onFill: () => void }) {
  const { showFillExample } = useOnboarding()
  if (!showFillExample) return null
  return (
    <div className="onboarding-fill-top">
      <button type="button" className="onboarding-fill-top-btn" onClick={onFill}>מילוי דוגמה</button>
    </div>
  )
}
