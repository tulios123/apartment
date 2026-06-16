import { House, Tag, Bank, Coins, FileText, ShieldCheck, CheckCircle, Check, ArrowLeft, ArrowRight, X } from '@phosphor-icons/react'
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
import { MORTGAGE_TRACK_TYPES, RENT_CATEGORIES } from '../lib/constants'
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

function emptyTrack(startDate?: string): TrackDraft {
  return {
    track_type: 'fixed_unlinked',
    principal: '',
    annual_rate: '',
    prime_rate: '',
    margin: '',
    term_months: '',
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
  return Number(raw).toLocaleString('he-IL')
}

function formatCurrency(n: number) {
  return '₪' + Math.round(n).toLocaleString('he-IL')
}

function formatNum(raw: string | number): string {
  const str = String(raw)
  if (str === '') return ''
  const n = Number(str)
  return isNaN(n) ? str : n.toLocaleString('he-IL')
}

function defaultLawyerCost(price: number): string {
  return price > 0 ? String(Math.round((price * 0.005 + 1000) * 1.18)) : ''
}

function defaultBrokerageCost(price: number): string {
  return price > 0 ? String(Math.round(price * 0.02 * 1.18)) : ''
}

function defaultSelfEquityPct(): string { return '25' }

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
  const [showTrackForm, setShowTrackForm] = useState(true)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  // ── Investment / equity ──
  const [equityMode, setEquityMode] = useState<'amount' | 'percent'>('percent')
  const [equityValue, setEquityValue] = useState('')
  const [costs, setCosts] = useState({ lawyer: '', brokerage: '', mortgage_advisor: '', investment_company: '' })

  // ── Focused input tracking (for grey-placeholder UX) ──
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  // ── Rental fields ──
  const [rentalFile, setRentalFile] = useState<File | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [rentPaymentMethod, setRentPaymentMethod] = useState<'check' | 'bank_transfer'>('check')
  const [rentPaymentDay, setRentPaymentDay] = useState('1')
  const [addRentReminder, setAddRentReminder] = useState(false)

  // ── Insurance policies ──
  const [policies, setPolicies] = useState<PolicyDraft[]>([])
  const [policyForm, setPolicyForm] = useState<PolicyDraft>(emptyPolicy())
  const [showPolicyForm, setShowPolicyForm] = useState(true)
  const [editingPolicyIdx, setEditingPolicyIdx] = useState<number | null>(null)

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
  // effective = user value if typed, else computed default (grey placeholder)
  const effEquity = equityValue || (equityMode === 'percent'
    ? defaultSelfEquityPct()
    : (price > 0 ? String(Math.round(price * 0.25)) : ''))
  const effLawyer = costs.lawyer || defaultLawyerCost(price)
  const effBrokerage = costs.brokerage || defaultBrokerageCost(price)
  const equityAmount = equityMode === 'percent'
    ? Math.round(price * (parseFloat(effEquity) || 0) / 100)
    : Math.round(parseFloat(effEquity) || 0)
  const equityPercent = price > 0 ? equityAmount / price * 100 : 0
  const costsTotal = (parseFloat(effLawyer) || 0) + (parseFloat(effBrokerage) || 0)
    + (parseFloat(costs.mortgage_advisor) || 0) + (parseFloat(costs.investment_company) || 0)

  // ── Derived: mortgage track live preview ─────────────────────────────────────
  function trackEffectiveRate(d: TrackDraft): number {
    if (d.track_type === 'prime') {
      return (parseFloat(d.prime_rate) || 6.25) + (parseFloat(d.margin) || -0.5)
    }
    if (d.track_type === 'variable') {
      return (parseFloat(d.prime_rate) || 0) + (parseFloat(d.margin) || 0)
    }
    return parseFloat(d.annual_rate) || 5.0
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
    const failures: string[] = []
    try {
      // 1. Property — fatal: if this fails, stay on the step
      const address = [street.trim(), city.trim()].filter(Boolean).join(', ') || 'הנכס שלי'

      const property = await createProperty({
        owner_id: user.id,
        address,
        notes: null,
        buyer_name: buyerName.trim() || null,
        block_parcel: null,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        purchase_date: signingDate || null,
        key_delivery_date: keyDeliveryDate || null,
        property_size_sqm: propertySizeSqm ? parseFloat(propertySizeSqm) : null,
        floor: floorNumber !== '' ? parseInt(floorNumber, 10) : null,
        // NOTE: the DB `rooms` column is currently `integer` (migration 008), so a
        // half-room like 4.5 can't be stored yet. Apply migration 015_rooms_numeric.sql
        // (npx supabase db push) then change this to parseFloat(rooms) for true 4.5.
        rooms: rooms !== '' ? parseInt(rooms, 10) : null,
      })

      // 2. Mortgage tracks — non-fatal
      // Fix 3: only include the inline pending form if the user actually typed a principal
      const normTrack = (d: TrackDraft): TrackDraft => ({
        ...d,
        annual_rate: d.annual_rate || '5.000',
        prime_rate: d.prime_rate || '6.250',
        margin: d.margin || '-0.500',
        term_months: d.term_months || '360',
      })
      const pendingTrackValid = (parseFloat(trackForm.principal) || 0) > 0
      const allTracks = [...tracks]
      if (pendingTrackValid) {
        if (editingIdx !== null) allTracks[editingIdx] = normTrack(trackForm)
        else if (showTrackForm) allTracks.push(normTrack(trackForm))
      }
      const validTracks = allTracks.filter(d => (parseFloat(d.principal) || 0) > 0)
      if (validTracks.length > 0) {
        try {
          const m = await ensureMortgage(user.id, property.id)
          for (const d of validTracks) {
            const effRate = trackEffectiveRate(d)
            const isAnchored = d.track_type === 'prime' || d.track_type === 'variable'
            const primeDefault = d.track_type === 'prime' ? 6.25 : 0
            const marginDefault = d.track_type === 'prime' ? -0.5 : 0
            await upsertMortgageTrack({
              mortgage_id: m.id,
              owner_id: user.id,
              label: null,
              track_type: d.track_type,
              principal: parseFloat(d.principal) || 0,
              annual_rate: effRate,
              prime_rate: isAnchored ? (parseFloat(d.prime_rate) || primeDefault) : null,
              margin: isAnchored ? (parseFloat(d.margin) || marginDefault) : null,
              term_months: parseInt(d.term_months) || 360,
              grace_months: parseInt(d.grace_months) || 0,
              start_date: d.start_date,
            })
          }
        } catch {
          failures.push('משכנתא')
        }
      }

      // 3. Investment costs — non-fatal
      try {
        if (equityAmount > 0) {
          await upsertInvestmentCost({ owner_id: user.id, category: 'self_equity', label: null, amount: equityAmount })
        }
        const effectiveCosts = {
          lawyer: parseFloat(effLawyer) || 0,
          brokerage: parseFloat(effBrokerage) || 0,
          mortgage_advisor: parseFloat(costs.mortgage_advisor) || 0,
          investment_company: parseFloat(costs.investment_company) || 0,
        }
        for (const [key, val] of Object.entries(effectiveCosts) as [keyof typeof costs, number][]) {
          if (val > 0) {
            await upsertInvestmentCost({ owner_id: user.id, category: key, label: null, amount: val })
          }
        }
      } catch {
        failures.push('עלויות השקעה')
      }

      // 4. Rental contract — non-fatal
      let contract = null
      try {
        if (companyName.trim() && startDate && endDate && monthlyRent) {
          contract = await createContract({
            owner_id: user.id,
            property_id: property.id,
            company_name: companyName.trim(),
            contact_name: null,
            contact_phone: null,
            start_date: startDate,
            end_date: endDate,
            monthly_rent: parseFloat(monthlyRent),
            deposit: null,
            payment_method: null,
            requires_approval: false,
            renewal_alert_days: [90, 30],
          })
        }
      } catch {
        failures.push('שכירות')
      }

      // 5. Insurance policies — non-fatal
      try {
        const pendingPolicyValid = policyForm.company.trim() !== '' || policyForm.monthly_premium !== ''
        const allPolicies = [...policies]
        if (pendingPolicyValid) {
          if (editingPolicyIdx !== null) allPolicies[editingPolicyIdx] = policyForm
          else if (showPolicyForm) allPolicies.push(policyForm)
        }
        for (const p of allPolicies) {
          if (p.company.trim() || p.monthly_premium) {
            await createInsurancePolicy({
              owner_id: user.id,
              property_id: property.id,
              type: p.type,
              company: p.company.trim() || null,
              policy_number: null,
              monthly_premium: p.monthly_premium ? parseFloat(p.monthly_premium) : null,
              start_date: p.start_date || keyDeliveryDate || null,
              end_date: p.end_date || null,
              notes: null,
            })
          }
        }
      } catch {
        failures.push('ביטוח')
      }

      // 6. Purchase file — non-fatal
      if (purchaseFile) {
        try {
          const docId = crypto.randomUUID()
          const path = await uploadDocument(purchaseFile, docId)
          await supabase.from('documents').insert({
            id: docId, owner_id: user.id, property_id: property.id,
            contract_id: null, transaction_id: null,
            type: 'purchase_contract', name: purchaseFile.name,
            storage_path: path, date: signingDate || null,
          })
        } catch {
          failures.push('קובץ חוזה רכישה')
        }
      }

      // Rental file — non-fatal
      if (rentalFile && contract) {
        try {
          const docId = crypto.randomUUID()
          const path = await uploadDocument(rentalFile, docId)
          await supabase.from('documents').insert({
            id: docId, owner_id: user.id, property_id: property.id,
            contract_id: contract.id, transaction_id: null,
            type: 'rental_contract', name: rentalFile.name,
            storage_path: path, date: startDate || null,
          })
        } catch {
          failures.push('קובץ חוזה שכירות')
        }
      }

      // Recurring rent reminder — non-fatal
      if (addRentReminder && contract && monthlyRent) {
        try {
          await createRecurringItem({
            contract_id: contract.id,
            direction: 'income',
            amount: parseFloat(monthlyRent),
            category: RENT_CATEGORIES[0],
            day_of_month: parseInt(rentPaymentDay, 10) || 1,
            start_date: startDate || new Date().toISOString().slice(0, 10),
            end_date: endDate || null,
            payee: companyName.trim() || null,
            execution_type: 'requires_approval',
            payment_method: rentPaymentMethod,
            renewal_alert_days: [90, 30],
          })
        } catch {
          failures.push('תזכורת שכירות')
        }
      }

      // Surface partial-save notice if needed, then always complete
      if (failures.length > 0) {
        setError(`חלק מהפרטים לא נשמרו: ${failures.join(', ')} — ניתן להוסיף אותם מתוך האפליקציה`)
      }
      setStep('done')
    } catch (e) {
      // Only createProperty throws here — stay on step so the user can retry
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  // ── DEV fill helpers ─────────────────────────────────────────────────────────
  function fillTestPurchase() {
    setBuyerName('איתי שובי')
    setStreet('בעל שם טוב 21')
    setCity('אשקלון')
    setRooms('4.5')
    setPurchasePrice('1090000')
    setSigningDate('2025-11-25')
    setKeyDeliveryDate('2026-03-11')
    setPropertySizeSqm('105')
    setFloorNumber('3')
  }

  function fillTestMortgage() {
    // Two different tracks (600k + 217.5k) blending to ~4.6% effective
    setTracks([
      {
        track_type: 'fixed_unlinked',
        principal: '600000',
        annual_rate: '4.5',
        prime_rate: '',
        margin: '',
        term_months: '360',
        grace_months: '',
        start_date: '2026-03-11',
      },
      {
        track_type: 'fixed_linked',
        principal: '217500',
        annual_rate: '4.9',
        prime_rate: '',
        margin: '',
        term_months: '360',
        grace_months: '',
        start_date: '2026-03-11',
      },
    ])
  }

  function fillTestInvestment() {
    const p = parseFloat(purchasePrice) || 0
    setEquityMode('percent')
    setEquityValue('25')
    setCosts({
      lawyer: defaultLawyerCost(p) || '18000',
      brokerage: defaultBrokerageCost(p) || '12000',
      mortgage_advisor: '5000',
      investment_company: '0',
    })
  }

  function fillTestRental() {
    setCompanyName('לחומי ניהול נכסים')
    setStartDate('2026-03-11')
    setEndDate('2027-03-11')
    setMonthlyRent('4300')
    setRentPaymentMethod('check')
    setRentPaymentDay('10')
    setAddRentReminder(true)
  }

  function fillTestInsurance() {
    setPolicies([
      { type: 'מבנה', company: 'הראל', monthly_premium: '40', start_date: '2026-03-11', end_date: '' },
      { type: 'חיים', company: 'מגדל', monthly_premium: '30', start_date: '2026-03-11', end_date: '' },
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
  function normalizeTrackDraft(): TrackDraft {
    return {
      ...trackForm,
      principal: trackForm.principal || (price > 0 ? String(Math.round(price * 0.75)) : ''),
      annual_rate: trackForm.annual_rate || '5.000',
      prime_rate: trackForm.prime_rate || '6.250',
      margin: trackForm.margin || '-0.500',
      term_months: trackForm.term_months || '360',
    }
  }

  function addTrack() {
    const p = parseFloat(trackForm.principal) || (price > 0 ? Math.round(price * 0.75) : 0)
    if (p <= 0) return
    setTracks(prev => [...prev, normalizeTrackDraft()])
    setTrackForm(emptyTrack(keyDeliveryDate || undefined))
    setGraceOn(false)
    setShowTrackForm(false)
  }

  function saveTrackEdit(idx: number) {
    setTracks(prev => prev.map((t, i) => i === idx ? normalizeTrackDraft() : t))
    setEditingIdx(null)
  }

  function saveCurrentAndOpenNew() {
    const p = parseFloat(trackForm.principal) || (price > 0 ? Math.round(price * 0.75) : 0)
    if (p > 0) {
      if (editingIdx !== null) {
        setTracks(prev => prev.map((t, i) => i === editingIdx ? normalizeTrackDraft() : t))
      } else {
        setTracks(prev => [...prev, normalizeTrackDraft()])
      }
    }
    setEditingIdx(null)
    setTrackForm(emptyTrack(keyDeliveryDate || undefined))
    setGraceOn(false)
    setShowTrackForm(true)
  }

  function removeTrack(idx: number) {
    setTracks(prev => prev.filter((_, i) => i !== idx))
  }

  function setTF<K extends keyof TrackDraft>(key: K, val: TrackDraft[K]) {
    setTrackForm(prev => ({ ...prev, [key]: val }))
  }

  // ── Policy helpers ────────────────────────────────────────────────────────────
  function normalizePolicyDraft(): PolicyDraft {
    return { ...policyForm, start_date: policyForm.start_date || keyDeliveryDate }
  }

  function addPolicy() {
    if (!policyForm.company.trim() && !policyForm.monthly_premium) return
    setPolicies(prev => [...prev, normalizePolicyDraft()])
    setPolicyForm(emptyPolicy())
    setShowPolicyForm(false)
  }

  function savePolicyEdit(idx: number) {
    setPolicies(prev => prev.map((p, i) => i === idx ? normalizePolicyDraft() : p))
    setEditingPolicyIdx(null)
  }

  function savePolicyAndOpenNew() {
    if (policyForm.company.trim() || policyForm.monthly_premium) {
      if (editingPolicyIdx !== null) {
        setPolicies(prev => prev.map((p, i) => i === editingPolicyIdx ? normalizePolicyDraft() : p))
      } else {
        setPolicies(prev => [...prev, normalizePolicyDraft()])
      }
    }
    setEditingPolicyIdx(null)
    setPolicyForm(emptyPolicy())
    setShowPolicyForm(true)
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

  // ── Live preview for current form (uses defaults when fields are empty) ──────
  const effectiveTrackForm: TrackDraft = {
    ...trackForm,
    principal: trackForm.principal || (price > 0 ? String(Math.round(price * 0.75)) : ''),
    annual_rate: trackForm.annual_rate || '5.000',
    prime_rate: trackForm.prime_rate || (trackForm.track_type === 'prime' ? '6.250' : '3.500'),
    margin: trackForm.margin || (trackForm.track_type === 'prime' ? '-0.500' : '1.500'),
    term_months: trackForm.term_months || '360',
  }
  const previewMonthly = trackMonthlyPayment(effectiveTrackForm)
  const previewGrace = graceOn && (parseFloat(effectiveTrackForm.principal) || 0) > 0
    ? (parseFloat(effectiveTrackForm.principal) || 0) * (trackEffectiveRate(effectiveTrackForm) / 100 / 12)
    : 0

  // ── Track form renderer ───────────────────────────────────────────────────────
  function renderTrackForm(onSave: () => void, onCancel: () => void) {
    const principalDefault = price > 0 ? String(Math.round(price * 0.75)) : ''
    const primeDefault = trackForm.track_type === 'prime' ? '6.250' : '3.500'
    const marginDefault = trackForm.track_type === 'prime' ? '-0.500' : '1.500'
    const ph = (id: string, val: string, def: string) => ({
      className: !val && !!def && focusedInput !== id ? 'input-ph-grey' : '',
      value: focusedInput === id ? val : (val || def),
      onFocus: () => setFocusedInput(id),
      onBlur: () => setFocusedInput(null),
    })
    return (
      <div className="onboarding-inline-form">
        <div className="onboarding-field">
          <label>סוג מסלול</label>
          <select className="form-input" value={trackForm.track_type}
            onChange={e => setTF('track_type', e.target.value as TrackType)}>
            {MORTGAGE_TRACK_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="onboarding-field">
          <label>קרן (₪)</label>
          <input type="text" inputMode="numeric"
            {...ph('tf.principal', trackForm.principal, principalDefault)}
            value={focusedInput === 'tf.principal'
              ? formatNum(trackForm.principal)
              : formatNum(trackForm.principal || principalDefault)}
            onChange={e => setTF('principal', e.target.value.replace(/\D/g, ''))} />
        </div>
        {(trackForm.track_type === 'prime' || trackForm.track_type === 'variable') ? (
          <div className="onboarding-row">
            <div className="onboarding-field">
              <label>{trackForm.track_type === 'prime' ? 'ריבית פריים (%)' : 'עוגן (%)'}</label>
              <input type="number" step="0.01"
                {...ph('tf.prime_rate', trackForm.prime_rate, primeDefault)}
                onChange={e => setTF('prime_rate', e.target.value)} />
            </div>
            <div className="onboarding-field">
              <label>מרווח (%)</label>
              <input type="number" step="0.01"
                {...ph('tf.margin', trackForm.margin, marginDefault)}
                onChange={e => setTF('margin', e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="onboarding-field">
            <label>ריבית שנתית (%)</label>
            <input type="number" step="0.01"
              {...ph('tf.annual_rate', trackForm.annual_rate, '5.000')}
              onChange={e => setTF('annual_rate', e.target.value)} />
          </div>
        )}
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>תקופה (חודשים)</label>
            <input type="number" min="1"
              {...ph('tf.term', trackForm.term_months, '360')}
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
              dir="ltr"
              style={{ width: 64, marginRight: 8, textAlign: 'center' }}
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
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn-onboard-skip" onClick={onCancel}>ביטול</button>
          <button type="button" className="btn-onboard-primary" onClick={onSave}>שמור מסלול <Check size={14} weight="bold" /></button>
        </div>
      </div>
    )
  }

  // ── Policy form renderer ──────────────────────────────────────────────────────
  function renderPolicyForm(onSave: () => void, onCancel: () => void) {
    return (
      <div className="onboarding-inline-form">
        <div className="onboarding-field">
          <label>סוג ביטוח</label>
          <select className="form-input" value={policyForm.type}
            onChange={e => setPF('type', e.target.value)}>
            {INS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>חברת ביטוח</label>
            <input type="text" placeholder="שם החברה" value={policyForm.company}
              onChange={e => setPF('company', e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label>פרמיה חודשית (₪)</label>
            <input type="text" inputMode="numeric" placeholder="0"
              value={formatNum(policyForm.monthly_premium)}
              onChange={e => setPF('monthly_premium', e.target.value.replace(/[^\d]/g, ''))} />
          </div>
        </div>
        <div className="onboarding-row">
          <div className="onboarding-field">
            <label>תחילת כיסוי</label>
            <input type="date" value={policyForm.start_date || keyDeliveryDate}
              onChange={e => setPF('start_date', e.target.value)} />
          </div>
          <div className="onboarding-field">
            <label>סיום כיסוי</label>
            <input type="date" value={policyForm.end_date}
              onChange={e => setPF('end_date', e.target.value)} />
          </div>
        </div>
        <p className="onboarding-running-total" style={{ opacity: 0.65 }}>
          הבנק דורש בדרך כלל ביטוח מבנה + ביטוח חיים
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn-onboard-skip" onClick={onCancel}>ביטול</button>
          <button type="button" className="btn-onboard-primary" onClick={onSave}>שמור פוליסה <Check size={14} weight="bold" /></button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="onboarding-wrap">
      <div className="onboarding-card">

        {/* ── Welcome ── */}
        {step === 'welcome' && (
          <form onSubmit={e => { e.preventDefault(); advance('purchase') }}>
            <div className="onboarding-icon"><House size={44} color="var(--accent)" /></div>
            <h1 className="onboarding-title">ברוך הבא!</h1>
            <p className="onboarding-subtitle">
              בואו נגדיר את הנכס שלך בכמה שלבים קצרים.
            </p>
            <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
              <button type="submit" className="btn-onboard-primary">התחל <ArrowLeft size={16} /></button>
            </div>
          </form>
        )}

        {/* ── Step 1: Purchase ── */}
        {step === 'purchase' && (
          <form onSubmit={e => {
            e.preventDefault()
            setTrackForm(emptyTrack(keyDeliveryDate || undefined))
            advance('mortgage')
          }}>
            <div className="onboarding-dots">{dots('purchase')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
            <div className="onboarding-icon"><Tag size={44} color="var(--accent)" /></div>
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
              <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestPurchase}>מלא דוגמה</button>
              )}
              <button type="submit" className="btn-onboard-primary">הבא <ArrowLeft size={16} /></button>
            </div>
          </form>
        )}

        {/* ── Step 2: Mortgage ── */}
        {step === 'mortgage' && (
          <form onSubmit={e => { e.preventDefault(); advance('investment') }}>
            <div className="onboarding-dots">{dots('mortgage')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
            <div className="onboarding-icon"><Bank size={44} color="var(--accent)" /></div>
            <h2 className="onboarding-title">משכנתא</h2>
            <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

            {/* Saved tracks list — click header to toggle edit in-place */}
            {tracks.length > 0 && (
              <div className="onboarding-list">
                {tracks.map((d, i) => {
                  const monthly = trackMonthlyPayment(d)
                  const graceMonthly = (parseInt(d.grace_months) || 0) > 0
                    ? (parseFloat(d.principal) || 0) * (trackEffectiveRate(d) / 100 / 12)
                    : 0
                  const isEditing = editingIdx === i
                  return (
                    <div key={i} className="onboarding-list-row onboarding-list-row--expandable">
                      <div className="onboarding-list-row-header"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (isEditing) {
                            setEditingIdx(null)
                          } else {
                            setEditingIdx(i)
                            setTrackForm({ ...d })
                            setGraceOn((parseInt(d.grace_months) || 0) > 0)
                            setShowTrackForm(false)
                          }
                        }}>
                        <div className="onboarding-track-summary">
                          <div className="onboarding-track-summary-top">
                            <span className="onboarding-list-row-type">{trackTypeLabel(d.track_type)}</span>
                            <span className="onboarding-track-payment">
                              {graceMonthly > 0
                                ? <>{formatCurrency(graceMonthly)} <span className="text-muted">/ {formatCurrency(monthly)}</span></>
                                : formatCurrency(monthly)
                              }
                              <span className="text-muted"> / חודש</span>
                            </span>
                          </div>
                          <div className="onboarding-track-summary-sub">
                            <span>קרן {formatCurrency(parseFloat(d.principal) || 0)}</span>
                            <span>·</span>
                            <span>{trackEffectiveRate(d).toFixed(2)}%</span>
                            <span>·</span>
                            <span>{d.term_months} ח׳</span>
                            {(parseInt(d.grace_months) || 0) > 0 && <><span>·</span><span>גרייס {d.grace_months} ח׳</span></>}
                          </div>
                        </div>
                        <div className="onboarding-list-row-actions">
                          <button type="button" className="onboarding-list-remove" onClick={e => { e.stopPropagation(); removeTrack(i) }} aria-label="מחיקה" title="מחיקה"><X size={16} /></button>
                        </div>
                      </div>
                      {isEditing && renderTrackForm(() => saveTrackEdit(i), () => setEditingIdx(null))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Inline track form for new track */}
            {showTrackForm && renderTrackForm(addTrack, () => setShowTrackForm(false))}

            {/* Add track button — always shown */}
            <button type="button" className="btn-onboard-skip onboarding-add-btn"
              style={{ marginBottom: 16 }}
              onClick={() => {
                if (showTrackForm || editingIdx !== null) {
                  saveCurrentAndOpenNew()
                } else {
                  setTrackForm(emptyTrack(keyDeliveryDate || undefined))
                  setGraceOn(false)
                  setShowTrackForm(true)
                  setEditingIdx(null)
                }
              }}>
              + הוסף מסלול
            </button>

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
              <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestMortgage}>מלא דוגמה</button>
              )}
              <button type="submit" className="btn-onboard-primary">הבא <ArrowLeft size={16} /></button>
            </div>
          </form>
        )}

        {/* ── Step 3: Investment / Equity ── */}
        {step === 'investment' && (
          <form onSubmit={e => { e.preventDefault(); advance('rental') }}>
            <div className="onboarding-dots">{dots('investment')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
            <div className="onboarding-icon"><Coins size={44} color="var(--accent)" /></div>
            <h2 className="onboarding-title">הון עצמי ועלויות</h2>
            <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>
            <div className="onboarding-form">
              {/* Equity */}
              <div className="onboarding-field">
                <label>הון עצמי</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="toggle-group" style={{ flexShrink: 0 }}>
                    <button type="button" className={`toggle-btn${equityMode === 'amount' ? ' active' : ''}`}
                      onClick={() => { setEquityMode('amount'); setEquityValue('') }}>₪</button>
                    <button type="button" className={`toggle-btn${equityMode === 'percent' ? ' active' : ''}`}
                      onClick={() => { setEquityMode('percent'); setEquityValue('') }}>%</button>
                  </div>
                  {(() => {
                    const eqDefRaw = equityMode === 'percent'
                      ? defaultSelfEquityPct()
                      : (price > 0 ? String(Math.round(price * 0.25)) : '')
                    const isGrey = !equityValue && !!eqDefRaw && focusedInput !== 'equity'
                    if (equityMode === 'amount') {
                      const displayVal = focusedInput === 'equity'
                        ? formatNum(equityValue)
                        : formatNum(equityValue || eqDefRaw)
                      return (
                        <input
                          type="text" inputMode="numeric"
                          className={isGrey ? 'input-ph-grey' : ''}
                          value={displayVal}
                          onFocus={() => setFocusedInput('equity')}
                          onBlur={() => setFocusedInput(null)}
                          onChange={e => setEquityValue(e.target.value.replace(/\D/g, ''))}
                          style={{ flex: 1 }}
                        />
                      )
                    }
                    return (
                      <input
                        type="number" min="0" step="0.1"
                        className={isGrey ? 'input-ph-grey' : ''}
                        value={focusedInput === 'equity' ? equityValue : (equityValue || eqDefRaw)}
                        onFocus={() => { setFocusedInput('equity'); if (!equityValue) setEquityValue('0') }}
                        onBlur={() => setFocusedInput(null)}
                        onChange={e => setEquityValue(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    )
                  })()}
                </div>
                {price > 0 && (
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
              {(() => {
                const lawyerDef = defaultLawyerCost(price)
                const brokerageDef = defaultBrokerageCost(price)
                const inp = (id: string, val: string, def: string, onChange: (v: string) => void) => ({
                  type: 'text' as const,
                  inputMode: 'numeric' as const,
                  className: !val && !!def && focusedInput !== id ? 'input-ph-grey' : '',
                  value: focusedInput === id ? formatNum(val) : formatNum(val || def),
                  onFocus: () => setFocusedInput(id),
                  onBlur: () => setFocusedInput(null),
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value.replace(/[^\d]/g, '')),
                })
                return (
                  <>
                    <div className="onboarding-row">
                      <div className="onboarding-field">
                        <label>עורך דין (₪)</label>
                        <input {...inp('c.lawyer', costs.lawyer, lawyerDef, v => setCosts(c => ({ ...c, lawyer: v })))} />
                        <span className="onboarding-field-hint">0.5% + ₪1,000 + מע"מ 18%</span>
                      </div>
                      <div className="onboarding-field">
                        <label>דמי תיווך (₪)</label>
                        <input {...inp('c.brokerage', costs.brokerage, brokerageDef, v => setCosts(c => ({ ...c, brokerage: v })))} />
                        <span className="onboarding-field-hint">2% + מע"מ 18%</span>
                      </div>
                    </div>
                    <div className="onboarding-row">
                      <div className="onboarding-field">
                        <label>יועץ משכנתאות (₪)</label>
                        <input type="text" inputMode="numeric" placeholder="0"
                          value={formatNum(costs.mortgage_advisor)}
                          onChange={e => setCosts(c => ({ ...c, mortgage_advisor: e.target.value.replace(/[^\d]/g, '') }))} />
                      </div>
                      <div className="onboarding-field">
                        <label>חברת ליווי השקעה (₪)</label>
                        <input type="text" inputMode="numeric" placeholder="0"
                          value={formatNum(costs.investment_company)}
                          onChange={e => setCosts(c => ({ ...c, investment_company: e.target.value.replace(/[^\d]/g, '') }))} />
                      </div>
                    </div>
                  </>
                )
              })()}

              {(equityAmount + costsTotal) > 0 && (
                <div className="onboarding-running-total">
                  סה״כ הושקע: <strong>{formatCurrency(equityAmount + costsTotal)}</strong>
                </div>
              )}
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestInvestment}>מלא דוגמה</button>
              )}
              <button type="submit" className="btn-onboard-primary">הבא <ArrowLeft size={16} /></button>
            </div>
          </form>
        )}

        {/* ── Step 4: Rental ── */}
        {step === 'rental' && (
          <form onSubmit={e => { e.preventDefault(); advance('insurance') }}>
            <div className="onboarding-dots">{dots('rental')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
            <div className="onboarding-icon"><FileText size={44} color="var(--accent)" /></div>
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
                  <label>תאריך התחלה</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
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
              <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestRental}>מלא דוגמה</button>
              )}
              <button type="submit" className="btn-onboard-primary">הבא <ArrowLeft size={16} /></button>
            </div>
          </form>
        )}

        {/* ── Step 5: Insurance ── */}
        {step === 'insurance' && (
          <form onSubmit={e => { e.preventDefault(); handleFinish() }}>
            <div className="onboarding-dots">{dots('insurance')}</div>
            <p className="onboarding-step-count">שלב {currentStepIndex + 1} מתוך {stepTotal}</p>
            <div className="onboarding-icon"><ShieldCheck size={44} color="var(--accent)" /></div>
            <h2 className="onboarding-title">ביטוחים</h2>
            <p className="onboarding-subtitle onboarding-optional">אופציונלי — ניתן להוסיף גם אחר כך</p>

            {/* Saved policies list — click header to toggle edit in-place */}
            {policies.length > 0 && (
              <div className="onboarding-list">
                {policies.map((p, i) => {
                  const premium = parseFloat(p.monthly_premium) || 0
                  const isEditing = editingPolicyIdx === i
                  return (
                    <div key={i} className="onboarding-list-row onboarding-list-row--expandable">
                      <div className="onboarding-list-row-header"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (isEditing) {
                            setEditingPolicyIdx(null)
                          } else {
                            setEditingPolicyIdx(i)
                            setPolicyForm({ ...p })
                            setShowPolicyForm(false)
                          }
                        }}>
                        <div className="onboarding-track-summary">
                          <div className="onboarding-track-summary-top">
                            <span className="onboarding-list-row-type">{p.type}</span>
                            <span className="onboarding-track-payment">
                              {premium > 0 ? formatCurrency(premium) : <span className="text-muted">—</span>}
                              <span className="text-muted"> / חודש</span>
                            </span>
                          </div>
                          {(p.company || p.start_date) && (
                            <div className="onboarding-track-summary-sub">
                              {p.company && <span>{p.company}</span>}
                              {p.company && p.start_date && <span>·</span>}
                              {p.start_date && <span>מ-{p.start_date}</span>}
                            </div>
                          )}
                        </div>
                        <div className="onboarding-list-row-actions">
                          <button type="button" className="onboarding-list-remove" onClick={e => { e.stopPropagation(); removePolicy(i) }} aria-label="מחיקה" title="מחיקה"><X size={16} /></button>
                        </div>
                      </div>
                      {isEditing && renderPolicyForm(() => savePolicyEdit(i), () => setEditingPolicyIdx(null))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Inline new-policy form */}
            {showPolicyForm && renderPolicyForm(addPolicy, () => setShowPolicyForm(false))}

            {/* Add policy button — always shown */}
            <button type="button" className="btn-onboard-skip onboarding-add-btn"
              style={{ marginBottom: 16 }}
              onClick={() => {
                if (showPolicyForm || editingPolicyIdx !== null) {
                  savePolicyAndOpenNew()
                } else {
                  setPolicyForm(emptyPolicy())
                  setShowPolicyForm(true)
                  setEditingPolicyIdx(null)
                }
              }}>
              + הוסף פוליסה
            </button>

            {/* Monthly total */}
            {policies.length > 0 && (
              <div className="onboarding-mortgage-summary">
                <div className="onboarding-list-total">
                  <span>סה״כ פרמיה חודשית</span>
                  <strong>{formatCurrency(policies.reduce((s, p) => s + (parseFloat(p.monthly_premium) || 0), 0))}</strong>
                </div>
              </div>
            )}

            {error && <p className="onboarding-error" role="alert">{error}</p>}
            <div className="onboarding-actions">
              <button type="button" className="btn-onboard-skip" onClick={back}><ArrowRight size={16} /> חזור</button>
              {import.meta.env.DEV && (
                <button type="button" className="btn-onboard-skip" onClick={fillTestInsurance}>מלא דוגמה</button>
              )}
              <button type="submit" className="btn-onboard-primary" disabled={saving}>
                {saving ? 'שומר...' : <><span>סיום</span><Check size={14} weight="bold" /></> }
              </button>
            </div>
          </form>
        )}

        {/* ── Done ── */}
        {step === 'done' && (
          <>
            <div className="onboarding-done-icon"><CheckCircle weight="fill" size={64} color="var(--success)" /></div>
            <h2 className="onboarding-title">הכל מוכן!</h2>
            <p className="onboarding-subtitle">
              הנכס שלך הוגדר בהצלחה.<br />תוכל לנהל משכנתא, ביטוח, עלויות ותשלומים קבועים מתוך האפליקציה.
            </p>
            {error && <p className="onboarding-error" role="alert" style={{ textAlign: 'center' }}>{error}</p>}
            <div className="onboarding-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-onboard-primary" onClick={() => { window.history.replaceState(null, '', '/'); onComplete() }}>למסך הראשי <ArrowLeft size={16} /></button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
