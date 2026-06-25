import { useRef } from 'react'
import type { ReactNode } from 'react'
import { House, Tag, Bank, FileText, HandCoins, SignOut, UploadSimple, CheckCircle } from '@phosphor-icons/react'
import { formatCurrency, formatNum } from './types'
import { useOnboarding } from './context'
import { useAuth } from '../../contexts/AuthContext'

// One upload card. Tapping it picks file(s) and immediately kicks off extraction
// (which runs in the background while the user continues through the wizard).
function DocCard({ icon, title, hint, busy, err, doneText, onFiles }: {
  icon: ReactNode; title: string; hint: string
  busy: boolean; err: string | null; doneText: string
  onFiles: (files: File[]) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const state = busy ? 'reading' : err ? 'error' : doneText ? 'done' : 'empty'
  return (
    <button type="button" className={`onboarding-doc-card is-${state}`} onClick={() => ref.current?.click()} disabled={busy}>
      <div className="onboarding-doc-card-icon">{icon}</div>
      <div className="onboarding-doc-card-body">
        <div className="onboarding-doc-card-title">{title}</div>
        <div className="onboarding-doc-card-status">
          {busy ? 'קורא את המסמך…' : err ? 'לא נקרא — אפשר למלא ידנית' : doneText ? doneText : hint}
        </div>
      </div>
      <span className="onboarding-doc-card-mark" aria-hidden>
        {busy ? <span className="onboarding-doc-spinner" />
          : state === 'done' ? <CheckCircle size={24} weight="fill" />
          : <UploadSimple size={18} weight="bold" />}
      </span>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
        onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) onFiles(fs); e.target.value = '' }} />
    </button>
  )
}

export function DocumentsStep() {
  const {
    advance,
    aiFillPurchase, purchaseAiBusy, purchaseAiErr, street, city, price, purchasePrice,
    aiFillMortgage, mortgageAiBusy, mortgageAiErr, tracks,
    aiFillLoans, loanAiBusy, loanAiErr, loans,
    aiFillRental, rentalAiBusy, rentalAiErr, companyName, monthlyRent,
  } = useOnboarding()
  const { user, signOut } = useAuth()

  const purchaseDone = (street || city || purchasePrice)
    ? `${[street, city].filter(Boolean).join(', ') || 'נכס'}${price > 0 ? ` · ${formatCurrency(price)}` : ''}`
    : ''
  const mortgageDone = tracks.length ? `${tracks.length} מסלולים זוהו` : ''
  const loansDone = loans.length ? (loans.length === 1 ? 'הלוואה זוהתה' : `${loans.length} הלוואות זוהו`) : ''
  const rentalDone = (companyName || monthlyRent)
    ? `${companyName || 'שוכר'}${monthlyRent ? ` · ₪${formatNum(monthlyRent)}` : ''}`
    : ''

  const anyBusy = purchaseAiBusy || mortgageAiBusy || loanAiBusy || rentalAiBusy

  return (
    <div>
      <div className="onboarding-icon"><House size={40} color="var(--accent)" /></div>
      <h1 className="onboarding-title">המסמכים שלך</h1>
      <p className="onboarding-subtitle">
        יש לכם מסמך? העלו אותו ונמלא את הפרטים אוטומטית — הקריאה רצה ברקע בזמן שתמשיכו.
      </p>

      <div className="onboarding-doc-hint">
        <UploadSimple size={15} weight="bold" />
        <span>הקישו על מסמך כדי להעלות · לא חובה, אפשר גם למלא ידנית</span>
      </div>

      <div className="onboarding-doc-cards">
        <DocCard
          icon={<Tag size={26} weight="duotone" color="var(--accent)" />}
          title="חוזה רכישה" hint="קובץ או צילומי מסך"
          busy={purchaseAiBusy} err={purchaseAiErr} doneText={purchaseDone} onFiles={aiFillPurchase} />
        <DocCard
          icon={<Bank size={26} weight="duotone" color="var(--accent)" />}
          title="אישור משכנתא" hint="קובץ או צילומי מסך מהבנק"
          busy={mortgageAiBusy} err={mortgageAiErr} doneText={mortgageDone} onFiles={aiFillMortgage} />
        <DocCard
          icon={<HandCoins size={26} weight="duotone" color="var(--accent)" />}
          title="הלוואה" hint="מסמך או צילום מסך"
          busy={loanAiBusy} err={loanAiErr} doneText={loansDone} onFiles={aiFillLoans} />
        <DocCard
          icon={<FileText size={26} weight="duotone" color="var(--accent)" />}
          title="חוזה שכירות" hint="קובץ או צילומי מסך"
          busy={rentalAiBusy} err={rentalAiErr} doneText={rentalDone} onFiles={aiFillRental} />
      </div>

      <button type="button" className="btn-onboard-primary onboarding-cta-full" onClick={() => advance('purchase')}>
        {anyBusy ? 'המשך · נמשיך לקרוא ברקע' : 'המשך'}
      </button>

      {/* Sign-out — the documents step is the wizard entry point and has no "back",
          so this is the only way out to the login screen (e.g. wrong account). */}
      <div className="onboarding-signout-row">
        {user?.email && <span>מחובר כ-{user.email}</span>}
        <button type="button" className="onboarding-signout-link" onClick={signOut}>
          <SignOut size={14} /> התנתקות וחזרה לכניסה
        </button>
      </div>
    </div>
  )
}
