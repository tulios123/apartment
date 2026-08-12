import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { House, Tag, Bank, FileText, HandCoins, ShieldCheck, SignOut, UploadSimple, CheckCircle, CaretDown, Plus, Paperclip, X, PencilSimple, Check, Eye } from '@phosphor-icons/react'
import { formatCurrency, formatNum } from './types'
import { useOnboarding } from './context'
import type { Attachment } from './useOnboardingState'
import { useAuth } from '../../contexts/AuthContext'
import { redirectToSignedUrl } from '../../lib/storage'

// Preview an attachment. An in-memory File opens straight from an object URL; a stored
// one goes through a signed URL. Both open the tab synchronously inside the click so no
// popup blocker trips — the stored path fills it in once the URL resolves.
function viewAttachment(a: Attachment) {
  if (a.file) {
    const url = URL.createObjectURL(a.file)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  if (a.path) redirectToSignedUrl(window.open('', '_blank'), a.path)
}

// One upload topic. Empty → tapping picks file(s) and kicks off extraction in the
// background. Once files exist, tapping expands a manage panel: see each file,
// remove it, or add more (each add re-runs extraction on the new file).
function DocCard({ icon, title, hint, busy, err, doneText, files, onFiles, onRemove, onRename }: {
  icon: ReactNode; title: string; hint: string
  busy: boolean; err: string | null; doneText: string
  files: Attachment[]; onFiles: (files: File[]) => void; onRemove: (name: string) => void
  onRename: (oldName: string, newName: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const startEdit = (i: number, name: string) => { setEditIdx(i); setDraft(name) }
  const commitEdit = () => { if (editIdx !== null) onRename(files[editIdx].name, draft); setEditIdx(null) }
  const hasFiles = files.length > 0
  // The wizard draft is persisted to localStorage, but File objects can't be
  // serialized — so after a reload (or a manual remove) the extracted DATA comes back
  // while the file itself is gone. The card used to keep its green ✓, so the user
  // believed the document was safely attached; it wasn't, and it would never reach
  // storage on finish. Name that state honestly and invite a re-attach.
  const detached = !hasFiles && !!doneText
  const state = busy ? 'reading' : err ? 'error' : detached ? 'detached' : doneText ? 'done' : 'empty'
  const status = busy ? 'קורא את המסמך…'
    : err ? 'לא נקרא — אפשר למלא ידנית'
    : detached ? `${doneText} · הקובץ עצמו לא מצורף — הקישו לצירוף`
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
              {editIdx === i ? (
                <input
                  className="onboarding-doc-file-edit"
                  value={draft}
                  autoFocus
                  onChange={e => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                    if (e.key === 'Escape') setEditIdx(null)
                  }}
                />
              ) : (
                <span className="onboarding-doc-file-name" onClick={() => startEdit(i, f.name)}>{f.name}</span>
              )}
              {editIdx === i ? (
                <button type="button" className="onboarding-doc-file-del" onMouseDown={e => e.preventDefault()} onClick={commitEdit} aria-label="שמירת שם">
                  <Check size={15} weight="bold" />
                </button>
              ) : (
                <>
                  {/* Actually SEE the uploaded file. It only lives in memory until finish,
                      so preview it straight from the File via an object URL — opened
                      synchronously in the click handler so no popup blocker trips. */}
                  <button type="button" className="onboarding-doc-file-del" onClick={() => viewAttachment(f)} aria-label={`צפייה ב${f.name}`}>
                    <Eye size={14} weight="bold" />
                  </button>
                  <button type="button" className="onboarding-doc-file-del" onClick={() => startEdit(i, f.name)} aria-label={`שינוי שם ${f.name}`}>
                    <PencilSimple size={14} weight="bold" />
                  </button>
                  <button type="button" className="onboarding-doc-file-del" onClick={() => onRemove(f.name)} aria-label={`הסרת ${f.name}`}>
                    <X size={14} weight="bold" />
                  </button>
                </>
              )}
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
    removeDocFile, renameDocFile,
    addInsuranceDocs, docAttachments,
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
          files={docAttachments('purchase')} onFiles={aiFillPurchase} onRemove={name => removeDocFile('purchase', name)} onRename={(oldName, name) => renameDocFile('purchase', oldName, name)} />
        <DocCard
          icon={<Bank size={26} weight="duotone" color="var(--accent)" />}
          title="אישור משכנתא" hint="קובץ או צילומי מסך מהבנק"
          busy={mortgageAiBusy} err={mortgageAiErr} doneText={mortgageDone}
          files={docAttachments('mortgage')} onFiles={aiFillMortgage} onRemove={name => removeDocFile('mortgage', name)} onRename={(oldName, name) => renameDocFile('mortgage', oldName, name)} />
        <DocCard
          icon={<HandCoins size={26} weight="duotone" color="var(--accent)" />}
          title="הלוואה" hint="מסמך או צילום מסך"
          busy={loanAiBusy} err={loanAiErr} doneText={loansDone}
          files={docAttachments('loan')} onFiles={aiFillLoans} onRemove={name => removeDocFile('loan', name)} onRename={(oldName, name) => renameDocFile('loan', oldName, name)} />
        <DocCard
          icon={<FileText size={26} weight="duotone" color="var(--accent)" />}
          title="חוזה שכירות" hint="קובץ או צילומי מסך"
          busy={rentalAiBusy} err={rentalAiErr} doneText={rentalDone}
          files={docAttachments('rental')} onFiles={aiFillRental} onRemove={name => removeDocFile('rental', name)} onRename={(oldName, name) => renameDocFile('rental', oldName, name)} />
        <DocCard
          icon={<ShieldCheck size={26} weight="duotone" color="var(--accent)" />}
          title="פוליסת ביטוח" hint="קובץ או צילומי מסך"
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
