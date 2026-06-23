import { useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { uploadDocument } from '../../lib/storage'
import { createProperty, createContract } from '../../hooks/usePropertyData'
import { syncRentRecurringItem } from '../../hooks/useRecurringItems'
import { ensureMortgage, upsertMortgageTrack } from '../../hooks/useMortgageData'
import { upsertLoan } from '../../hooks/useLoansData'
import { upsertInvestmentCost } from '../../hooks/useInvestmentData'
import { createInsurancePolicy } from '../../hooks/useInsurance'
import { supabase } from '../../lib/supabase'
import { enablePush } from '../../lib/push'
import { monthlyPayment } from '../../lib/mortgage'
import { MORTGAGE_TRACK_TYPES } from '../../lib/constants'
import type { TrackType, LoanRepaymentType, Contract } from '../../types'
import {
  STEP_ORDER, TRACK_TYPES,
  emptyTrack, emptyPolicy, emptyLoan,
  defaultLawyerCost, defaultBrokerageCost, defaultSelfEquityPct,
} from './types'
import type { Step, TrackDraft, PolicyDraft, LoanDraft, ExtraCost } from './types'

// The wizard's entire brain: all state, derived values and mutations. Steps and
// form components read this through OnboardingContext, so the shared type stays
// inferred (ReturnType) rather than a hand-maintained 90-field interface.
export function useOnboardingState(onComplete: () => void) {
  const { user } = useAuth()
  // "מלא דוגמה" buttons: shown in local dev and for the dev@test.local manager
  // account (so onboarding can be filled quickly when testing on the live app).
  const showFillExample = import.meta.env.DEV || user?.email === 'dev@test.local'
  const [step, setStep] = useState<Step>('welcome')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notifOn, setNotifOn] = useState(false)
  const [notifBusy, setNotifBusy] = useState(false)

  async function enableNotifications() {
    if (!user) return
    setNotifBusy(true)
    try {
      await enablePush(user.id)
      setNotifOn(true)
    } catch {
      // Permission denied or unsupported — leave the prompt as-is.
    } finally {
      setNotifBusy(false)
    }
  }

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
  const [equityMode, setEquityMode] = useState<'amount' | 'percent'>('amount')
  const [equityValue, setEquityValue] = useState('')
  const [costs, setCosts] = useState({ lawyer: '', brokerage: '', mortgage_advisor: '', investment_company: '' })
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([])

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

  // ── Loans ──
  const [loans, setLoans] = useState<LoanDraft[]>([])
  // Balloon loan (interest-free, repaid only on sale — e.g. from family). Entered
  // in the investment/equity step since it offsets self-equity, not a monthly debt.
  const [balloonAmount, setBalloonAmount] = useState('')
  const [balloonLender, setBalloonLender] = useState('')
  const [loanForm, setLoanForm] = useState<LoanDraft>(emptyLoan())
  const [loanGraceOn, setLoanGraceOn] = useState(false)
  const [showLoanForm, setShowLoanForm] = useState(true)
  const [editingLoanIdx, setEditingLoanIdx] = useState<number | null>(null)

  const purchaseInputRef = useRef<HTMLInputElement>(null)
  const rentalInputRef = useRef<HTMLInputElement>(null)
  const mortgageDocRef = useRef<HTMLInputElement>(null)
  const [mortgageAiBusy, setMortgageAiBusy] = useState(false)
  const [mortgageAiErr, setMortgageAiErr] = useState<string | null>(null)
  const [purchaseAiBusy, setPurchaseAiBusy] = useState(false)
  const [purchaseAiErr, setPurchaseAiErr] = useState<string | null>(null)
  const [rentalAiBusy, setRentalAiBusy] = useState(false)
  const [rentalAiErr, setRentalAiErr] = useState<string | null>(null)

  // ── Navigation ──────────────────────────────────────────────────────────────
  function dismissKeyboardAndScrollTop() {
    ;(document.activeElement as HTMLElement)?.blur()
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  function back() {
    dismissKeyboardAndScrollTop()
    const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
    else setStep('welcome')
  }

  function advance(next: Step) {
    dismissKeyboardAndScrollTop()
    setError(null)
    setStep(next)
  }

  // ── Derived: equity ─────────────────────────────────────────────────────────
  const price = parseFloat(purchasePrice) || 0
  // Equity is what's left of the price after all financing — derive it from the
  // mortgage + loans already entered, rather than guessing a flat percentage.
  const totalMortgagePrincipal = tracks.reduce((s, t) => s + (parseFloat(t.principal) || 0), 0)
  const totalLoanPrincipal = loans.reduce((s, l) => s + (parseFloat(l.principal) || 0), 0)
  const derivedEquityAmount = Math.max(0, price - totalMortgagePrincipal - totalLoanPrincipal - (parseFloat(balloonAmount) || 0))
  // effective = user value if typed, else the derived default (grey placeholder)
  const effEquity = equityValue || (equityMode === 'percent'
    ? defaultSelfEquityPct()
    : (derivedEquityAmount > 0 ? String(derivedEquityAmount) : ''))
  const effLawyer = costs.lawyer || defaultLawyerCost(price)
  const effBrokerage = costs.brokerage || defaultBrokerageCost(price)
  const equityAmount = equityMode === 'percent'
    ? Math.round(price * (parseFloat(effEquity) || 0) / 100)
    : Math.round(parseFloat(effEquity) || 0)
  const equityPercent = price > 0 ? equityAmount / price * 100 : 0
  const costsTotal = (parseFloat(effLawyer) || 0) + (parseFloat(effBrokerage) || 0)
    + (parseFloat(costs.mortgage_advisor) || 0) + (parseFloat(costs.investment_company) || 0)
    + extraCosts.reduce((s, ec) => s + (parseFloat(ec.amount) || 0), 0)

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

  // Effective annual rate for a loan draft — anchor + margin for prime/variable
  // ("prime minus" = negative margin), otherwise the plain fixed rate. No magic
  // defaults: an empty anchored loan reads as 0, mirroring the liabilities editor.
  function loanDraftRate(d: LoanDraft): number {
    if (d.track_type === 'prime' || d.track_type === 'variable') {
      return (parseFloat(d.prime_rate) || 0) + (parseFloat(d.margin) || 0)
    }
    return parseFloat(d.annual_rate) || 0
  }

  // ── AI mortgage fill ─────────────────────────────────────────────────────────
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve((r.result as string).split(',')[1] ?? '')
      r.onerror = () => reject(new Error('read failed'))
      r.readAsDataURL(file)
    })
  }

  // Content-addressed cache of the AI extraction so re-uploading the same bank
  // document doesn't re-hit (re-charge) the model — the second pass is free and
  // instant, which makes testing the mapping/UI cheap. FNV-1a 32-bit over the
  // base64; different bytes → different key → a fresh call.
  function hashString(s: string): string {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return (h >>> 0).toString(36)
  }

  async function aiFillMortgage(file: File) {
    setMortgageAiBusy(true)
    setMortgageAiErr(null)
    try {
      const fileBase64 = await fileToBase64(file)
      // Version the key so improving the extraction (model/prompt) invalidates stale cached
      // results for the same file. Bump v2→v3… whenever the edge function's output changes.
      const cacheKey = `apt_extract_mortgage_v2_${hashString(fileBase64)}`
      let data: { tracks?: Record<string, unknown>[] } | null = null
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try { data = JSON.parse(cached) } catch { /* corrupt cache → re-fetch */ }
      }
      if (!data) {
        const res = await supabase.functions.invoke('extract-mortgage', {
          body: { fileBase64, mediaType: file.type },
        })
        if (res.error) throw res.error
        data = res.data
        try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* quota — skip caching */ }
      }
      const raw = (data?.tracks ?? []) as Record<string, unknown>[]
      const mapped: TrackDraft[] = raw
        .filter(t => (Number(t.principal) || 0) > 0)
        .map(t => ({
          track_type: (TRACK_TYPES.includes(t.track_type as TrackType) ? t.track_type : 'fixed_unlinked') as TrackType,
          principal: t.principal != null ? String(t.principal) : '',
          annual_rate: t.annual_rate != null ? String(t.annual_rate) : '',
          prime_rate: t.prime_rate != null ? String(t.prime_rate) : '',
          margin: t.margin != null ? String(t.margin) : '',
          term_months: t.term_months != null ? String(t.term_months) : '',
          grace_months: t.grace_months != null ? String(t.grace_months) : '',
          start_date: keyDeliveryDate || new Date().toISOString().slice(0, 10),
        }))
      if (mapped.length === 0) {
        setMortgageAiErr('לא זוהו מסלולים במסמך — נסו קובץ ברור יותר או הזינו ידנית.')
        return
      }
      setTracks(mapped)
      setShowTrackForm(false)
      setEditingIdx(null)
    } catch {
      setMortgageAiErr('לא הצלחנו לקרוא את המסמך — נסו שוב או הזינו ידנית.')
    } finally {
      setMortgageAiBusy(false)
    }
  }

  // ── AI fill: purchase contract → property fields ─────────────────────────────
  async function aiFillPurchase(file: File) {
    setPurchaseFile(file)
    setPurchaseAiBusy(true)
    setPurchaseAiErr(null)
    try {
      const fileBase64 = await fileToBase64(file)
      const cacheKey = `apt_extract_purchase_v1_${hashString(fileBase64)}`
      let data: Record<string, unknown> | null = null
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try { data = JSON.parse(cached) } catch { /* corrupt cache → re-fetch */ }
      }
      if (!data) {
        const res = await supabase.functions.invoke('extract-contract', {
          body: { fileBase64, mediaType: file.type },
        })
        if (res.error) throw res.error
        data = res.data
        try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* quota — skip caching */ }
      }
      const d = data ?? {}
      if (d.buyerName) setBuyerName(String(d.buyerName))
      if (d.propertyAddress) {
        const addr = String(d.propertyAddress)
        const ci = addr.lastIndexOf(',')
        if (ci > 0) { setStreet(addr.slice(0, ci).trim()); setCity(addr.slice(ci + 1).trim()) }
        else setStreet(addr)
      }
      if (d.purchasePrice != null) setPurchasePrice(String(d.purchasePrice))
      if (d.purchaseDate) setSigningDate(String(d.purchaseDate))
      if (d.keyDeliveryDate) setKeyDeliveryDate(String(d.keyDeliveryDate))
      if (d.propertySizeSqm != null) setPropertySizeSqm(String(d.propertySizeSqm))
      if (d.floor != null) setFloorNumber(String(d.floor))
      if (d.rooms != null) setRooms(String(d.rooms))
    } catch {
      setPurchaseAiErr('לא הצלחנו לקרוא את החוזה — נסו שוב או מלאו ידנית.')
    } finally {
      setPurchaseAiBusy(false)
    }
  }

  // ── AI fill: rental agreement → rental fields ────────────────────────────────
  async function aiFillRental(file: File) {
    setRentalFile(file)
    setRentalAiBusy(true)
    setRentalAiErr(null)
    try {
      const fileBase64 = await fileToBase64(file)
      const cacheKey = `apt_extract_rental_v1_${hashString(fileBase64)}`
      let data: Record<string, unknown> | null = null
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try { data = JSON.parse(cached) } catch { /* corrupt cache → re-fetch */ }
      }
      if (!data) {
        const res = await supabase.functions.invoke('extract-rental', {
          body: { fileBase64, mediaType: file.type },
        })
        if (res.error) throw res.error
        data = res.data
        try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* quota — skip caching */ }
      }
      const d = data ?? {}
      if (d.tenantName) setCompanyName(String(d.tenantName))
      if (d.startDate) setStartDate(String(d.startDate))
      if (d.endDate) setEndDate(String(d.endDate))
      if (d.monthlyRent != null) setMonthlyRent(String(d.monthlyRent))
      if (d.paymentMethod === 'check') { setRentPaymentMethod('check'); setAddRentReminder(true) }
      else if (d.paymentMethod === 'bank_transfer') setRentPaymentMethod('bank_transfer')
      if (d.paymentDay != null) setRentPaymentDay(String(d.paymentDay))
    } catch {
      setRentalAiErr('לא הצלחנו לקרוא את החוזה — נסו שוב או מלאו ידנית.')
    } finally {
      setRentalAiBusy(false)
    }
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
        rooms: rooms !== '' ? parseInt(rooms, 10) : null,
      })

      // Normalise track/loan data once before fanning out
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

      const pendingLoanValid = (parseFloat(loanForm.principal) || 0) > 0
      const allLoans = [...loans]
      if (pendingLoanValid) {
        if (editingLoanIdx !== null) allLoans[editingLoanIdx] = normalizeLoanDraft()
        else if (showLoanForm) allLoans.push(normalizeLoanDraft())
      }

      const pendingPolicyValid = policyForm.company.trim() !== '' || policyForm.monthly_premium !== ''
      const allPolicies = [...policies]
      if (pendingPolicyValid) {
        if (editingPolicyIdx !== null) allPolicies[editingPolicyIdx] = policyForm
        else if (showPolicyForm) allPolicies.push(policyForm)
      }

      // 2-6. Fan out all non-fatal operations in parallel after property is created
      let contract: Awaited<ReturnType<typeof createContract>> | null = null

      await Promise.all([
        // Mortgage tracks
        (async () => {
          if (validTracks.length === 0) return
          try {
            const m = await ensureMortgage(user.id, property.id)
            await Promise.all(validTracks.map(d => {
              const effRate = trackEffectiveRate(d)
              const isAnchored = d.track_type === 'prime' || d.track_type === 'variable'
              const primeDefault = d.track_type === 'prime' ? 6.25 : 0
              const marginDefault = d.track_type === 'prime' ? -0.5 : 0
              return upsertMortgageTrack({
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
            }))
          } catch {
            failures.push('משכנתא')
          }
        })(),

        // Loans (monthly) + the balloon loan from the investment step
        (async () => {
          try {
            const loanWrites = allLoans
              .filter(d => (parseFloat(d.principal) || 0) > 0)
              .map(d => {
                const isMonthly = d.repayment_type === 'monthly_fixed'
                const anchored = isMonthly && (d.track_type === 'prime' || d.track_type === 'variable')
                // Prime/variable: effective rate = anchor + margin (margin can be negative).
                const effRate = anchored
                  ? (parseFloat(d.prime_rate) || 0) + (parseFloat(d.margin) || 0)
                  : (parseFloat(d.annual_rate) || 0)
                return upsertLoan({
                  owner_id: user.id,
                  property_id: property.id,
                  label: d.label.trim() || null,
                  lender: d.lender.trim() || null,
                  repayment_type: d.repayment_type,
                  track_type: isMonthly ? d.track_type : null,
                  principal: parseFloat(d.principal) || 0,
                  annual_rate: isMonthly ? effRate : null,
                  prime_rate: anchored ? (parseFloat(d.prime_rate) || 0) : null,
                  margin: anchored ? (parseFloat(d.margin) || 0) : null,
                  term_months: isMonthly ? (parseInt(d.term_months) || null) : null,
                  grace_months: isMonthly ? (parseInt(d.grace_months) || null) : null,
                  start_date: isMonthly ? (d.start_date || null) : (d.start_date || keyDeliveryDate || null),
                })
              })

            const balloonVal = parseFloat(balloonAmount) || 0
            if (balloonVal > 0) {
              loanWrites.push(upsertLoan({
                owner_id: user.id,
                property_id: property.id,
                label: balloonLender.trim() || 'הלוואת בלון',
                lender: balloonLender.trim() || null,
                repayment_type: 'balloon',
                track_type: null,
                principal: balloonVal,
                annual_rate: null,
                prime_rate: null,
                margin: null,
                term_months: null,
                grace_months: null,
                start_date: keyDeliveryDate || null,
              }))
            }

            await Promise.all(loanWrites)
          } catch {
            failures.push('הלוואות')
          }
        })(),

        // Investment costs
        (async () => {
          try {
            const tasks = []
            if (equityAmount > 0) tasks.push(upsertInvestmentCost({ owner_id: user.id, category: 'self_equity', label: null, amount: equityAmount }))
            const fixedCosts: [string, number][] = [
              ['lawyer', parseFloat(effLawyer) || 0],
              ['brokerage', parseFloat(effBrokerage) || 0],
              ['mortgage_advisor', parseFloat(costs.mortgage_advisor) || 0],
              ['investment_company', parseFloat(costs.investment_company) || 0],
            ]
            for (const [key, val] of fixedCosts) {
              if (val > 0) tasks.push(upsertInvestmentCost({ owner_id: user.id, category: key, label: null, amount: val }))
            }
            for (const ec of extraCosts) {
              const val = parseFloat(ec.amount) || 0
              if (val > 0) tasks.push(upsertInvestmentCost({ owner_id: user.id, category: 'other', label: ec.name.trim() || null, amount: val }))
            }
            await Promise.all(tasks)
          } catch {
            failures.push('עלויות השקעה')
          }
        })(),

        // Rental contract
        (async () => {
          if (!companyName.trim() || !startDate || !endDate || !monthlyRent) {
            // Don't silently drop a partly-filled rental — a contract needs all of
            // company + start + end + rent, so flag it instead of losing the input.
            if (companyName.trim() || monthlyRent || startDate || endDate) {
              failures.push('שכירות (חסרים שם/תאריכים/סכום)')
            }
            return
          }
          try {
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
              payment_method: rentPaymentMethod,
              requires_approval: addRentReminder,
              renewal_alert_days: [90, 30],
            })
          } catch {
            failures.push('שכירות')
          }
        })(),

        // Insurance policies
        (async () => {
          try {
            await Promise.all(allPolicies
              .filter(p => p.company.trim() || p.monthly_premium)
              .map(p => createInsurancePolicy({
                owner_id: user.id,
                property_id: property.id,
                type: p.type,
                company: p.company.trim() || null,
                policy_number: null,
                monthly_premium: p.monthly_premium ? parseFloat(p.monthly_premium) : null,
                start_date: p.start_date || keyDeliveryDate || null,
                end_date: p.end_date || null,
                notes: null,
              }))
            )
          } catch {
            failures.push('ביטוח')
          }
        })(),

        // Purchase file
        (async () => {
          if (!purchaseFile) return
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
        })(),
      ])

      // Rental file + recurring — depend on contract being created above
      if (contract) {
        // TS can't track that `contract` is assigned inside the awaited closure
        // above, so it narrows to `never` here; the cast restores the real type.
        const createdContract = contract as Contract
        await Promise.all([
          (async () => {
            if (!rentalFile) return
            try {
              const docId = crypto.randomUUID()
              const path = await uploadDocument(rentalFile, docId)
              await supabase.from('documents').insert({
                id: docId, owner_id: user.id, property_id: property.id,
                contract_id: createdContract.id, transaction_id: null,
                type: 'rental_contract', name: rentalFile.name,
                storage_path: path, date: startDate || null,
              })
            } catch {
              failures.push('קובץ חוזה שכירות')
            }
          })(),
          (async () => {
            if (!monthlyRent) return
            try {
              await syncRentRecurringItem(
                {
                  id: createdContract.id,
                  monthly_rent: parseFloat(monthlyRent),
                  start_date: startDate || new Date().toISOString().slice(0, 10),
                  end_date: endDate || null,
                  company_name: companyName.trim(),
                  payment_method: rentPaymentMethod,
                  requires_approval: addRentReminder,
                },
                { dayOfMonth: parseInt(rentPaymentDay, 10) || 1 },
              )
            } catch {
              failures.push('תזכורת שכירות')
            }
          })(),
        ])
      }

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

  function fillTestLoans() {
    setLoans([
      { repayment_type: 'monthly_fixed', track_type: 'prime', label: 'הלוואה משלימה', lender: 'בנק לאומי', principal: '120000', annual_rate: '6.000', prime_rate: '6.000', margin: '0', term_months: '60', start_date: '2026-03-11', grace_months: '' },
      { repayment_type: 'balloon', track_type: 'fixed_unlinked', label: 'הלוואת בלון', lender: 'הורים', principal: '200000', annual_rate: '', prime_rate: '', margin: '', term_months: '', start_date: '2026-03-11', grace_months: '' },
    ])
    setShowLoanForm(false)
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

  // ── Loan helpers ──────────────────────────────────────────────────────────────
  function normalizeLoanDraft(): LoanDraft {
    return { ...loanForm, start_date: loanForm.start_date || keyDeliveryDate }
  }

  function loanIsValid(d: LoanDraft) {
    return (parseFloat(d.principal) || 0) > 0
  }

  function addLoan() {
    if (!loanIsValid(loanForm)) return
    setLoans(prev => [...prev, normalizeLoanDraft()])
    setLoanForm(emptyLoan(keyDeliveryDate || undefined))
    setLoanGraceOn(false)
    setShowLoanForm(false)
  }

  function saveLoanEdit(idx: number) {
    setLoans(prev => prev.map((l, i) => i === idx ? normalizeLoanDraft() : l))
    setEditingLoanIdx(null)
  }

  function saveLoanAndOpenNew() {
    if (loanIsValid(loanForm)) {
      if (editingLoanIdx !== null) {
        setLoans(prev => prev.map((l, i) => i === editingLoanIdx ? normalizeLoanDraft() : l))
      } else {
        setLoans(prev => [...prev, normalizeLoanDraft()])
      }
    }
    setEditingLoanIdx(null)
    setLoanForm(emptyLoan(keyDeliveryDate || undefined))
    setLoanGraceOn(false)
    setShowLoanForm(true)
  }

  function removeLoan(idx: number) {
    setLoans(prev => prev.filter((_, i) => i !== idx))
  }

  function setLF<K extends keyof LoanDraft>(key: K, val: LoanDraft[K]) {
    setLoanForm(prev => ({ ...prev, [key]: val }))
  }

  function loanTypeLabel(t: LoanRepaymentType) {
    return t === 'balloon' ? 'בלון' : 'הלוואה משלימה'
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

  // ── Loan totals ───────────────────────────────────────────────────────────────
  const loansMonthlyPrincipal = loans
    .filter(l => l.repayment_type === 'monthly_fixed')
    .reduce((s, l) => s + (parseFloat(l.principal) || 0), 0)
  const loansBalloonTotal = loans
    .filter(l => l.repayment_type === 'balloon')
    .reduce((s, l) => s + (parseFloat(l.principal) || 0), 0)

  return {
    onComplete,
    user,
    showFillExample,
    // wizard nav
    step, setStep, advance, back, currentStepIndex, stepTotal,
    saving, error,
    // notifications
    notifOn, notifBusy, enableNotifications,
    // purchase
    purchaseFile, setPurchaseFile, purchaseInputRef,
    buyerName, setBuyerName, street, setStreet, city, setCity, rooms, setRooms,
    purchasePrice, setPurchasePrice, signingDate, setSigningDate,
    keyDeliveryDate, setKeyDeliveryDate, propertySizeSqm, setPropertySizeSqm,
    floorNumber, setFloorNumber,
    // mortgage tracks
    tracks, setTracks, trackForm, setTrackForm, setTF,
    graceOn, setGraceOn, showTrackForm, setShowTrackForm, editingIdx, setEditingIdx,
    addTrack, saveTrackEdit, saveCurrentAndOpenNew, removeTrack,
    trackEffectiveRate, trackMonthlyPayment, trackTypeLabel,
    totalPrincipal, totalMonthly, hasAnyGrace, totalGraceMonthly,
    effectiveTrackForm, previewMonthly, previewGrace,
    // AI mortgage fill
    mortgageDocRef, mortgageAiBusy, mortgageAiErr, aiFillMortgage,
    // AI purchase + rental fill
    purchaseAiBusy, purchaseAiErr, aiFillPurchase,
    rentalAiBusy, rentalAiErr, aiFillRental,
    // investment / equity
    price, equityMode, setEquityMode, equityValue, setEquityValue,
    equityAmount, equityPercent, costsTotal,
    costs, setCosts, extraCosts, setExtraCosts,
    balloonAmount, setBalloonAmount, balloonLender, setBalloonLender,
    // focused input
    focusedInput, setFocusedInput,
    // rental
    rentalFile, setRentalFile, rentalInputRef,
    companyName, setCompanyName, startDate, setStartDate, endDate, setEndDate,
    monthlyRent, setMonthlyRent, rentPaymentMethod, setRentPaymentMethod,
    rentPaymentDay, setRentPaymentDay, addRentReminder, setAddRentReminder,
    // insurance
    policies, setPolicies, policyForm, setPolicyForm, setPF,
    showPolicyForm, setShowPolicyForm, editingPolicyIdx, setEditingPolicyIdx,
    addPolicy, savePolicyEdit, savePolicyAndOpenNew, removePolicy,
    // loans
    loans, setLoans, loanForm, setLoanForm, setLF,
    loanGraceOn, setLoanGraceOn, showLoanForm, setShowLoanForm,
    editingLoanIdx, setEditingLoanIdx,
    addLoan, saveLoanEdit, saveLoanAndOpenNew, removeLoan,
    loanIsValid, loanDraftRate, loanTypeLabel,
    loansMonthlyPrincipal, loansBalloonTotal,
    // submit
    handleFinish,
    // dev fill
    fillTestPurchase, fillTestMortgage, fillTestInvestment,
    fillTestRental, fillTestInsurance, fillTestLoans,
  }
}
