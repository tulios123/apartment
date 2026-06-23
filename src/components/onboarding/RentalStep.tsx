import { FileText, ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { StepHeader } from './StepHeader'
import { formatNum } from './types'
import { useOnboarding } from './context'

export function RentalStep() {
  const {
    advance, back,
    companyName, setCompanyName, startDate, setStartDate, endDate, setEndDate,
    monthlyRent, setMonthlyRent, rentPaymentMethod, setRentPaymentMethod,
    rentPaymentDay, setRentPaymentDay, addRentReminder, setAddRentReminder,
    rentalFile, setRentalFile, rentalInputRef,
    showFillExample, fillTestRental,
  } = useOnboarding()

  return (
    <form onSubmit={e => { e.preventDefault(); advance('insurance') }}>
      <StepHeader current="rental" icon={<FileText size={44} color="var(--accent)" />} title="פרטי השכירות" />
      <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>
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
                  setEndDate(d.toISOString().slice(0, 10))
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
      <div className="onboarding-actions">
        <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
        {showFillExample && (
          <button type="button" className="btn-onboard-skip" onClick={fillTestRental}>מלא דוגמה</button>
        )}
        <button type="submit" className="btn-onboard-primary">{(companyName.trim() || monthlyRent) ? 'הבא' : 'דלג'} <ArrowLeft size={16} /></button>
      </div>
    </form>
  )
}
