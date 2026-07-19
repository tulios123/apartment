import { useRef, useState } from 'react'
import { FileText, CaretDown } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FillExampleTop } from './FillExampleTop'
import { FinishEarly } from './FinishEarly'
import { DocFileList } from './DocFileList'
import { formatNum } from './types'
import { rentalIssues, rentalGaps, rentalWarnings } from './validation'
import { monthDayISO, parseLocalISO, sanitizeAmountInt } from '../../lib/format'
import { useOnboarding } from './context'
import { DateField } from '../ui/DateField'

export function RentalStep() {
  const {
    advance,
    companyName, setCompanyName, startDate, setStartDate, endDate, setEndDate,
    monthlyRent, setMonthlyRent, rentPaymentMethod, setRentPaymentMethod,
    rentPaymentDay, setRentPaymentDay, addRentReminder, setAddRentReminder,
    rentalAiBusy, rentalAiErr, rentalAiDone, aiFillRental,
    rentalDocFiles, removeDocFile, renameDocFile,
    fillTestRental,
  } = useOnboarding()
  const rentalDocRef = useRef<HTMLInputElement>(null)
  const [showDocs, setShowDocs] = useState(false)

  // Live rules — this step has no save button, so problems show as the user
  // types: an inverted date range / a 0 rent outline their own field, and a
  // partly-filled contract gets a quiet list of what's still needed.
  const draft = { companyName, startDate, endDate, monthlyRent }
  const issues = rentalIssues(draft)
  const issueFor = (f: 'endDate' | 'rent') => issues.find(i => i.field === f)?.message
  const gaps = rentalGaps(draft)
  const warnings = rentalWarnings(draft)

  return (
    <form noValidate onSubmit={e => { e.preventDefault(); advance('insurance') }}>
      <StepHeader current="rental" icon={<FileText size={44} color="var(--accent)" />} title="פרטי השכירות" />
      <FillExampleTop onFill={fillTestRental} />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

      <div className="onboarding-ai-fill">
        <button type="button" className={`btn-onboard-ai${rentalAiDone && !rentalAiBusy ? ' is-done' : ''}`} disabled={rentalAiBusy}
          onClick={() => { if (rentalAiBusy) return; rentalDocFiles.length ? setShowDocs(o => !o) : rentalDocRef.current?.click() }}
          aria-expanded={rentalDocFiles.length ? showDocs : undefined}>
          {rentalAiBusy
            ? 'קורא את החוזה…'
            : rentalDocFiles.length
              ? <>📎 {rentalDocFiles.length} {rentalDocFiles.length === 1 ? 'קובץ הועלה' : 'קבצים הועלו'} — הקישו לצפייה <CaretDown size={15} weight="bold" className={`onboarding-ai-caret${showDocs ? ' is-open' : ''}`} /></>
              : '📄 העלו חוזה שכירות — מילוי אוטומטי'}
        </button>
        <input ref={rentalDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
          onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) aiFillRental(fs); e.target.value = '' }} />
        {showDocs && <DocFileList files={rentalDocFiles} onFiles={aiFillRental} onRemove={i => removeDocFile('rental', i)} onRename={(i, name) => renameDocFile('rental', i, name)} />}
        {rentalAiErr && <p className="onboarding-error" role="alert">{rentalAiErr}</p>}
        <p className="onboarding-subtitle onboarding-optional" style={{ marginTop: 6 }}>אפשר כמה צילומי מסך יחד · או מלאו ידנית למטה</p>
      </div>

      <div className="onboarding-form">
        <div className="onboarding-field">
          <label>שם חברה / שוכר</label>
          <input type="text" placeholder="שם החברה או השוכר" value={companyName}
            onChange={e => setCompanyName(e.target.value)} autoFocus />
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>תאריך התחלה</label>
            <DateField value={startDate} ariaLabel="תאריך התחלה"
              onChange={val => {
                setStartDate(val)
                if (!endDate && val) {
                  const d = parseLocalISO(val)
                  d.setFullYear(d.getFullYear() + 1)
                  d.setDate(d.getDate() - 1)
                  setEndDate(monthDayISO(d))
                }
              }} />
          </div>
          <div className="onboarding-field">
            <label>תאריך סיום</label>
            <DateField value={endDate} onChange={setEndDate} ariaLabel="תאריך סיום"
              className={issueFor('endDate') ? 'input-invalid' : ''} />
            {issueFor('endDate') && <span className="onboarding-field-error" role="alert">{issueFor('endDate')}</span>}
          </div>
        </div>
        <div className="onboarding-field">
          <label>שכר דירה חודשי (₪)</label>
          <input type="text" inputMode="numeric" placeholder="0"
            className={issueFor('rent') ? 'input-invalid' : ''}
            aria-invalid={!!issueFor('rent')}
            value={formatNum(monthlyRent)}
            onChange={e => setMonthlyRent(sanitizeAmountInt(e.target.value))} />
          {issueFor('rent') && <span className="onboarding-field-error" role="alert">{issueFor('rent')}</span>}
          {warnings.map((w, i) => <span key={i} className="onboarding-soft-warning">{w}</span>)}
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>אמצעי תשלום</label>
            <div className="toggle-group">
              <button type="button"
                className={`toggle-btn${rentPaymentMethod === 'check' ? ' active' : ''}`}
                onClick={() => { setRentPaymentMethod('check'); setAddRentReminder(true) }}>צ׳ק</button>
              <button type="button"
                className={`toggle-btn${rentPaymentMethod === 'bank_transfer' ? ' active' : ''}`}
                onClick={() => setRentPaymentMethod('bank_transfer')}>העברה בנקאית</button>
            </div>
          </div>
          <div className="onboarding-field">
            <label>יום תשלום בחודש</label>
            <input type="number" placeholder="1" min="1" max="28" value={rentPaymentDay}
              onChange={e => setRentPaymentDay(e.target.value)} />
          </div>
        </div>
        <label className="onboarding-checkbox-row">
          <input type="checkbox" checked={addRentReminder}
            onChange={e => setAddRentReminder(e.target.checked)} />
          <span>{rentPaymentMethod === 'check'
            ? 'תזכורת חודשית להפקדת הצ׳ק'
            : 'תזכורת חודשית לאישור קבלת תשלום'}</span>
        </label>
      </div>
      {gaps.length > 0 && (
        <p className="onboarding-soft-warning" style={{ marginBottom: 10 }}>
          כדי שהחוזה יישמר צריך גם: {gaps.join(', ')} — אפשר גם להמשיך ולהשלים אחר כך.
        </p>
      )}
      <button type="submit" className="btn-onboard-primary onboarding-cta-full">המשך</button>
      <FinishEarly />
    </form>
  )
}
