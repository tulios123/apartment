import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { uploadDocument } from '../lib/storage'
import { createProperty, createContract } from '../hooks/usePropertyData'
import { createRecurringItem } from '../hooks/useRecurringItems'
import { ensureMortgage, upsertMortgageTrack } from '../hooks/useMortgageData'
import { upsertInvestmentCost } from '../hooks/useInvestmentData'
import { createInsurancePolicy } from '../hooks/useInsurance'
import { supabase } from '../lib/supabase'
import { monthlyPayment } from '../lib/mortgage'
import { MORTGAGE_TRACK_TYPES } from '../lib/constants'
import type { TrackType } from '../types'

// ── Step types ────────────────────────────────────────────────────────────────
type Step = 'welcome' | 'purchase' | 'mortgage' | 'investment' | 'rental' | 'insurance' | 'done'

const STEP_ORDER: Step[] = ['purchase', 'mortgage', 'investment', 'rental', 'insurance']

interface Props { onComplete: () => void }

// ── Draft types ────────────────────────────────────────────────────────────────
type TrackDraft = {
  track_type: TrackType
  principal: string
  annual_rate: string
  prime_rate: string
  margin: string
  term_months: string
  grace_months: string
  start_date: string
}

type PolicyDraft = {
  type: string
  company: string
  monthly_premium: string
  start_date: string
  end_date: string
}

function emptyTrack(startDate?: string, purchasePrice?: number): TrackDraft {
  const defaultPrincipal = purchasePrice ? String(Math.round(purchasePrice * 0.75)) : ''
  return {
    track_type: 'fixed_unlinked',
    principal: defaultPrincipal,
    annual_rate: '5.000',
    prime_rate: '6.250',
    margin: '-0.500',
    term_months: '360',
    grace_months: '',
    start_date: startDate || new Date().toISOString().slice(0, 10),
  }
}

function emptyPolicy(): PolicyDraft {
  return { type: 'חיים', company: '', monthly_premium: '', start_date: '', end_date: '' }
}

const INS_TYPES = ['מבנה', 'חיים', 'משכנתא', 'תכולה', 'אחר']

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatPrice(raw: string) {
  if (!raw) return ''
  return Number(raw).toLocaleString('en-US')
}

