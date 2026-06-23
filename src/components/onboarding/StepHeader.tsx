import type { ReactNode } from 'react'
import { StepDots } from './StepDots'
import { useOnboarding } from './context'
import type { Step } from './types'

// Shared header for the six data-collection steps: progress dots, "step N of M",
// icon and title. The per-step "optional" subtitle stays in each step.
export function StepHeader({ current, icon, title }: { current: Step; icon: ReactNode; title: string }) {
  const { currentStepIndex, stepTotal } = useOnboarding()
  return (
    <>
      <StepDots current={current} />
      <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
      <div className="onboarding-icon">{icon}</div>
      <h2 className="onboarding-title">{title}</h2>
    </>
  )
}
