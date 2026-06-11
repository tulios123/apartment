import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { uploadDocument } from '../lib/storage'
import { createProperty, createContract } from '../hooks/usePropertyData'
import { createRecurringItem } from '../hooks/useRecurringItems'
import { supabase } from '../lib/supabase'

type Step = 'welcome' | 'purchase' | 'rental' | 'mortgage' | 'insurance' | 'recurring' | 'done'

interface RecurringTemplate {
  key: string
  label: string
  category: string
  executionType: 'automatic' | 'requires_approval'
  dayOfMonth: number
  enabled: boolean
  amount: string
}

const TEMPLATES: Omit<RecurringTemplate, 'enabled' | 'amount'>[] = [
  { key: 'vaad', label: 'ועד בית', category: 'ועד בית', executionType: 'automatic', dayOfMonth: 1 },
]

const STEP_ORDER: Step[] = ['purchase', 'rental', 'mortgage', 'insurance', 'recurring']

const INSURANCE_TYPES = [
  { key: 'building', label: 'מבנה' },
  { key: 'life',     label: 'חיים' },
  { key: 'contents', label: 'תכולה' },
] as const
type InsuranceType = typeof INSURANCE_TYPES[number]['key']

interface Props { onComplete: () => void }

function formatPrice(raw: string) {
  if (!raw) return ''
  return Number(raw).toLocaleString('en-US')
}