function formatCurrency(n: number) {
  return '₪' + Math.round(n).toLocaleString('he-IL')
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function Onboarding({ onComplete }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('welcome')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Purchase fields ──
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

  // ── Mortgage tracks ──
  const [tracks, setTracks] = useState<TrackDraft[]>([])
  const [trackForm, setTrackForm] = useState<TrackDraft>(emptyTrack())
  const [graceOn, setGraceOn] = useState(false)
  const [expandedTracks, setExpandedTracks] = useState<Set<number>>(new Set())
  const [showTrackForm, setShowTrackForm] = useState(true)

  // ── Investment / equity ──
  const [equityMode, setEquityMode] = useState<'amount' | 'percent'>('amount')
  const [equityValue, setEquityValue] = useState('')
  const [costs, setCosts] = useState({ lawyer: '', brokerage: '', mortgage_advisor: '', investment_company: '' })

  // ── Rental fields ──
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

  // ── Insurance policies ──
  const [policies, setPolicies] = useState<PolicyDraft[]>([])
  const [policyForm, setPolicyForm] = useState<PolicyDraft>(emptyPolicy())

  const purchaseInputRef = useRef<HTMLInputElement>(null)
  const rentalInputRef = useRef<HTMLInputElement>(null)

  // ── Navigation ──────────────────────────────────────────────────────────────
  function back() {
    const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
    else setStep('welcome')
  }

  function advance(next: Step) {
    setError(null)
    setStep(next)
  }

  // ── Derived: equity ─────────────────────────────────────────────────────────
  const price = parseFloat(purchasePrice) || 0
  const equityAmount = equityMode === 'percent'
    ? Math.round(price * (parseFloat(equityValue) || 0) / 100)
    : Math.round(parseFloat(equityValue) || 0)
  const equityPercent = price > 0 ? equityAmount / price * 100 : 0
  const costsTotal = Object.values(costs).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  // ── Derived: mortgage track live preview ─────────────────────────────────────
  function trackEffectiveRate(d: TrackDraft): number {
    return d.track_type === 'prime'
      ? (parseFloat(d.prime_rate) || 6.25) + (parseFloat(d.margin) || -0.5)
      : (parseFloat(d.annual_rate) || 5.0)
  }

  function trackMonthlyPayment(d: TrackDraft): number {
    const p = parseFloat(d.principal) || 0
    const t = parseInt(d.term_months) || 360
    const g = parseInt(d.grace_months) || 0
    const r = trackEffectiveRate(d)
    if (p <= 0) return 0
    return monthlyPayment(p, r, t, g)
  }

  // ── handleFinish ─────────────────────────────────────────────────────────────
  async function handleFinish() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      // 1. Property
      const address = [street.trim(), city.trim()].filter(Boolean).join(', ') || 'הנכס שלי'
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

      // 2. Mortgage tracks
      const pendingTrackValid = (parseFloat(trackForm.principal) || 0) > 0
      const allTracks = [...tracks, ...(pendingTrackValid ? [trackForm] : [])]
      const validTracks = allTracks.filter(d => (parseFloat(d.principal) || 0) > 0)
      if (validTracks.length > 0) {
        const m = await ensureMortgage(user.id, property.id)
        for (const d of validTracks) {
          const effRate = trackEffectiveRate(d)
          await upsertMortgageTrack({
            mortgage_id: m.id,
            owner_id: user.id,
            label: null,
            track_type: d.track_type,
            principal: parseFloat(d.principal) || 0,
            annual_rate: effRate,
            term_months: parseInt(d.term_months) || 0,
            grace_months: parseInt(d.grace_months) || 0,
            start_date: d.start_date,
          })
        }
      }

      // 3. Investment costs
      if (equityAmount > 0) {
        await upsertInvestmentCost({ owner_id: user.id, category: 'self_equity', label: null, amount: equityAmount })
      }
      const costKeys: (keyof typeof costs)[] = ['lawyer', 'brokerage', 'mortgage_advisor', 'investment_company']
      for (const key of costKeys) {
        const val = parseFloat(costs[key]) || 0
        if (val > 0) {
          await upsertInvestmentCost({ owner_id: user.id, category: key, label: null, amount: val })
        }
      }

      // 4. Rental contract
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

      // 5. Insurance policies
      const pendingPolicyValid = policyForm.company.trim() !== '' || policyForm.monthly_premium !== ''
      const allPolicies = [...policies, ...(pendingPolicyValid ? [policyForm] : [])]
      for (const p of allPolicies) {
        if (p.company.trim() || p.monthly_premium) {
          await createInsurancePolicy({
            owner_id: user.id,
            property_id: property.id,
            type: p.type,
            company: p.company.trim() || null,
            policy_number: null,
            monthly_premium: p.monthly_premium ? parseFloat(p.monthly_premium) : null,
            start_date: p.start_date || null,
            end_date: p.end_date || null,
            notes: null,
          })
        }
      }

      // 6. Purchase file
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

      // Rental file
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

      // Recurring rent reminder
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

  // ── DEV fill helpers ─────────────────────────────────────────────────────────
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

  function fillTestMortgage() {
    setTracks([{
      track_type: 'prime',
      principal: '700000',
      annual_rate: '',
      prime_rate: '6.25',
      margin: '-0.5',
      term_months: '300',
      grace_months: '',
      start_date: '2022-07-01',
    }])
  }

  function fillTestInvestment() {
    setEquityMode('percent')
    setEquityValue('25')
    setCosts({ lawyer: '18000', brokerage: '12000', mortgage_advisor: '5000', investment_company: '0' })
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

  function fillTestInsurance() {
    setPolicies([
      { type: 'חיים', company: 'מנורה מבטחים', monthly_premium: '320', start_date: '2022-07-01', end_date: '' },
      { type: 'משכנתא', company: 'הראל', monthly_premium: '180', start_date: '2022-07-01', end_date: '' },
    ])
  }

  // ── Dots renderer ─────────────────────────────────────────────────────────────
  function dots(current: Step) {
    return STEP_ORDER.map((s, i) => {
      const active = STEP_ORDER.indexOf(current as typeof STEP_ORDER[number])
      const cls = i === active ? 'active' : i < active ? 'done' : ''
      return <span key={s} className={`onboarding-dot ${cls}`} />
    })
  }

  const currentStepIndex = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
  const stepTotal = STEP_ORDER.length

  // ── Track helpers ─────────────────────────────────────────────────────────────
  function addTrack() {
    const p = parseFloat(trackForm.principal) || 0
    if (p <= 0) return
    setTracks(prev => [...prev, { ...trackForm }])
    setTrackForm(emptyTrack(keyDeliveryDate || undefined, parseFloat(purchasePrice) || undefined))
    setGraceOn(false)
    setShowTrackForm(false)
  }

  function removeTrack(idx: number) {
    setTracks(prev => prev.filter((_, i) => i !== idx))
  }

  function setTF<K extends keyof TrackDraft>(key: K, val: TrackDraft[K]) {
    setTrackForm(prev => ({ ...prev, [key]: val }))
  }

  // ── Policy helpers ────────────────────────────────────────────────────────────
  function addPolicy() {
    if (!policyForm.company.trim() && !policyForm.monthly_premium) return
    setPolicies(prev => [...prev, { ...policyForm }])
    setPolicyForm(emptyPolicy())
  }

  function removePolicy(idx: number) {
    setPolicies(prev => prev.filter((_, i) => i !== idx))
  }

  function setPF<K extends keyof PolicyDraft>(key: K, val: PolicyDraft[K]) {
    setPolicyForm(prev => ({ ...prev, [key]: val }))
  }

  // ── Track label lookup ────────────────────────────────────────────────────────
  function trackTypeLabel(v: string) {
    return MORTGAGE_TRACK_TYPES.find(t => t.value === v)?.label ?? v
  }

  // ── Totals for mortgage summary ───────────────────────────────────────────────
  const totalPrincipal = tracks.reduce((s, d) => s + (parseFloat(d.principal) || 0), 0)
  const totalMonthly = tracks.reduce((s, d) => s + trackMonthlyPayment(d), 0)
  const hasAnyGrace = tracks.some(d => (parseInt(d.grace_months) || 0) > 0)
  const totalGraceMonthly = hasAnyGrace
    ? tracks.reduce((s, d) => {
        const g = parseInt(d.grace_months) || 0
        const p = parseFloat(d.principal) || 0
        const r = trackEffectiveRate(d) / 100 / 12
        return s + (g > 0 ? p * r : trackMonthlyPayment(d))
      }, 0)
    : 0

  // ── Live preview for current form ─────────────────────────────────────────────
  const previewMonthly = trackMonthlyPayment(trackForm)
  const previewGrace = graceOn && (parseFloat(trackForm.principal) || 0) > 0
    ? (parseFloat(trackForm.principal) || 0) * (trackEffectiveRate(trackForm) / 100 / 12)
    : 0

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="onboarding-wrap">
      <div className="onboarding-card">

        {/* ── Welcome ── */}
        {step === 'welcome' && (
          <form onSubmit={e => { e.preventDefault(); advance('purchase') }}>
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

        {/* ── Step 1: Purchase ── */}
        {step === 'purchase' && (
          <form onSubmit={e => {
            e.preventDefault()
            setTrackForm(emptyTrack(keyDeliveryDate || undefined, parseFloat(purchasePrice) || undefined))
            advance('mortgage')
          }}>
            <div className="onboarding-dots">{dots('purchase')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
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
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestPurchase}>מלא דוגמה</button>
              )}
              <button type="submit" className="btn-onboard-primary">הבא →</button>
            </div>
          </form>
        )}

        {/* ── Step 2: Mortgage ── */}
        {step === 'mortgage' && (
          <form onSubmit={e => { e.preventDefault(); advance('investment') }}>
            <div className="onboarding-dots">{dots('mortgage')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
            <div className="onboarding-icon">🏦</div>
            <h2 className="onboarding-title">משכנתא</h2>
            <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

            {/* Added tracks list */}
            {tracks.length > 0 && (
              <div className="onboarding-list">
                {tracks.map((d, i) => {
                  const isOpen = expandedTracks.has(i)
                  return (
                    <div key={i} className="onboarding-list-row onboarding-list-row--expandable">
                      <div className="onboarding-list-row-header"
                        onClick={() => setExpandedTracks(prev => {
                          const next = new Set(prev)
                          next.has(i) ? next.delete(i) : next.add(i)
                          return next
                        })}>
                        <div className="onboarding-list-row-info">
                          <span className="onboarding-list-row-type">{trackTypeLabel(d.track_type)}</span>
                          <span>קרן {formatCurrency(parseFloat(d.principal) || 0)}</span>
                          <span>{trackEffectiveRate(d).toFixed(2)}%</span>
                          <span>{d.term_months} ח׳</span>
                          {trackMonthlyPayment(d) > 0 && (
                            <span>{formatCurrency(trackMonthlyPayment(d))}/חודש</span>
                          )}
                        </div>
                        <div className="onboarding-list-row-actions">
                          <span className={`inv-collapse-chevron${isOpen ? ' open' : ''}`}>›</span>
                          <button type="button" className="onboarding-list-remove" onClick={e => { e.stopPropagation(); removeTrack(i) }}>✕</button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="onboarding-list-row-detail">
                          <div className="onboarding-list-detail-row"><span>סוג</span><span>{trackTypeLabel(d.track_type)}</span></div>
                          <div className="onboarding-list-detail-row"><span>קרן</span><span>{formatCurrency(parseFloat(d.principal) || 0)}</span></div>
                          <div className="onboarding-list-detail-row"><span>ריבית</span><span>{trackEffectiveRate(d).toFixed(3)}%</span></div>
                          <div className="onboarding-list-detail-row"><span>תקופה</span><span>{d.term_months} חודשים ({(parseInt(d.term_months) / 12).toFixed(0)} שנים)</span></div>
                          <div className="onboarding-list-detail-row"><span>תאריך התחלה</span><span>{d.start_date}</span></div>
                          {(parseInt(d.grace_months) || 0) > 0 && (
                            <div className="onboarding-list-detail-row"><span>גרייס</span><span>{d.grace_months} חודשים</span></div>
                          )}
                          {trackMonthlyPayment(d) > 0 && (
                            <div className="onboarding-list-detail-row"><span>תשלום חודשי</span><strong>{formatCurrency(trackMonthlyPayment(d))}</strong></div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Inline track form — shown on first entry, or when user clicks '+ הוסף מסלול' */}
            {showTrackForm && (
              <div className="onboarding-inline-form">
                <div className="onboarding-field">
                  <label>סוג מסלול</label>
                  <select
                    className="form-input"
                    value={trackForm.track_type}
                    onChange={e => setTF('track_type', e.target.value as TrackType)}
                  >
                    {MORTGAGE_TRACK_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="onboarding-field">
                  <label>קרן (₪)</label>
                  <input type="text" inputMode="numeric" placeholder="0"
                    value={formatPrice(trackForm.principal)}
                    onChange={e => setTF('principal', e.target.value.replace(/\D/g, ''))} />
                </div>
                {trackForm.track_type === 'prime' ? (
                  <div className="onboarding-row">
                    <div className="onboarding-field">
                      <label>ריבית פריים (%)</label>
                      <input type="number" step="0.01" placeholder="6.25" value={trackForm.prime_rate}
                        onChange={e => setTF('prime_rate', e.target.value)} />
                    </div>
                    <div className="onboarding-field">
                      <label>מרווח (%)</label>
                      <input type="number" step="0.01" placeholder="-0.5" value={trackForm.margin}
                        onChange={e => setTF('margin', e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="onboarding-field">
                    <label>ריבית שנתית (%)</label>
                    <input type="number" step="0.01" placeholder="3.5" value={trackForm.annual_rate}
                      onChange={e => setTF('annual_rate', e.target.value)} />
                  </div>
                )}
                <div className="onboarding-row">
                  <div className="onboarding-field">
                    <label>תקופה (חודשים)</label>
                    <input type="number" placeholder="360" min="1" value={trackForm.term_months}
                      onChange={e => setTF('term_months', e.target.value)} />
                  </div>
                  <div className="onboarding-field">
                    <label>תאריך התחלה</label>
                    <input type="date" value={trackForm.start_date}
                      onChange={e => setTF('start_date', e.target.value)} />
                  </div>
                </div>
                <label className="onboarding-checkbox-row">
                  <input type="checkbox" checked={graceOn}
                    onChange={e => {
                      setGraceOn(e.target.checked)
                      setTF('grace_months', e.target.checked ? '12' : '')
                    }} />
                  <span>גרייס (חודשי ריבית בלבד)</span>
                  {graceOn && (
                    <input type="number" min="1" max="24" value={trackForm.grace_months}
                      onChange={e => setTF('grace_months', e.target.value)}
                      style={{ width: 64, marginRight: 8 }}
                      placeholder="12" />
                  )}
                </label>
                {previewMonthly > 0 && (
                  <div className="onboarding-running-total">
                    {graceOn && previewGrace > 0 ? (
                      <>
                        <div>בגרייס: <strong>{formatCurrency(previewGrace)}</strong> / חודש</div>
                        <div>לאחר גרייס: <strong>{formatCurrency(previewMonthly)}</strong> / חודש</div>
                      </>
                    ) : (
                      <div>תשלום חודשי משוער: <strong>{formatCurrency(previewMonthly)}</strong></div>
                    )}
                  </div>
                )}
                <button type="button" className="btn-onboard-primary" style={{ marginTop: 8 }} onClick={addTrack}>
                  שמור מסלול ✓
                </button>
              </div>
            )}

            {/* Add another track button — shown after saving */}
            {!showTrackForm && (
              <button type="button" className="btn-onboard-skip onboarding-add-btn"
                style={{ marginBottom: 16 }}
                onClick={() => {
                  setTrackForm(emptyTrack(keyDeliveryDate || undefined, parseFloat(purchasePrice) || undefined))
                  setGraceOn(false)
                  setShowTrackForm(true)
                }}>
                + הוסף מסלול
              </button>
            )}

            {/* Conclusion totals */}
            {tracks.length > 0 && (
              <div className="onboarding-mortgage-summary">
                <div className="onboarding-list-total">
                  <span>סה״כ קרן</span>
                  <strong>{formatCurrency(totalPrincipal)}</strong>
                </div>
                {hasAnyGrace && totalGraceMonthly > 0 && (
                  <div className="onboarding-list-total">
                    <span>תשלום חודשי בגרייס</span>
                    <strong>{formatCurrency(totalGraceMonthly)}</strong>
                  </div>
                )}
                {totalMonthly > 0 && (
                  <div className="onboarding-list-total">
                    <span>{hasAnyGrace ? 'תשלום חודשי לאחר גרייס' : 'תשלום חודשי'}</span>
                    <strong>{formatCurrency(totalMonthly)}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestMortgage}>מלא דוגמה</button>
              )}
              <button type="submit" className="btn-onboard-primary">הבא →</button>
            </div>
          </form>
        )}

        {/* ── Step 3: Investment / Equity ── */}
        {step === 'investment' && (
          <form onSubmit={e => { e.preventDefault(); advance('rental') }}>
            <div className="onboarding-dots">{dots('investment')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
            <div className="onboarding-icon">💰</div>
            <h2 className="onboarding-title">הון עצמי ועלויות</h2>
            <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>
            <div className="onboarding-form">
              {/* Equity */}
              <div className="onboarding-field">
                <label>הון עצמי</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="toggle-group" style={{ flexShrink: 0 }}>
                    <button type="button" className={`toggle-btn${equityMode === 'amount' ? ' active' : ''}`}
                      onClick={() => setEquityMode('amount')}>₪</button>
                    <button type="button" className={`toggle-btn${equityMode === 'percent' ? ' active' : ''}`}
                      onClick={() => setEquityMode('percent')}>%</button>
                  </div>
                  <input
                    type="number" min="0" step={equityMode === 'percent' ? '0.1' : '1'}
                    placeholder={equityMode === 'percent' ? '25' : '0'}
                    value={equityValue}
                    onChange={e => setEquityValue(e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
                {price > 0 && equityValue && (
                  <p className="onboarding-running-total" style={{ marginTop: 4 }}>
                    {equityMode === 'percent'
                      ? <>= {formatCurrency(equityAmount)} מתוך {formatCurrency(price)}</>
                      : <>= {equityPercent.toFixed(1)}% ממחיר הרכישה</>
                    }
                  </p>
                )}
                {price === 0 && (
                  <p className="onboarding-running-total" style={{ marginTop: 4, opacity: 0.6 }}>
                    הזן מחיר רכישה כדי לחשב אחוז
                  </p>
                )}
              </div>

              {/* Cost fields */}
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>עורך דין (₪)</label>
                  <input type="number" min="0" placeholder="0" value={costs.lawyer}
                    onChange={e => setCosts(c => ({ ...c, lawyer: e.target.value }))} />
                </div>
                <div className="onboarding-field">
                  <label>דמי תיווך (₪)</label>
                  <input type="number" min="0" placeholder="0" value={costs.brokerage}
                    onChange={e => setCosts(c => ({ ...c, brokerage: e.target.value }))} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>יועץ משכנתאות (₪)</label>
                  <input type="number" min="0" placeholder="0" value={costs.mortgage_advisor}
                    onChange={e => setCosts(c => ({ ...c, mortgage_advisor: e.target.value }))} />
                </div>
                <div className="onboarding-field">
                  <label>חברת ליווי השקעה (₪)</label>
                  <input type="number" min="0" placeholder="0" value={costs.investment_company}
                    onChange={e => setCosts(c => ({ ...c, investment_company: e.target.value }))} />
                </div>
              </div>

              {(equityAmount + costsTotal) > 0 && (
                <div className="onboarding-running-total">
                  סה״כ הושקע: <strong>{formatCurrency(equityAmount + costsTotal)}</strong>
                </div>
              )}
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestInvestment}>מלא דוגמה</button>
              )}
              <button type="submit" className="btn-onboard-primary">הבא →</button>
            </div>
          </form>
        )}

        {/* ── Step 4: Rental ── */}
        {step === 'rental' && (
          <form onSubmit={e => { e.preventDefault(); advance('insurance') }}>
            <div className="onboarding-dots">{dots('rental')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
            <div className="onboarding-icon">📄</div>
            <h2 className="onboarding-title">פרטי השכירות</h2>
            <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>
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
                      onClick={() => setRentPaymentMethod('check')}>צ׳ק</button>
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
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestRental}>מלא דוגמה</button>
              )}
              <button type="submit" className="btn-onboard-primary">הבא →</button>
            </div>
          </form>
        )}

        {/* ── Step 5: Insurance ── */}
        {step === 'insurance' && (
          <form onSubmit={e => { e.preventDefault(); handleFinish() }}>
            <div className="onboarding-dots">{dots('insurance')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
            <div className="onboarding-icon">🛡️</div>
            <h2 className="onboarding-title">ביטוחים</h2>
            <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

            {/* Added policies list */}
            {policies.length > 0 && (
              <div className="onboarding-list">
                {policies.map((p, i) => (
                  <div key={i} className="onboarding-list-row">
                    <div className="onboarding-list-row-info">
                      <span className="onboarding-list-row-type">{p.type}</span>
                      {p.company && <span>{p.company}</span>}
                      {p.monthly_premium && <span>{formatCurrency(parseFloat(p.monthly_premium))}/חודש</span>}
                    </div>
                    <button type="button" className="onboarding-list-remove" onClick={() => removePolicy(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline policy form */}
            <div className="onboarding-inline-form">
              <div className="onboarding-field">
                <label>סוג ביטוח</label>
                <div className="toggle-group" style={{ flexWrap: 'wrap' }}>
                  {INS_TYPES.map(t => (
                    <button key={t} type="button"
                      className={`toggle-btn${policyForm.type === t ? ' active' : ''}`}
                      onClick={() => setPF('type', t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>חברת ביטוח</label>
                  <input type="text" placeholder="שם החברה" value={policyForm.company}
                    onChange={e => setPF('company', e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>פרמיה חודשית (₪)</label>
                  <input type="number" min="0" placeholder="0" value={policyForm.monthly_premium}
                    onChange={e => setPF('monthly_premium', e.target.value)} />
                </div>
              </div>
              <div className="onboarding-row">
                <div className="onboarding-field">
                  <label>תחילת כיסוי</label>
                  <input type="date" value={policyForm.start_date}
                    onChange={e => setPF('start_date', e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label>סיום כיסוי</label>
                  <input type="date" value={policyForm.end_date}
                    onChange={e => setPF('end_date', e.target.value)} />
                </div>
              </div>
              <p className="onboarding-running-total" style={{ opacity: 0.65 }}>
                מומלץ: ביטוח חיים + ביטוח משכנתא
              </p>
              <button type="button" className="btn-onboard-skip onboarding-add-btn" onClick={addPolicy}>
                + הוסף פוליסה
              </button>
            </div>

            {error && <p className="onboarding-error">{error}</p>}
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}>← חזור</button>
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestInsurance}>מלא דוגמה</button>
              )}
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
              הנכס שלך הוגדר בהצלחה.<br />תוכל לנהל משכנתא, ביטוח, עלויות ותשלומים קבועים מתוך האפליקציה.
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
