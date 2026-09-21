import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { House, Tag, Bank, FileText, HandCoins, ShieldCheck, SignOut, UploadSimple, CheckCircle, CaretDown, Certificate, Question } from '@phosphor-icons/react'
import { formatCurrency, formatNum } from './types'
import { useOnboarding } from './context'
import type { Attachment } from './useOnboardingState'
import { useAuth } from '../../contexts/AuthContext'
import { checklistSlots } from '../../lib/documentChecklist'
import type { DocumentType } from '../../types'
import { DocFileList } from './DocFileList'

// One upload topic. Empty → tapping picks file(s) and kicks off extraction in the
// background. Once files exist, tapping expands a manage panel: see each file,
// remove it, or add more (each add re-runs extraction on the new file).
function DocCard({ icon, title, hint, busy, err, doneText, files, onFiles, onRemove, onRename, example, showExample, extracts = true }: {
  icon: ReactNode; title: string; hint: string
  busy: boolean; err: string | null; doneText: string
  files: Attachment[]; onFiles: (files: File[]) => void; onRemove: (name: string) => void
  onRename: (oldName: string, newName: string) => void
  /**
   * What the document looks like (Omer, note 1: "הייתי מוסיף (?) ליד כל מסמך ולהציג
   * דוגמה שלו"). Revealed by one control above the list rather than a (?) per card:
   * the card IS a button, and a second button inside it is interactive content nested
   * in interactive content — invalid, and on a phone two targets that close together
   * are one target. One tap explains all six.
   */
  example?: string
  /** Whether the parent's "מה כל מסמך?" toggle is currently on. */
  showExample?: boolean
  /** False for the documents that are filed as-is and never read. Omer, note 12. */
  extracts?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const hasFiles = files.length > 0
  // The wizard draft is persisted to localStorage, but File objects can't be
  // serialized — so after a reload (or a manual remove) the extracted DATA comes back
  // while the file itself is gone. The card used to keep its green ✓, so the user
  // believed the document was safely attached; it wasn't, and it would never reach
  // storage on finish. Name that state honestly and invite a re-attach.
  const detached = !hasFiles && !!doneText
  const state = busy ? 'reading' : err ? 'error' : detached ? 'detached' : doneText ? 'done' : 'empty'
  /**
   * The insurance policy and the tabu extract are filed, not read — nothing is extracted
   * from them. Their card nevertheless said "1 קובץ הועלה" and stopped, which is exactly
   * what the READING cards beside it say on their way to a green tick, so Omer read it as
   * "the policy was recognised" and it never had been (note 12). A stated limit is not a
   * failure; a silence that looks like success is.
   */
  const status = busy ? 'קורא את המסמך…'
    : err ? 'לא נקרא — אפשר למלא ידנית'
    : detached ? `${doneText} · הקובץ עצמו לא מצורף — הקישו לצירוף`
    : doneText ? doneText
    : hasFiles ? `${files.length} ${files.length === 1 ? 'קובץ נשמר' : 'קבצים נשמרו'}${extracts ? '' : ' · לא נקרא אוטומטית'}`
    : extracts ? hint : `${hint} · נשמר לתיק בלבד`
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

      {/* One shared attachment list everywhere (owner, 26.07): the documents step and
          each section's own upload area render the SAME rows — same icons, same order,
          same actions. This block used to be a near-copy of DocFileList, and the two
          drifted every time one was fixed, which is where the last round of bugs came
          from. The containers still differ (checklist here, form-filler there) because
          they do different jobs; only the parts are unified. */}
      {showExample && example && <p className="onboarding-doc-example">{example}</p>}

      {hasFiles && open && (
        <DocFileList files={files} onFiles={onFiles} onRemove={onRemove} onRename={onRename} />
      )}

      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
        onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) onFiles(fs); e.target.value = '' }} />
    </div>
  )
}