export default function Onboarding({ onComplete }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('welcome')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Purchase contract fields
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null)
  const [buyerName, setBuyerName] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [block, setBlock] = useState('')
  const [parcel, setParcel] = useState('')
  const [rooms, setRooms] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [signingDate, setSigningDate] = useState('')
  const [keyDeliveryDate, setKeyDeliveryDate] = useState('')
  const [propertySizeSqm, setPropertySizeSqm] = useState('')
  const [floorNumber, setFloorNumber] = useState('')

  // Rental contract fields
  const [rentalFile, setRentalFile] = useState<File | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [rentPaymentMethod, setRentPaymentMethod] = useState<'check' | 'bank_transfer'>('check')
  const [rentPaymentDay, setRentPaymentDay] = useState('1')
  const [addRentReminder, setAddRentReminder] = useState(false)

  // Mortgage fields
  const [mortgageAmount, setMortgageAmount] = useState('')
  const [mortgageBank, setMortgageBank] = useState('')
  const [mortgageDay, setMortgageDay] = useState('1')
  const [mortgagePaymentMethod, setMortgagePaymentMethod] = useState<'bank_transfer' | 'standing_order'>('standing_order')

  // Insurance fields
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)
  const [insuranceType, setInsuranceType] = useState<InsuranceType>('building')
  const [insuranceAmount, setInsuranceAmount] = useState('')
  const [insuranceCompany, setInsuranceCompany] = useState('')
  const [insuranceDay, setInsuranceDay] = useState('1')

  const [recurring, setRecurring] = useState<RecurringTemplate[]>(
    TEMPLATES.map(t => ({ ...t, enabled: false, amount: '' }))
  )

  const purchaseInputRef = useRef<HTMLInputElement>(null)
  const rentalInputRef = useRef<HTMLInputElement>(null)
  const insuranceInputRef = useRef<HTMLInputElement>(null)

  function next() {
    const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
    if (idx >= 0 && idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1])
  }

  function back() {
    const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
    else setStep('welcome')
  }

  function toggleItem(key: string) {
    setRecurring(r => r.map(i => i.key === key ? { ...i, enabled: !i.enabled } : i))
  }

  function setAmount(key: string, val: string) {
    setRecurring(r => r.map(i => i.key === key ? { ...i, amount: val } : i))
  }

  async function handleFinish() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const address = [street.trim(), city.trim()].filter(Boolean).join(', ') || '—'
      const blockParcel = block && parcel ? `גוש ${block} חלקה ${parcel}` : block || parcel || null

      const property = await createProperty({
        owner_id: user.id,
        address,
        notes: null,
        buyer_name: buyerName.trim() || null,
        block_parcel: blockParcel,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        purchase_date: signingDate || null,
        key_delivery_date: keyDeliveryDate || null,
        property_size_sqm: propertySizeSqm ? parseFloat(propertySizeSqm) : null,
        floor: floorNumber !== '' ? parseInt(floorNumber, 10) : null,
        rooms: rooms !== '' ? parseInt(rooms, 10) : null,
      })

      let contract = null
      if (companyName.trim() && startDate && endDate && monthlyRent) {
        contract = await createContract({
          owner_id: user.id,
          property_id: property.id,
          company_name: companyName.trim(),
          contact_name: contactName.trim() || null,
          contact_phone: contactPhone.trim() || null,
          start_date: startDate,
          end_date: endDate,
          monthly_rent: parseFloat(monthlyRent),
          deposit: null,
          renewal_alert_days: [90, 30],
        })
      }

      if (purchaseFile) {
        const docId = crypto.randomUUID()
        const path = await uploadDocument(purchaseFile, docId)
        await supabase.from('documents').insert({
          id: docId, owner_id: user.id, property_id: property.id,
          contract_id: null, transaction_id: null,
          type: 'purchase_contract', name: purchaseFile.name,
          storage_path: path, date: signingDate || null,
        })
      }

      if (rentalFile && contract) {
        const docId = crypto.randomUUID()
        const path = await uploadDocument(rentalFile, docId)
        await supabase.from('documents').insert({
          id: docId, owner_id: user.id, property_id: property.id,
          contract_id: contract.id, transaction_id: null,
          type: 'rental_contract', name: rentalFile.name,
          storage_path: path, date: startDate || null,
        })
      }

      if (addRentReminder && contract && monthlyRent) {
        await createRecurringItem({
          contract_id: contract.id,
          direction: 'income',
          amount: parseFloat(monthlyRent),
          category: 'שכירות',
          day_of_month: parseInt(rentPaymentDay, 10) || 1,
          start_date: startDate || new Date().toISOString().slice(0, 10),
          end_date: endDate || null,
          payee: companyName.trim() || null,
          execution_type: 'requires_approval',
          payment_method: rentPaymentMethod,
          renewal_alert_days: [90, 30],
        })
      }

      if (mortgageAmount) {
        await createRecurringItem({
          contract_id: contract?.id ?? null,
          direction: 'expense',
          amount: parseFloat(mortgageAmount),
          category: 'משכנתא',
          day_of_month: parseInt(mortgageDay, 10) || 1,
          start_date: startDate || new Date().toISOString().slice(0, 10),
          end_date: endDate || null,
          payee: mortgageBank.trim() || null,
          execution_type: 'requires_approval',
          payment_method: mortgagePaymentMethod,
          renewal_alert_days: [90, 30],
        })
      }

      if (insuranceAmount) {
        const typeLabel = INSURANCE_TYPES.find(t => t.key === insuranceType)?.label ?? 'ביטוח'
        if (insuranceFile) {
          const docId = crypto.randomUUID()
          const path = await uploadDocument(insuranceFile, docId)
          await supabase.from('documents').insert({
            id: docId, owner_id: user.id, property_id: property.id,
            contract_id: null, transaction_id: null,
            type: 'insurance_policy', name: insuranceFile.name,
            storage_path: path, date: null,
          })
        }
        await createRecurringItem({
          contract_id: contract?.id ?? null,
          direction: 'expense',
          amount: parseFloat(insuranceAmount),
          category: `ביטוח ${typeLabel}`,
          day_of_month: parseInt(insuranceDay, 10) || 1,
          start_date: startDate || new Date().toISOString().slice(0, 10),
          end_date: endDate || null,
          payee: insuranceCompany.trim() || null,
          execution_type: 'automatic',
          payment_method: null,
          renewal_alert_days: [90, 30],
        })
      }

      for (const item of recurring.filter(i => i.enabled && i.amount)) {
        await createRecurringItem({
          contract_id: contract?.id ?? null,
          direction: 'expense',
          amount: parseFloat(item.amount),
          category: item.category,
          day_of_month: item.dayOfMonth,
          start_date: startDate || new Date().toISOString().slice(0, 10),
          end_date: endDate || null,
          payee: null,
          execution_type: item.executionType,
          payment_method: null,
          renewal_alert_days: [90, 30],
        })
      }

      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  function fillTestPurchase() {
    setBuyerName('איתי שובי')
    setStreet('הרצל 42')
    setCity('תל אביב')
    setBlock('6660')
    setParcel('12')
    setRooms('3.5')
    setPurchasePrice('1090000')
    setSigningDate('2022-03-15')
    setKeyDeliveryDate('2022-07-01')
    setPropertySizeSqm('85')
    setFloorNumber('4')
  }

  function fillTestRental() {
    setCompanyName('כוח אדם גלובל בע"מ')
    setContactName('יוסי כהן')
    setContactPhone('050-1234567')
    setStartDate('2024-01-01')
    setEndDate('2025-12-31')
    setMonthlyRent('4500')
    setRentPaymentDay('5')
    setAddRentReminder(true)
  }

  function fillTestMortgage() {
    setMortgageAmount('3200')
    setMortgageBank('בנק לאומי')
    setMortgageDay('1')
    setMortgagePaymentMethod('standing_order')
  }

  function fillTestInsurance() {
    setInsuranceType('building')
    setInsuranceAmount('180')
    setInsuranceCompany('הראל')
    setInsuranceDay('1')
  }

  function dots(current: Step) {
    return STEP_ORDER.map((s, i) => {
      const active = STEP_ORDER.indexOf(current)
      const cls = i === active ? 'active' : i < active ? 'done' : ''
      return <span key={s} className={`onboarding-dot ${cls}`} />
    })
  }

  const rentalValid = companyName.trim() && startDate && endDate && monthlyRent

  return (
    <div className="onboarding-wrap">
      <div className="onboarding-card">

        {/* ── Welcome ── */}
        {step === 'welcome' && (
          <form onSubmit={e => { e.preventDefault(); setStep('purchase') }}>
            <div className="onboarding-icon">🏠</div>
            <h1 className="onboarding-title">ברוך הבא!</h1>
            <p className="onboarding-subtitle">
              בואו נגדיר את הנכס שלך בכמה שלבים קצרים.
            </p>
            <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
              <button type="submit" className="btn-onboard-primary">התחל →</button>
            </div>
          </form>
        )}

        {/* ── Purchase ── */}
        {step === 'purchase' && (
          <form onSubmit={e => { e.preventDefault(); next() }}>
            <div className="onboarding-dots">{dots('purchase')}</div>
            <div className="onboarding-icon">🏷️</div>
            <h2 className="onboarding-title">פרטי רכישה</h2>
            <div className="onboarding-form">
              <div className="onboarding-field">
                <label>שם הרוכש</label>
                <input type="text" placeholder="שם מלא" value={buyerName}
                  onChange={e => setBuyerName(e.target.value)} autoFocus />
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>רחוב</label>
                  <input type="text" placeholder="רחוב ומספר" value={street}
                    onChange={e => setStreet(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>עיר</label>
                  <input type="text" placeholder="עיר" value={city}
                    onChange={e => setCity(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>גוש</label>
                  <input type="number" placeholder="0" min="0" value={block}
                    onChange={e => setBlock(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>חלקה</label>
                  <input type="number" placeholder="0" min="0" value={parcel}
                    onChange={e => setParcel(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>שטח (מ&quot;ר)</label>
                  <input type="number" placeholder="0" min="0" value={propertySizeSqm}
                    onChange={e => setPropertySizeSqm(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>קומה</label>
                  <input type="number" placeholder="0" value={floorNumber}
                    onChange={e => setFloorNumber(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>מספר חדרים</label>
                  <input type="number" placeholder="0" min="0" step="0.5" value={rooms}
                    onChange={e => setRooms(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>מחיר רכישה (₪)</label>
                  <input type="text" inputMode="numeric" placeholder="0"
                    value={formatPrice(purchasePrice)}
                    onChange={e => setPurchasePrice(e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>תאריך חתימת חוזה</label>
                  <input type="date" value={signingDate} onChange={e => setSigningDate(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>מסירת מפתח</label>
                  <input type="date" value={keyDeliveryDate} onChange={e => setKeyDeliveryDate(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-file-field" onClick={() => purchaseInputRef.current?.click()}>
                <span className="onboarding-file-label">חוזה רכישה</span>
                <span className="onboarding-file-name">{purchaseFile?.name ?? 'לחץ לבחירת קובץ'}</span>
                <input ref={purchaseInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setPurchaseFile(f) }} />
              </div>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
              <button type="button" className="btn-onboard-skip" onClick={fillTestPurchase}>מלא דוגמה</button>
              <button type="submit" className="btn-onboard-primary">הבא →</button>
            </div>
          </form>
        )}

        {/* ── Rental ── */}
        {step === 'rental' && (
          <form onSubmit={e => { e.preventDefault(); if (rentalValid) next() }}>
            <div className="onboarding-dots">{dots('rental')}</div>
            <div className="onboarding-icon">📄</div>
            <h2 className="onboarding-title">פרטי השכירות</h2>
            <div className="onboarding-form">
              <div className="onboarding-field">
                <label>שם חברה / שוכר</label>
                <input type="text" placeholder="שם החברה או השוכר" value={companyName}
                  onChange={e => setCompanyName(e.target.value)} autoFocus />
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>איש קשר</label>
                  <input type="text" placeholder="שם (אופציונלי)" value={contactName}
                    onChange={e => setContactName(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>טלפון</label>
                  <input type="tel" placeholder="050-..." value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>תאריך התחלה</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>תאריך סיום</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-field">
                <label>שכירות חודשית (₪)</label>
                <input type="number" placeholder="0" value={monthlyRent} min="0"
                  onChange={e => setMonthlyRent(e.target.value)} />
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>אמצעי תשלום</label>
                  <div className="toggle-group">
                    <button type="button"
                      className={`toggle-btn${rentPaymentMethod === 'check' ? ' active' : ''}`}
                      onClick={() => setRentPaymentMethod('check')}>צ'ק</button>
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
                <span>הוסף תזכורת חודשית לאישור קבלת תשלום</span>
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
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
              <button type="button" className="btn-onboard-skip" onClick={fillTestRental}>מלא דוגמה</button>
              <button type="button" className="btn-onboard-skip" onClick={next}>דלג</button>
              <button type="submit" className="btn-onboard-primary" disabled={!rentalValid}>הבא →</button>
            </div>
          </form>
        )}

        {/* ── Mortgage ── */}
        {step === 'mortgage' && (
          <form onSubmit={e => { e.preventDefault(); next() }}>
            <div className="onboarding-dots">{dots('mortgage')}</div>
            <div className="onboarding-icon">🏦</div>
            <h2 className="onboarding-title">משכנתא</h2>
            <div className="onboarding-form">
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>תשלום חודשי (₪)</label>
                  <input type="number" placeholder="0" min="0" value={mortgageAmount}
                    onChange={e => setMortgageAmount(e.target.value)} autoFocus />
                </div>
                <div className="onboarding-field">
                  <label>יום תשלום</label>
                  <input type="number" placeholder="1" min="1" max="28" value={mortgageDay}
                    onChange={e => setMortgageDay(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-field">
                <label>בנק / נמען</label>
                <input type="text" placeholder="שם הבנק (אופציונלי)" value={mortgageBank}
                  onChange={e => setMortgageBank(e.target.value)} />
              </div>
              <div className="onboarding-field">
                <label>אמצעי תשלום</label>
                <div className="toggle-group">
                  <button type="button"
                    className={`toggle-btn${mortgagePaymentMethod === 'standing_order' ? ' active' : ''}`}
                    onClick={() => setMortgagePaymentMethod('standing_order')}>הוראת קבע</button>
                  <button type="button"
                    className={`toggle-btn${mortgagePaymentMethod === 'bank_transfer' ? ' active' : ''}`}
                    onClick={() => setMortgagePaymentMethod('bank_transfer')}>העברה בנקאית</button>
                </div>
              </div>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
              <button type="button" className="btn-onboard-skip" onClick={fillTestMortgage}>מלא דוגמה</button>
              <button type="button" className="btn-onboard-skip" onClick={next}>דלג</button>
              <button type="submit" className="btn-onboard-primary">הבא →</button>
            </div>
          </form>
        )}

        {/* ── Insurance ── */}
        {step === 'insurance' && (
          <form onSubmit={e => { e.preventDefault(); next() }}>
            <div className="onboarding-dots">{dots('insurance')}</div>
            <div className="onboarding-icon">🛡️</div>
            <h2 className="onboarding-title">ביטוח</h2>
            <div className="onboarding-form">
              <div className="onboarding-field">
                <label>סוג ביטוח</label>
                <div className="toggle-group">
                  {INSURANCE_TYPES.map(t => (
                    <button key={t.key} type="button"
                      className={`toggle-btn${insuranceType === t.key ? ' active' : ''}`}
                      onClick={() => setInsuranceType(t.key)}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>פרמיה חודשית (₪)</label>
                  <input type="number" placeholder="0" min="0" value={insuranceAmount}
                    onChange={e => setInsuranceAmount(e.target.value)} autoFocus />
                </div>
                <div className="onboarding-field">
                  <label>יום תשלום</label>
                  <input type="number" placeholder="1" min="1" max="28" value={insuranceDay}
                    onChange={e => setInsuranceDay(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-field">
                <label>חברת ביטוח</label>
                <input type="text" placeholder="שם החברה (אופציונלי)" value={insuranceCompany}
                  onChange={e => setInsuranceCompany(e.target.value)} />
              </div>
              <div className="onboarding-file-field" onClick={() => insuranceInputRef.current?.click()}>
                <span className="onboarding-file-label">פוליסת ביטוח</span>
                <span className="onboarding-file-name">{insuranceFile?.name ?? 'לחץ לבחירת קובץ'}</span>
                <input ref={insuranceInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setInsuranceFile(f) }} />
              </div>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
              <button type="button" className="btn-onboard-skip" onClick={fillTestInsurance}>מלא דוגמה</button>
              <button type="button" className="btn-onboard-skip" onClick={next}>דלג</button>
              <button type="submit" className="btn-onboard-primary">הבא →</button>
            </div>
          </form>
        )}

        {/* ── Recurring (vaad bait + others) ── */}
        {step === 'recurring' && (
          <form onSubmit={e => { e.preventDefault(); handleFinish() }}>
            <div className="onboarding-dots">{dots('recurring')}</div>
            <div className="onboarding-icon">🔄</div>
            <h2 className="onboarding-title">תשלומים קבועים</h2>
            <p className="onboarding-subtitle">אילו הוצאות חוזרות נוספות יש לך?</p>
            <div className="onboarding-recurring-list">
              {recurring.map(item => (
                <div key={item.key}
                  className={`onboarding-recurring-item${item.enabled ? ' on' : ''}`}
                  onClick={() => toggleItem(item.key)}>
                  <div className="onboarding-check">{item.enabled && '✓'}</div>
                  <span className="onboarding-recurring-label">{item.label}</span>
                  <input className="onboarding-recurring-amount" type="number" placeholder="₪"
                    value={item.amount} min="0"
                    onClick={e => e.stopPropagation()}
                    onChange={e => { setAmount(item.key, e.target.value); if (!item.enabled) toggleItem(item.key) }} />
                </div>
              ))}
            </div>
            {error && <p className="onboarding-error">{error}</p>}
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
              <button type="submit" className="btn-onboard-primary" disabled={saving}>
                {saving ? 'שומר...' : 'סיום ✓'}
              </button>
            </div>
          </form>
        )}

        {/* ── Done ── */}
        {step === 'done' && (
          <>
            <div className="onboarding-done-icon">🎉</div>
            <h2 className="onboarding-title">הכל מוכן!</h2>
            <p className="onboarding-subtitle">
              הנכס שלך הוגדר בהצלחה.<br />תוכל לערוך כל פרט בכל עת.
            </p>
            <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-onboard-primary" onClick={onComplete}>למסך הראשי →</button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
