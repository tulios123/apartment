import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { House, Tag, Bank, FileText, HandCoins, SignOut, UploadSimple, CheckCircle, CaretDown, Plus, Paperclip, X } from '@phosphor-icons/react'
import { formatCurrency, formatNum } from './types'
import { useOnboarding } from './context'
import { useAuth } from '../../contexts/AuthContext'

// One upload topic. Empty → tapping picks file(s) and kicks off extraction in the
// background. Once files exist, tapping expands a manage panel: see each file,
// remove it, or add more (each add re-runs extraction on the new file).
function DocCard({ icon, title, hint, busy, err, doneText, files, onFiles, onRemove }: {
  icon: ReactNode; title: string; hint: string
  busy: boolean; err: string | null; doneText: string
  files: File[]; onFiles: (files: File[]) => void; onRemove: (index: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const hasFiles = files.length > 0
  const state = busy ? 'reading' : err ? 'error' : doneText ? 'done' : 'empty'
  const status = busy ? 'קורא את המסמך…'
    : err ? 'לא נקרא — אפשר למלא ידנית'
    : doneText ? doneText
    : hasFiles ? `${files.length} ${files.length === 1 ? 'קובץ הועלה' : 'קבצים הועלו'}`
    : hint
  const pick = () => ref.current?.click()

  return (
    <div className={`onboarding-doc-card-wrap${hasFiles && open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={`onboarding-doc-card is-${state}${hasFiles ? ' has-files' : ''}`}
        onClick={() => { if (busy) return; hasFiles ? setOpen(o => !o) : pick() }}
        disabled={busy}
        aria-expanded={hasFiles ? open : undefined}
      >
        <div className="onboarding-doc-card-icon">{icon}</div>
        <div className="onboarding-doc-card-body">
          <div className="onboarding-doc-card-title">{title}</div>
          <div className="onboarding-doc-card-status">{status}</div>
        </div>
        <span className="onboarding-doc-card-mark" aria-hidden>
          {busy ? <span className="onboarding-doc-spinner" />
            : hasFiles ? <CaretDown size={16} weight="bold" className={`onboarding-doc-caret${open ? ' is-open' : ''}`} />
            : state === 'done' ? <CheckCircle size={24} weight="fill" />
            : <UploadSimple size={18} weight="bold" />}
        </span>
      </button>

      {hasFiles && open && (
        <div className="onboarding-doc-files">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="onboarding-doc-file">
              <Paperclip size={15} weight="bold" />
              <span className="onboarding-doc-file-name">{f.name}</span>
              <button type="button" className="onboarding-doc-file-del" onClick={() => onRemove(i)} aria-label={`הסרת ${f.name}`}>
                <X size={14} weight="bold" />
              </button>
            </div>
          ))}
          <button type="button" className="onboarding-doc-file-add" onClick={pick}>
            <Plus size={15} weight="bold" /> הוספת קובץ
          </button>
        </div>
      )}

      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
        onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) onFiles(fs); e.target.value = '' }} />
    </div>
  )
}

export function DocumentsStep() {
  const {
    advance,
    aiFillPurchase, purchaseAiBusy, purchaseAiErr, street, city, price, purchasePrice,
    aiFillMortgage, mortgageAiBusy, mortgageAiErr, tracks,
    aiFillLoans, loanAiBusy, loanAiErr, loans,
    aiFillRental, rentalAiBusy, rentalAiErr, companyName, monthlyRent,
    purchaseDocFiles, mortgageDocFiles, loanDocFiles, rentalDocFiles, removeDocFile,
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
        <span>הקישו כדי להעלות · ושוב כדי לראות, להוסיף או למחוק קבצים</span>
      </div>

      <div className="onboarding-doc-cards">
        <DocCard
          icon={<Tag size={26} weight="duotone" color="var(--accent)" />}
          title="חוזה רכישה" hint="קובץ או צילומי מסך"
          busy={purchaseAiBusy} err={purchaseAiErr} doneText={purchaseDone}
          files={purchaseDocFiles} onFiles={aiFillPurchase} onRemove={i => removeDocFile('purchase', i)} />
        <DocCard
          icon={<Bank size={26} weight="duotone" color="var(--accent)" />}
          title="אישור משכנתא" hint="קובץ או צילומי מסך מהבנק"
          busy={mortgageAiBusy} err={mortgageAiErr} doneText={mortgageDone}
          files={mortgageDocFiles} onFiles={aiFillMortgage} onRemove={i => removeDocFile('mortgage', i)} />
        <DocCard
          icon={<HandCoins size={26} weight="duotone" color="var(--accent)" />}
          title="הלוואה" hint="מסמך או צילום מסך"
          busy={loanAiBusy} err={loanAiErr} doneText={loansDone}
          files={loanDocFiles} onFiles={aiFillLoans} onRemove={i => removeDocFile('loan', i)} />
        <DocCard
          icon={<FileText size={26} weight="duotone" color="var(--accent)" />}
          title="חוזה שכירות" hint="קובץ או צילומי מסך"
          busy={rentalAiBusy} err={rentalAiErr} doneText={rentalDone}
          files={rentalDocFiles} onFiles={aiFillRental} onRemove={i => removeDocFile('rental', i)} />
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