export function DocumentsStep() {
  // One switch for the whole list — see the note on DocCard's `example`.
  const [explain, setExplain] = useState(false)
  const {
    advance,
    aiFillPurchase, purchaseAiBusy, purchaseAiErr, street, city, price, purchasePrice,
    aiFillMortgage, mortgageAiBusy, mortgageAiErr, tracks,
    aiFillLoans, loanAiBusy, loanAiErr, loans,
    aiFillRental, rentalAiBusy, rentalAiErr, companyName, monthlyRent,
    removeDocFile, renameDocFile,
    addInsuranceDocs, addTabuDocs, docAttachments,
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

  // The (?) text and the "is this one read automatically?" flag come from the same list
  // the Documents screen uses — one place to change a document's description.
  const slot = (t: DocumentType) => {
    const s = checklistSlots('wizard').find(x => x.type === t)
    return { example: s?.example, extracts: s?.extracts ?? true, showExample: explain }
  }

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

      {/* Omer, note 1. This is the first moment the app asks for something from the real
          world, and the names alone assume you can already tell an אישור משכנתא from a
          מסמך הלוואה. One tap describes all six. */}
      <button type="button" className="onboarding-doc-explain" aria-expanded={explain}
        onClick={() => setExplain(v => !v)}>
        <Question size={14} weight="bold" />
        {explain ? 'הסתר את ההסברים' : 'מה כל מסמך? הסבר קצר לכל אחד'}
      </button>

      <div className="onboarding-doc-cards">
        <DocCard
          icon={<Tag size={26} weight="duotone" color="var(--accent)" />}
          title="חוזה רכישה" hint="קובץ או צילומי מסך" {...slot('purchase_contract')}
          busy={purchaseAiBusy} err={purchaseAiErr} doneText={purchaseDone}
          files={docAttachments('purchase')} onFiles={aiFillPurchase} onRemove={name => removeDocFile('purchase', name)} onRename={(oldName, name) => renameDocFile('purchase', oldName, name)} />
        {/* נסח טאבו — the Documents screen has always expected it and the wizard never
            asked, so an account could finish the wizard and open Documents at 1/6 on a
            document it had never heard of (Omer, note 14). One list now, from
            lib/documentChecklist; nothing here is required. */}
        <DocCard
          icon={<Certificate size={26} weight="duotone" color="var(--accent)" />}
          title="נסח טאבו" hint="אישור הבעלות מהטאבו" {...slot('tabu_extract')}
          busy={false} err={null} doneText=""
          files={docAttachments('tabu')} onFiles={addTabuDocs} onRemove={name => removeDocFile('tabu', name)} onRename={(oldName, name) => renameDocFile('tabu', oldName, name)} />
        <DocCard
          icon={<Bank size={26} weight="duotone" color="var(--accent)" />}
          title="אישור משכנתא" hint="קובץ או צילומי מסך מהבנק" {...slot('mortgage_statement')}
          busy={mortgageAiBusy} err={mortgageAiErr} doneText={mortgageDone}
          files={docAttachments('mortgage')} onFiles={aiFillMortgage} onRemove={name => removeDocFile('mortgage', name)} onRename={(oldName, name) => renameDocFile('mortgage', oldName, name)} />
        <DocCard
          icon={<HandCoins size={26} weight="duotone" color="var(--accent)" />}
          title="הלוואה" hint="מסמך או צילום מסך" {...slot('loan_statement')}
          busy={loanAiBusy} err={loanAiErr} doneText={loansDone}
          files={docAttachments('loan')} onFiles={aiFillLoans} onRemove={name => removeDocFile('loan', name)} onRename={(oldName, name) => renameDocFile('loan', oldName, name)} />
        <DocCard
          icon={<FileText size={26} weight="duotone" color="var(--accent)" />}
          title="חוזה שכירות" hint="קובץ או צילומי מסך" {...slot('rental_contract')}
          busy={rentalAiBusy} err={rentalAiErr} doneText={rentalDone}
          files={docAttachments('rental')} onFiles={aiFillRental} onRemove={name => removeDocFile('rental', name)} onRename={(oldName, name) => renameDocFile('rental', oldName, name)} />
        <DocCard
          icon={<ShieldCheck size={26} weight="duotone" color="var(--accent)" />}
          title="פוליסת ביטוח" hint="קובץ או צילומי מסך" {...slot('insurance_policy')}
          busy={false} err={null} doneText=""
          files={docAttachments('insurance')} onFiles={addInsuranceDocs} onRemove={name => removeDocFile('insurance', name)} onRename={(oldName, name) => renameDocFile('insurance', oldName, name)} />
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
