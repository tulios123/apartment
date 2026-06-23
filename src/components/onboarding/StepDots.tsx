import { STEP_ORDER } from './types'
import type { Step } from './types'

// Progress dots for the data-collection steps (welcome/done are excluded by
// STEP_ORDER). Self-contained — needs only the current step.
export function StepDots({ current }: { current: Step }) {
  const active = STEP_ORDER.indexOf(current as typeof STEP_ORDER[number])
  return (
    <div className="onboarding-dots">
      {STEP_ORDER.map((s, i) => {
        const cls = i === active ? 'active' : i < active ? 'done' : ''
        return <span key={s} className={`onboarding-dot ${cls}`} />
      })}
    </div>
  )
}
