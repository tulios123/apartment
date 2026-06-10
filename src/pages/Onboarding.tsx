import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { uploadDocument } from '../lib/storage'
import { createProperty, createContract } from '../hooks/usePropertyData'
import { createRecurringItem } from '../hooks/useRecurringItems'
import { supabase } from '../lib/supabase'

type Step = 'welcome' | 'property' | 'purchase' | 'rental' | 'recurring' | 'done'
type DocMode = 'choice' | 'upload' | 'manual'

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
  { key: 'mortgage', label: 'משכנתא', category: 'משכנתא', executionType: 'requires_approval', dayOfMonth: 1 },
  { key: 'insurance', label: 'ביטוח', category: 'ביטוח', executionType: 'automatic', dayOfMonth: 1 },
  { key: 'vaad', label: 'ועד בית', category: 'ועד בית', executionType: 'automatic', dayOfMonth: 1 },
]

const STEP_ORDER: Step[] = ['purchase', 'rental', 'recurring']

const EXTRACTABLE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']

interface Props { onComplete: () => void }

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Onboarding({ onComplete }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('welcome')
  const [purchaseMode, setPurchaseMode] = useState<DocMode>('choice')
  const [rentalMode, setRentalMode] = useState<DocMode>('choice')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Purchase contract fields
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [autoFilled, setAutoFilled] = useState(false)
  const [buyerName, setBuyerName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [blockParcel, setBlockParcel] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
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

  const [recurring, setRecurring] = useState<RecurringTemplate[]>(
    TEMPLATES.map(t => ({ ...t, enabled: false, amount: '' }))
  )

  const purchaseInputRef = useRef<HTMLInputElement>(null)
  const rentalInputRef = useRef<HTMLInputElement>(null)

  function next() {
    const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
    if (idx >= 0 && idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1])
  }

  function back() {
    const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
    if (idx > 0) {
      setStep(STEP_ORDER[idx - 1])
      if (step === 'purchase') setPurchaseMode('choice')
      if (step === 'rental') setRentalMode('choice')
    } else {
      setStep('welcome')
    }
  }

  function toggleItem(key: string) {
    setRecurring(r => r.map(i => i.key === key ? { ...i, enabled: !i.enabled } : i))
  }

  function setAmount(key: string, val: string) {
    setRecurring(r => r.map(i => i.key === key ? { ...i, amount: val } : i))
  }

  async function extractFromContract(file: File) {
    if (!EXTRACTABLE_TYPES.includes(file.type)) return
    setExtracting(true)
    setAutoFilled(false)
    try {
      const fileBase64 = await fileToBase64(file)
      const { data, error: fnErr } = await supabase.functions.invoke('extract-contract', {
        body: { fileBase64, mediaType: file.type },
      })
      if (fnErr) throw fnErr
      if (data?.buyerName) setBuyerName(data.buyerName)
      if (data?.propertyAddress) setPropertyAddress(data.propertyAddress)
      if (data?.blockParcel) setBlockParcel(data.blockParcel)
      if (data?.purchasePrice) setPurchasePrice(String(data.purchasePrice))
      if (data?.purchaseDate) setPurchaseDate(data.purchaseDate)
      if (data?.keyDeliveryDate) setKeyDeliveryDate(data.keyDeliveryDate)
      if (data?.propertySizeSqm) setPropertySizeSqm(String(data.propertySizeSqm))
      if (data?.floor != null) setFloorNumber(String(data.floor))
      const filled = Object.values(data ?? {}).some(v => v != null && v !== '')
      setAutoFilled(filled)
    } catch (e) {
      console.error('Extraction failed:', e)
    } finally {
      setExtracting(false)
    }
  }

  async function handleFinish() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const property = await createProperty({
        owner_id: user.id,
        address: propertyAddress.trim() || '—',
        notes: null,
        buyer_name: buyerName.trim() || null,
        block_parcel: blockParcel.trim() || null,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        purchase_date: purchaseDate || null,
        key_delivery_date: keyDeliveryDate || null,
        property_size_sqm: propertySizeSqm ? parseFloat(propertySizeSqm) : null,
        floor: floorNumber !== '' ? parseInt(floorNumber, 10) : null,
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
          storage_path: path, date: purchaseDate || null,
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
              בואו נגדיר את הנכס שלך ב-3 שלבים קצרים.
              <br />זה ייקח פחות מדקה.
            </p>
            <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
              <button type="submit" className="btn-onboard-primary">התחל →</button>
            </div>
          </form>
        )}

        {/* ── Purchase — choice ── */}
        {step === 'purchase' && purchaseMode === 'choice' && (
          <>
            <div className="onboarding-dots">{dots('purchase')}</div>
            <div className="onboarding-icon">🏷️</div>
            <h2 className="onboarding-title">חוזה רכישה</h2>
            <p className="onboarding-subtitle">יש לך חוזה רכישה של הנכס?</p>
            <div className="choice-grid">
              <div className="choice-card choice-card-left" onClick={() => { setPurchaseMode('upload'); purchaseInputRef.current?.click() }}>
                <span className="choice-icon">📁</span>
                <span className="choice-label">העלה חוזה רכישה</span>
                <input ref={purchaseInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) { setPurchaseFile(f); setPurchaseMode('upload'); extractFromContract(f) }
                  }} />
              </div>
              <div className="choice-card choice-card-sm" onClick={() => setPurchaseMode('manual')}>
                <span className="choice-icon">✏️</span>
                <span className="choice-label">הזן ידנית</span>
              </div>
              <div className="choice-card choice-card-sm choice-card-muted" onClick={() => { setPurchaseMode('choice'); next() }}>
                <span className="choice-label">דלג על חלק זה</span>
              </div>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
            </div>
          </>
        )}

        {/* ── Purchase — upload ── */}
        {step === 'purchase' && purchaseMode === 'upload' && (
          <form onSubmit={e => { e.preventDefault(); next(); setPurchaseMode('choice') }}>
            <div className="onboarding-dots">{dots('purchase')}</div>
            <div className="onboarding-icon">📁</div>
            <h2 className="onboarding-title">חוזה רכישה</h2>

            <div className="onboarding-form">
              {/* File row */}
              <div className="onboarding-field">
                <label>קובץ</label>
                <div className="onboarding-file-row">
                  <span className="onboarding-file-name">{purchaseFile?.name ?? 'לא נבחר קובץ'}</span>
                  <button type="button" className="btn-onboard-skip" onClick={() => purchaseInputRef.current?.click()}>
                    {purchaseFile ? 'החלף' : 'בחר קובץ'}
                  </button>
                  <input ref={purchaseInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setPurchaseFile(f); extractFromContract(f) }
                    }} />
                </div>
              </div>

              {/* Extraction status */}
              {extracting && (
                <div className="onboarding-extracting">
                  <span className="onboarding-extracting-spinner" />
                  מנתח חוזה...
                </div>
              )}

              {!extracting && autoFilled && (
                <div className="onboarding-extract-banner">
                  ✨ פרטים זוהו אוטומטית — בדוק ותקן אם נדרש
                </div>
              )}

              {!extracting && (
                <>
                  <div className="onboarding-field">
                    <label>שם הרוכש</label>
                    <input type="text" placeholder="שם מלא" value={buyerName}
                      onChange={e => setBuyerName(e.target.value)} />
                  </div>

                  <div className="onboarding-field">
                    <label>כתובת הנכס</label>
                    <input type="text" placeholder="רחוב, עיר" value={propertyAddress}
                      onChange={e => setPropertyAddress(e.target.value)} />
                  </div>

                  <div className="onboarding-row">
                    <div className="onboarding-field">
                      <label>גוש חלקה</label>
                      <input type="text" placeholder="גוש X חלקה Y" value={blockParcel}
                        onChange={e => setBlockParcel(e.target.value)} />
                    </div>
                    <div className="onboarding-field">
                      <label>שטח (מ&quot;ר)</label>
                      <input type="number" placeholder="0" min="0" value={propertySizeSqm}
                        onChange={e => setPropertySizeSqm(e.target.value)} />
                    </div>
                  </div>

                  <div className="onboarding-row">
                    <div className="onboarding-field">
                      <label>קומה</label>
                      <input type="number" placeholder="0" value={floorNumber}
                        onChange={e => setFloorNumber(e.target.value)} />
                    </div>
                    <div className="onboarding-field">
                      <label>מחיר רכישה (₪)</label>
                      <input type="number" placeholder="0" min="0" value={purchasePrice}
                        onChange={e => setPurchasePrice(e.target.value)} />
                    </div>
                  </div>

                  <div className="onboarding-row">
                    <div className="onboarding-field">
                      <label>תאריך רכישה</label>
                      <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                    </div>
                    <div className="onboarding-field">
                      <label>מסירת מפתח</label>
                      <input type="date" value={keyDeliveryDate} onChange={e => setKeyDeliveryDate(e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={() => setPurchaseMode('choice')}>← חזור</button>
              <button type="submit" className="btn-onboard-primary" disabled={!purchaseFile || extracting}>
                {extracting ? 'מנתח...' : 'הבא →'}
              </button>
            </div>
          </form>
        )}

        {/* ── Purchase — manual ── */}
        {step === 'purchase' && purchaseMode === 'manual' && (
          <form onSubmit={e => { e.preventDefault(); next(); setPurchaseMode('choice') }}>
            <div className="onboarding-dots">{dots('purchase')}</div>
            <div className="onboarding-icon">✏️</div>
            <h2 className="onboarding-title">פרטי רכישה</h2>
            <div className="onboarding-form">
              <div className="onboarding-field">
                <label>שם הרוכש</label>
                <input type="text" placeholder="שם מלא" value={buyerName}
                  onChange={e => setBuyerName(e.target.value)} autoFocus />
              </div>
              <div className="onboarding-field">
                <label>כתובת הנכס</label>
                <input type="text" placeholder="רחוב, עיר" value={propertyAddress}
                  onChange={e => setPropertyAddress(e.target.value)} />
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>גוש חלקה</label>
                  <input type="text" placeholder="גוש X חלקה Y" value={blockParcel}
                    onChange={e => setBlockParcel(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>שטח (מ&quot;ר)</label>
                  <input type="number" placeholder="0" min="0" value={propertySizeSqm}
                    onChange={e => setPropertySizeSqm(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>קומה</label>
                  <input type="number" placeholder="0" value={floorNumber}
                    onChange={e => setFloorNumber(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>מחיר רכישה (₪)</label>
                  <input type="number" placeholder="0" min="0" value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>תאריך רכישה</label>
                  <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>מסירת מפתח</label>
                  <input type="date" value={keyDeliveryDate} onChange={e => setKeyDeliveryDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={() => setPurchaseMode('choice')}>← חזור</button>
              <button type="submit" className="btn-onboard-primary">הבא →</button>
            </div>
          </form>
        )}

        {/* ── Rental — choice ── */}
        {step === 'rental' && rentalMode === 'choice' && (
          <>
            <div className="onboarding-dots">{dots('rental')}</div>
            <div className="onboarding-icon">📄</div>
            <h2 className="onboarding-title">חוזה שכירות</h2>
            <p className="onboarding-subtitle">יש לך חוזה שכירות פעיל?</p>
            <div className="choice-grid">
              <div className="choice-card choice-card-left" onClick={() => { setRentalMode('upload'); rentalInputRef.current?.click() }}>
                <span className="choice-icon">📁</span>
                <span className="choice-label">העלה חוזה שכירות</span>
                <input ref={rentalInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setRentalFile(f); setRentalMode('upload') } }} />
              </div>
              <div className="choice-card choice-card-sm" onClick={() => setRentalMode('manual')}>
                <span className="choice-icon">✏️</span>
                <span className="choice-label">הזן ידנית</span>
              </div>
              <div className="choice-card choice-card-sm choice-card-muted" onClick={() => { setRentalMode('choice'); next() }}>
                <span className="choice-label">דלג על חלק זה</span>
              </div>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
            </div>
          </>
        )}

        {/* ── Rental — form ── */}
        {step === 'rental' && (rentalMode === 'upload' || rentalMode === 'manual') && (
          <form onSubmit={e => { e.preventDefault(); if (rentalValid) { next(); setRentalMode('choice') } }}>
            <div className="onboarding-dots">{dots('rental')}</div>
            <div className="onboarding-icon">📄</div>
            <h2 className="onboarding-title">פרטי החוזה</h2>
            <div className="onboarding-form">
              {rentalMode === 'upload' && (
                <div className="onboarding-field">
                  <label>קובץ החוזה</label>
                  <div className="onboarding-file-row">
                    <span className="onboarding-file-name">{rentalFile?.name ?? 'לא נבחר קובץ'}</span>
                    <button type="button" className="btn-onboard-skip" onClick={() => rentalInputRef.current?.click()}>
                      {rentalFile ? 'החלף' : 'בחר קובץ'}
                    </button>
                    <input ref={rentalInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) setRentalFile(f) }} />
                  </div>
                </div>
              )}
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
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={() => setRentalMode('choice')}>← חזור</button>
              <button type="submit" className="btn-onboard-primary" disabled={!rentalValid}>הבא →</button>
            </div>
          </form>
        )}

        {/* ── Recurring ── */}
        {step === 'recurring' && (
          <form onSubmit={e => { e.preventDefault(); handleFinish() }}>
            <div className="onboarding-dots">{dots('recurring')}</div>
            <div className="onboarding-icon">🔄</div>
            <h2 className="onboarding-title">תשלומים קבועים</h2>
            <p className="onboarding-subtitle">אילו הוצאות חוזרות יש לך? סמן והזן סכום.</p>
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
