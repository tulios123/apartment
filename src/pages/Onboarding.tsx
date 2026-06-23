import { OnboardingContext } from '../components/onboarding/context'
import { useOnboardingState } from '../components/onboarding/useOnboardingState'
import { DocumentsStep } from '../components/onboarding/DocumentsStep'
import { PurchaseStep } from '../components/onboarding/PurchaseStep'
import { MortgageStep } from '../components/onboarding/MortgageStep'
import { LoansStep } from '../components/onboarding/LoansStep'
import { InvestmentStep } from '../components/onboarding/InvestmentStep'
import { RentalStep } from '../components/onboarding/RentalStep'
import { InsuranceStep } from '../components/onboarding/InsuranceStep'
import { DoneStep } from '../components/onboarding/DoneStep'

interface Props { onComplete: () => void }

// First-run wizard. All state + logic live in useOnboardingState (the wizard's
// brain); each step is its own component reading it through OnboardingContext.
export default function Onboarding({ onComplete }: Props) {
  const state = useOnboardingState(onComplete)
  const { step } = state

  return (
    <OnboardingContext.Provider value={state}>
      <div className="onboarding-wrap">
        <div className="onboarding-card">
          {/* key={step} remounts on each step change, re-triggering the slide/fade. */}
          <div className="onboarding-step-anim" key={step}>
            {step === 'documents' && <DocumentsStep />}
            {step === 'purchase' && <PurchaseStep />}
            {step === 'mortgage' && <MortgageStep />}
            {step === 'loans' && <LoansStep />}
            {step === 'investment' && <InvestmentStep />}
            {step === 'rental' && <RentalStep />}
            {step === 'insurance' && <InsuranceStep />}
            {step === 'done' && <DoneStep />}
          </div>
        </div>
      </div>
    </OnboardingContext.Provider>
  )
}
