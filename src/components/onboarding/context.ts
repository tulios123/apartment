import { createContext, useContext } from 'react'
import { useOnboardingState } from './useOnboardingState'

// The shared wizard surface — inferred from the hook so it never drifts out of
// sync with a hand-written interface.
export type OnboardingState = ReturnType<typeof useOnboardingState>

export const OnboardingContext = createContext<OnboardingState | null>(null)

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used inside <Onboarding>')
  return ctx
}
