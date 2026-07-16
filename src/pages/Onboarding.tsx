import { createPortal } from 'react-dom'
import { CaretRight } from '@phosphor-icons/react'
import { OnboardingContext } from '../components/onboarding/context'
import { useOnboardingState } from '../components/onboarding/useOnboardingState'
import { WelcomeStep } from '../components/onboarding/WelcomeStep'
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
  const { step, back, navDir, finishPrompt, finishBlockers, dismissFinishPrompt, finishPromptBackToComplete, finishPromptContinueWithout } = state
  // Same title grammar as the steps' own dialogs — specific when possible.
  const finishPromptTitle = finishBlockers.length && finishBlockers.every(b => b.kind === 'track')
    ? 'חסרים פרטים במסלול'
    : finishBlockers.length && finishBlockers.every(b => b.kind === 'loan')
      ? 'חסרים פרטים בהלוואה'
      : 'חסרים פרטים'
  // Back lives as a top-right chevron (native RTL: "back" goes toward the start = right).
  // Hidden on the bookends — welcome has nowhere to go back to, done is terminal.
  const showBack = step !== 'welcome' && step !== 'done'

  // Welcome is a full-screen bookend (no card "bubble"); done still hugs a centered card.
  const isWelcome = step === 'welcome'
  const centered = step === 'done'

  return (
    <OnboardingContext.Provider value={state}>
      <div className={`onboarding-wrap${centered ? ' onboarding-wrap--center' : ''}${isWelcome ? ' onboarding-wrap--full' : ''}`}>
        <div className={`onboarding-card${isWelcome ? ' onboarding-card--full' : ''}`}>
          {showBack && (
            <button type="button" className="onboarding-back-chevron" onClick={back} aria-label="חזור">
              <CaretRight size={22} weight="bold" />
            </button>
          )}
          {/* key={step} remounts on each step change, re-triggering the slide.
              navDir picks forward vs back so the slide direction matches the move. */}
          <div className={`onboarding-step-anim is-${navDir}`} key={step}>
            {step === 'welcome' && <WelcomeStep />}
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
      {/* AUD-001: finishing (סיימו עכשיו / סיום) with an incomplete track/loan raises
          the same completeness dialog the steps raise on המשך — nothing is silently
          dropped or saved with backfilled values. */}
      {finishPrompt && createPortal(
        <div className="onboarding-dialog-overlay" onClick={dismissFinishPrompt}>
          <div className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-finish-dialog-title" onClick={e => e.stopPropagation()}>
            <div className="onboarding-dialog-title" id="onboarding-finish-dialog-title">{finishPromptTitle}</div>
            <p className="onboarding-dialog-lead">אם תסיימו עכשיו, הפריטים האלה לא יישמרו:</p>
            <ul className="onboarding-dialog-list">
              {finishBlockers.map((b, i) => (
                <li key={i}>
                  <strong>{b.kind === 'track' ? 'מסלול משכנתא' : 'הלוואה'} · {b.label}</strong> — חסר {b.missing.join(', ')}
                </li>
              ))}
            </ul>
            <div className="onboarding-dialog-actions">
              <button type="button" className="btn-onboard-primary onboarding-cta-full" onClick={finishPromptBackToComplete}>חזרה להשלמה</button>
              <button type="button" className="btn-onboard-skip onboarding-cta-full" onClick={finishPromptContinueWithout}>המשך בלי לשמור</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {/* No feedback FAB here: Onboarding renders OUTSIDE the <BrowserRouter> (App.tsx),
          and FeedbackButton uses router hooks (the /?fb= deep link) which throw
          "useLocation() may be used only in the context of a <Router>" — crashing every
          NEW account on first run. Restore only if onboarding moves inside the router. */}
    </OnboardingContext.Provider>
  )
}
