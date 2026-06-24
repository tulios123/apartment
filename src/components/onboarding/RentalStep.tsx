import { useRef } from 'react'
import { FileText } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { FillExampleTop } from './FillExampleTop'
import { FinishEarly } from './FinishEarly'
import { formatNum } from './types'
import { monthDayISO } from '../../lib/format'
import { useOnboarding } from './context'

export function RentalStep() {
  const {
    advance,
    companyName, setCompanyName, startDate, setStartDate, endDate, setEndDate,
    monthlyRent, setMonthlyRent, rentPaymentMethod, setRentPaymentMethod,
    rentPaymentDay, setRentPaymentDay, addRentReminder, setAddRentReminder,
    rentalFile, setRentalFile, rentalInputRef,
    rentalAiBusy, rentalAiErr, rentalAiDone, aiFillRental,
    fillTestRental,
  } = useOnboarding()
  const rentalDocRef = useRef<HTMLInputElement>(null)

  return (
    <form onSubmit={e => { e.preventDefault(); advance('insurance') }}>
      <StepHeader current="rental" icon={<FileText size={44} color="var(--accent)" />} title="פרטי השכירות" />
      <FillExampleTop onFill={fillTestRental} />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

      <div className="onboarding-ai-fill">
        <button type="button" className={`btn-onboard-ai${rentalAiDone && !rentalAiBusy ? ' is-done' : ''}`} disabled={rentalAiBusy}
          onClick={() => rentalDocRef.current?.click()}>
          {rentalAiBusy
            ? 'קורא את החוזה…'
            : rentalAiDone
              ? '✓ החוזה נקרא — בדקו למטה · לחצו להעלאה מחדש'
              : '📄 העלו חוזה שכירות — מילוי אוטומטי'}
        </button>
        <input ref={rentalDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style={{ display: 'none' }}
          onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) aiFillRental(fs); e.target.value = '' }} />
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
            <input type="date" value={startDate}
              onChange={e => {
                const val = e.target.value
                setStartDate(val)
                if (!endDate && val) {
                  const d = new Date(val)
                  d.setFullYear(d.getFullYear() + 1)
                  d.setDate(d.getDate() - 1)
                  setEndDate(monthDayISO(d))
                }
              }} />
          </div>
          <div className="onboarding-field">
            <label>תאריך סיום</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="onboarding-field">
          <label>שכר דירה חודשי (₪)</label>
          <input type="text" inputMode="numeric" placeholder="0"
            value={formatNum(monthlyRent)}
            onChange={e => setMonthlyRent(e.target.value.replace(/[^\d]/g, ''))} />
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
        <div className="onboarding-file-field" onClick={() => rentalInputRef.current?.click()}>
          <span className="onboarding-file-label">חוזה שכירות</span>
          <span className="onboarding-file-name">{rentalFile?.name ?? 'לחץ לבחירת קובץ'}</span>
          <input ref={rentalInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setRentalFile(f) }} />
        </div>
      </div>
      <button type="submit" className="btn-onboard-primary onboarding-cta-full">הבא</button>
      <FinishEarly />
    </form>
  )
}
