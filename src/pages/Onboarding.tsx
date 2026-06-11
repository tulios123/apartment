import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { uploadDocument } from '../lib/storage'
import { createProperty, createContract } from '../hooks/usePropertyData'
import { createRecurringItem } from '../hooks/useRecurringItems'
import { supabase } from '../lib/supabase'

type Step = 'welcome' | 'purchase' | 'rental' | 'done'

const STEP_ORDER: Step[] = ['purchase', 'rental']

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

  // Purchase fields
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

  // Rental fields
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

  const purchaseInputRef = useRef<HTMLInputElement>(null)
  const rentalInputRef = useRef<HTMLInputElement>(null)

  function back() {
    const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
    else setStep('welcome')
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
          category: 'שכר דירה',
          day_of_month: parseInt(rentPaymentDay, 10) || 1,
          start_date: startDate || new Date().toISOString().slice(0, 10),
          end_date: endDate || null,
          payee: companyName.trim() || null,
          execution_type: 'requires_approval',
          payment_method: rentPaymentMethod,
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
          <form onSubmit={e => { e.preventDefault(); setStep('rental') }}>
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
          <form onSubmit={e => { e.preventDefault(); if (rentalValid) handleFinish() }}>
            <div className="onboarding-dots">{dots('rental')}</div>
            <div className="onboarding-icon">📄</div>
            <h2 className="onboarding-title">פרטי השכירות</h2>
            <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף אחר כך</p>
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
            {error && <p className="onboarding-error">{error}</p>}
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
              <button type="button" className="btn-onboard-skip" onClick={fillTestRental}>מלא דוגמה</button>
              <button type="button" className="btn-onboard-skip" onClick={handleFinish} disabled={saving}>דלג</button>
              <button type="submit" className="btn-onboard-primary" disabled={!rentalValid || saving}>
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
              הנכס שלך הוגדר בהצלחה.<br />תוכל להוסיף משכנתא, ביטוח ותשלומים קבועים מתוך האפליקציה.
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
