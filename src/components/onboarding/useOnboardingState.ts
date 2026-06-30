import { useEffect, useRef, useState } from 'react'
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
import { todayISO } from '../../lib/format'
import { loadOnboardingDraft, saveOnboardingDraft, clearOnboardingDraft } from '../../lib/onboardingDraft'
import { MORTGAGE_TRACK_TYPES } from '../../lib/constants'
import type { TrackType, LoanRepaymentType, Contract, DocumentType, Property } from '../../types'
import {
  STEP_ORDER, TRACK_TYPES,
  emptyTrack, emptyPolicy, emptyLoan,
  defaultLawyerCost, defaultBrokerageCost,
} from './types'
import type { Step, TrackDraft, PolicyDraft, LoanDraft, ExtraCost, BalloonRow } from './types'

// Manager/dev demo extractions: in local dev or the dev@test.local manager account
// the onboarding scans return these instead of calling the billed Claude edge
// functions — so the manager account is never connected to the Claude API. Real
// users always hit the real model. Shapes mirror each extract-* function's output.
const DEV_MOCK = {
  mortgage: { tracks: [
    { track_type: 'prime', principal: 600000, prime_rate: 6, margin: -0.5, term_months: 360, grace_months: 0 },
    { track_type: 'fixed_unlinked', principal: 217500, annual_rate: 4.9, term_months: 360, grace_months: 0 },
  ] },
  loan: { loans: [
    { repayment_type: 'monthly_fixed', lender: 'בנק לאומי', principal: 120000, annual_rate: 6, term_months: 60, grace_months: 0 },
  ] },
  contract: { buyerName: 'ישראל ישראלי (דמו)', street: 'הרצל 10', city: 'תל אביב', purchasePrice: 2500000, purchaseDate: '2025-01-15', keyDeliveryDate: '2025-07-01', propertySizeSqm: 90, floor: 3, rooms: 4 },
  rental: { tenantName: 'שוכר לדוגמה (דמו)', startDate: '2025-08-01', endDate: '2026-07-31', monthlyRent: 6500, paymentMethod: 'check' as const, paymentDay: 1 },
}

// Serializable snapshot of the wizard for crash-safe persistence (C2). Mirrors the
// data-bearing state below; transient UI state (refs, AI-busy flags, error/saving)
// and File objects are intentionally excluded.
type OnboardingDraft = {
  step: Step
  buyerName: string; street: string; city: string; rooms: string
  purchasePrice: string; signingDate: string; keyDeliveryDate: string
  propertySizeSqm: string; floorNumber: string
  tracks: TrackDraft[]; trackForm: TrackDraft; graceOn: boolean
  showTrackForm: boolean; editingIdx: number | null
  equityMode: 'amount' | 'percent'; equityValue: string
  costs: { lawyer: string; brokerage: string; mortgage_advisor: string; investment_company: string; appraiser: string }
  extraCosts: ExtraCost[]
  companyName: string; startDate: string; endDate: string; monthlyRent: string
  rentPaymentMethod: 'check' | 'bank_transfer'; rentPaymentDay: string; addRentReminder: boolean
  policies: PolicyDraft[]; policyForm: PolicyDraft; showPolicyForm: boolean; editingPolicyIdx: number | null
  loans: LoanDraft[]; balloonLoans: BalloonRow[]; loanForm: LoanDraft; loanGraceOn: boolean
  showLoanForm: boolean; editingLoanIdx: number | null
}

// The wizard's entire brain: all state, derived values and mutations. Steps and
// form components read this through OnboardingContext, so the shared type stays
// inferred (ReturnType) rather than a hand-maintained 90-field interface.
export function useOnboardingState(onComplete: () => void) {
  const { user } = useAuth()
  // "מלא דוגמה" buttons: shown in local dev and for the dev@test.local manager
  // account (so onboarding can be filled quickly when testing on the live app).
  const showFillExample = import.meta.env.DEV || user?.email === 'dev@test.local'

  // C2: rehydrate an in-progress wizard from localStorage so an interruption
  // doesn't wipe everything. Loaded once; each data field lazy-inits from it and a
  // debounced effect re-persists. Files are excluded (can't be serialized).
  const draftRef = useRef<Partial<OnboardingDraft> | null | undefined>(undefined)
  if (draftRef.current === undefined) draftRef.current = loadOnboardingDraft<OnboardingDraft>(user?.id)
  const d0 = draftRef.current

  // Synchronous re-entry guard for finish: `saving` is async React state, so two
  // rapid taps can both enter handleFinish before the button disables — which would
  // double-insert the contract/insurance/loans/mortgage. This ref blocks instantly.
  const finishingRef = useRef(false)

  const [step, setStep] = useState<Step>(d0?.step && d0.step !== 'done' ? d0.step : 'welcome')
  // Direction of the last step change, so the wizard can slide forward vs back
  // (native RTL: forward enters from the leading edge, back from the trailing one).
  const [navDir, setNavDir] = useState<'fwd' | 'back'>('fwd')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set when the user asks to finish while a background AI extraction is still
  // running — finishing is deferred until the read completes so the extracted
  // data isn't silently dropped (see requestFinish + the effect below handleFinish).
  const [pendingFinish, setPendingFinish] = useState(false)
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
  // Files are tracked as a list (so the documents step can show/add/remove them);
  // purchaseFile/setPurchaseFile stay as a single-file view for the later detail step.
  const [purchaseDocFiles, setPurchaseDocFiles] = useState<File[]>([])
  const purchaseFile = purchaseDocFiles[0] ?? null
  const setPurchaseFile = (f: File | null) => setPurchaseDocFiles(f ? [f] : [])
  const [buyerName, setBuyerName] = useState(d0?.buyerName ?? '')
  const [street, setStreet] = useState(d0?.street ?? '')
  const [city, setCity] = useState(d0?.city ?? '')
  const [rooms, setRooms] = useState(d0?.rooms ?? '')
  const [purchasePrice, setPurchasePrice] = useState(d0?.purchasePrice ?? '')
  const [signingDate, setSigningDate] = useState(d0?.signingDate ?? '')
  const [keyDeliveryDate, setKeyDeliveryDate] = useState(d0?.keyDeliveryDate ?? '')
  const [propertySizeSqm, setPropertySizeSqm] = useState(d0?.propertySizeSqm ?? '')
  const [floorNumber, setFloorNumber] = useState(d0?.floorNumber ?? '')

  // ── Mortgage tracks ──
  const [tracks, setTracks] = useState<TrackDraft[]>(d0?.tracks ?? [])
  const [trackForm, setTrackForm] = useState<TrackDraft>(d0?.trackForm ?? emptyTrack())
  const [graceOn, setGraceOn] = useState(d0?.graceOn ?? false)
  const [showTrackForm, setShowTrackForm] = useState(d0?.showTrackForm ?? true)
  const [editingIdx, setEditingIdx] = useState<number | null>(d0?.editingIdx ?? null)

  // ── Investment / equity ──
  const [equityMode, setEquityMode] = useState<'amount' | 'percent'>(d0?.equityMode ?? 'amount')
  const [equityValue, setEquityValue] = useState(d0?.equityValue ?? '')
  // Merge over the defaults (not `??`) so a draft saved before a new cost key existed
  // (e.g. appraiser) restores with that key defaulted to '' rather than undefined.
  const [costs, setCosts] = useState({ lawyer: '', brokerage: '', mortgage_advisor: '', investment_company: '', appraiser: '', ...(d0?.costs ?? {}) })
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>(d0?.extraCosts ?? [])

  // ── Focused input tracking (for grey-placeholder UX) ──
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  // ── Rental fields ──
  const [rentalDocFiles, setRentalDocFiles] = useState<File[]>([])
  const rentalFile = rentalDocFiles[0] ?? null
  const setRentalFile = (f: File | null) => setRentalDocFiles(f ? [f] : [])
  const [companyName, setCompanyName] = useState(d0?.companyName ?? '')
  const [startDate, setStartDate] = useState(d0?.startDate ?? '')
  const [endDate, setEndDate] = useState(d0?.endDate ?? '')
  const [monthlyRent, setMonthlyRent] = useState(d0?.monthlyRent ?? '')
  const [rentPaymentMethod, setRentPaymentMethod] = useState<'check' | 'bank_transfer'>(d0?.rentPaymentMethod ?? 'check')
  const [rentPaymentDay, setRentPaymentDay] = useState(d0?.rentPaymentDay ?? '1')
  const [addRentReminder, setAddRentReminder] = useState(d0?.addRentReminder ?? false)

  // ── Insurance policies ──
  const [policies, setPolicies] = useState<PolicyDraft[]>(d0?.policies ?? [])
  const [policyForm, setPolicyForm] = useState<PolicyDraft>(d0?.policyForm ?? emptyPolicy())
  const [showPolicyForm, setShowPolicyForm] = useState(d0?.showPolicyForm ?? true)
  const [editingPolicyIdx, setEditingPolicyIdx] = useState<number | null>(d0?.editingPolicyIdx ?? null)

  // ── Loans ──
  const [loans, setLoans] = useState<LoanDraft[]>(d0?.loans ?? [])
  // Balloon loan (interest-free, repaid only on sale — e.g. from family). Entered
  // in the investment/equity step since it offsets self-equity, not a monthly debt.
  // Balloon loans: a list so several family lenders (50 from mom, 50 from dad…) can
  // be captured separately, each interest-free and repaid on sale.
  const [balloonLoans, setBalloonLoans] = useState<BalloonRow[]>(d0?.balloonLoans ?? [])
  const [loanForm, setLoanForm] = useState<LoanDraft>(d0?.loanForm ?? emptyLoan())
  const [loanGraceOn, setLoanGraceOn] = useState(d0?.loanGraceOn ?? false)
  const [showLoanForm, setShowLoanForm] = useState(d0?.showLoanForm ?? true)
  const [editingLoanIdx, setEditingLoanIdx] = useState<number | null>(d0?.editingLoanIdx ?? null)

  const purchaseInputRef = useRef<HTMLInputElement>(null)
  const rentalInputRef = useRef<HTMLInputElement>(null)
  const mortgageDocRef = useRef<HTMLInputElement>(null)
  const loanDocRef = useRef<HTMLInputElement>(null)
  const [mortgageAiBusy, setMortgageAiBusy] = useState(false)
  const [mortgageAiErr, setMortgageAiErr] = useState<string | null>(null)
  const [mortgageAiDone, setMortgageAiDone] = useState(false)
  const [loanAiBusy, setLoanAiBusy] = useState(false)
  const [loanAiErr, setLoanAiErr] = useState<string | null>(null)
  const [loanAiDone, setLoanAiDone] = useState(false)
  const [purchaseAiBusy, setPurchaseAiBusy] = useState(false)
  const [purchaseAiErr, setPurchaseAiErr] = useState<string | null>(null)
  const [purchaseAiDone, setPurchaseAiDone] = useState(false)
  const [rentalAiBusy, setRentalAiBusy] = useState(false)
  const [rentalAiErr, setRentalAiErr] = useState<string | null>(null)
  const [rentalAiDone, setRentalAiDone] = useState(false)
  // The actual files uploaded for mortgage/loan extraction — kept so they're stored
  // as documents on finish (the extraction reads them, but the file itself must persist).
  const [mortgageDocFiles, setMortgageDocFiles] = useState<File[]>([])
  const [loanDocFiles, setLoanDocFiles] = useState<File[]>([])
  // Insurance has no AI extraction — the card just stores the policy document(s),
  // saved as insurance_policy documents on finish.
  const [insuranceDocFiles, setInsuranceDocFiles] = useState<File[]>([])
  const addInsuranceDocs = (files: File[]) => setInsuranceDocFiles(prev => [...prev, ...files])

  // ── Navigation ──────────────────────────────────────────────────────────────
  function dismissKeyboardAndScrollTop() {
    ;(document.activeElement as HTMLElement)?.blur()
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  function back() {
    dismissKeyboardAndScrollTop()
    setNavDir('back')
    if (step === 'documents') { setStep('welcome'); return }
    const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number])
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
    else setStep('documents')
  }

  function advance(next: Step) {
    dismissKeyboardAndScrollTop()
    setNavDir('fwd')
    setError(null)
    setStep(next)
  }

  // ── Derived: equity ─────────────────────────────────────────────────────────
  const price = parseFloat(purchasePrice) || 0
  // Equity = the down-payment beyond the bank mortgage: purchase price − mortgage.
  // Balloon/other loans don't change what's needed beyond the mortgage — they change
  // who funds it — so they're shown as offsets in the totals, not subtracted here.
  const totalMortgagePrincipal = tracks.reduce((s, t) => s + (parseFloat(t.principal) || 0), 0)
  const balloonTotal = balloonLoans.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0)
  const derivedEquityAmount = Math.max(0, price - totalMortgagePrincipal)
  const derivedEquityPct = price > 0 ? Math.round(derivedEquityAmount / price * 100) : 0
  // effective = user value if typed, else the derived default (grey placeholder)
  const effEquity = equityValue || (equityMode === 'percent'
    ? (derivedEquityPct > 0 ? String(derivedEquityPct) : '')
    : (derivedEquityAmount > 0 ? String(derivedEquityAmount) : ''))
  const effLawyer = costs.lawyer || defaultLawyerCost(price)
  const effBrokerage = costs.brokerage || defaultBrokerageCost(price)
  const equityAmount = equityMode === 'percent'
    ? Math.round(price * (parseFloat(effEquity) || 0) / 100)
    : Math.round(parseFloat(effEquity) || 0)
  const equityPercent = price > 0 ? equityAmount / price * 100 : 0
  const costsTotal = (parseFloat(effLawyer) || 0) + (parseFloat(effBrokerage) || 0)
    + (parseFloat(costs.mortgage_advisor) || 0) + (parseFloat(costs.investment_company) || 0)
    + (parseFloat(costs.appraiser) || 0)
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

  async function aiFillMortgage(fileList: File[]) {
    setMortgageAiBusy(true)
    setMortgageAiErr(null)
    setMortgageAiDone(false)
    // Append the uploaded file(s) to the list (the documents step shows/manages them);
    // they're saved as documents on finish. A fresh extraction still replaces the tracks.
    setMortgageDocFiles(prev => [...prev, ...fileList])
    try {
      const files = await Promise.all(fileList.map(async f => ({ fileBase64: await fileToBase64(f), mediaType: f.type })))
      // Version the key so improving the extraction (model/prompt) invalidates stale cached
      // results for the same file(s). Bump v2→v3… whenever the edge output changes.
      const cacheKey = `apt_extract_mortgage_v2_${hashString(files.map(f => f.fileBase64).join(''))}`
      let data: { tracks?: Record<string, unknown>[] } | null = null
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try { data = JSON.parse(cached) } catch { /* corrupt cache → re-fetch */ }
      }
      if (!data) {
        if (showFillExample) {
          // Manager/dev: never call the billed Claude API — use demo data.
          await new Promise(r => setTimeout(r, 700))
          data = DEV_MOCK.mortgage
        } else {
          const res = await supabase.functions.invoke('extract-mortgage', {
            body: { files },
          })
          if (res.error) throw res.error
          data = res.data
          try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* quota — skip caching */ }
        }
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
          // Leave empty when key-delivery isn't extracted yet (the contract may still be
          // reading in the background) — finish anchors it to key-delivery/signing, never
          // "today", so the payment schedule starts on the real date and shows in the ledger.
          start_date: keyDeliveryDate,
        }))
      if (mapped.length === 0) {
        setMortgageAiErr('לא זוהו מסלולים במסמך — נסו קובץ ברור יותר או הזינו ידנית.')
        return
      }
      setTracks(mapped)
      setShowTrackForm(false)
      setEditingIdx(null)
      setMortgageAiDone(true)
    } catch {
      setMortgageAiErr('לא הצלחנו לקרוא את המסמך — נסו שוב או הזינו ידנית.')
    } finally {
      setMortgageAiBusy(false)
    }
  }

  // ── AI fill: personal/supplementary loan doc → loan rows ─────────────────────
  async function aiFillLoans(fileList: File[]) {
    setLoanAiBusy(true)
    setLoanAiErr(null)
    setLoanAiDone(false)
    // Keep the uploaded file(s) so they're saved as documents on finish (loans append,
    // so the doc files append too).
    setLoanDocFiles(prev => [...prev, ...fileList])
    try {
      const files = await Promise.all(fileList.map(async f => ({ fileBase64: await fileToBase64(f), mediaType: f.type })))
      const cacheKey = `apt_extract_loan_v2_${hashString(files.map(f => f.fileBase64).join(''))}`
      let data: { loans?: Record<string, unknown>[] } | null = null
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try { data = JSON.parse(cached) } catch { /* corrupt cache → re-fetch */ }
      }
      if (!data) {
        if (showFillExample) {
          await new Promise(r => setTimeout(r, 700))
          data = DEV_MOCK.loan
        } else {
          const res = await supabase.functions.invoke('extract-loan', { body: { files } })
          if (res.error) throw res.error
          data = res.data
          try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* quota — skip caching */ }
        }
      }
      const raw = (data?.loans ?? []) as Record<string, unknown>[]
      const mapped: LoanDraft[] = raw
        .filter(l => (Number(l.principal) || 0) > 0)
        .map(l => {
          const isBalloon = l.repayment_type === 'balloon'
          return {
            repayment_type: (isBalloon ? 'balloon' : 'monthly_fixed') as LoanRepaymentType,
            track_type: 'fixed_unlinked' as TrackType,
            label: l.lender != null ? String(l.lender) : '',
            lender: l.lender != null ? String(l.lender) : '',
            principal: l.principal != null ? String(l.principal) : '',
            annual_rate: !isBalloon && l.annual_rate != null ? String(l.annual_rate) : '',
            prime_rate: '',
            margin: '',
            term_months: !isBalloon && l.term_months != null ? String(l.term_months) : '',
            grace_months: !isBalloon && l.grace_months != null ? String(l.grace_months) : '',
            // Use the doc's start date if it gave one; otherwise leave empty so finish
            // anchors it to key-delivery/signing rather than "today".
            start_date: l.start_date != null ? String(l.start_date) : keyDeliveryDate,
          }
        })
      if (mapped.length === 0) {
        setLoanAiErr('לא זוהתה הלוואה במסמך — נסו קובץ ברור יותר או הזינו ידנית.')
        return
      }
      // Append (don't clobber) any loans the user already entered.
      const base = loans.length
      setLoans(prev => [...prev, ...mapped])
      // If the doc left a monthly loan missing key details, open it for completion right
      // away instead of collapsing it to a tidy card that looks finished (false "ready").
      // Only rate/term count as "missing" — start_date is intentionally blank here and
      // gets anchored to key-delivery at save, so it must NOT mark the loan incomplete.
      const incompleteIdx = mapped.findIndex(l =>
        l.repayment_type === 'monthly_fixed' && (loanDraftRate(l) <= 0 || !l.term_months))
      if (incompleteIdx >= 0) {
        setLoanForm(mapped[incompleteIdx])
        setEditingLoanIdx(base + incompleteIdx)
        setShowLoanForm(false)
      } else {
        setShowLoanForm(false)
        setEditingLoanIdx(null)
      }
      setLoanAiDone(true)
    } catch {
      setLoanAiErr('לא הצלחנו לקרוא את המסמך — נסו שוב או הזינו ידנית.')
    } finally {
      setLoanAiBusy(false)
    }
  }

  // ── AI fill: purchase contract → property fields ─────────────────────────────
  async function aiFillPurchase(fileList: File[]) {
    setPurchaseDocFiles(prev => [...prev, ...fileList])
    setPurchaseAiBusy(true)
    setPurchaseAiErr(null)
    setPurchaseAiDone(false)
    try {
      const files = await Promise.all(fileList.map(async f => ({ fileBase64: await fileToBase64(f), mediaType: f.type })))
      const cacheKey = `apt_extract_purchase_v4_${hashString(files.map(f => f.fileBase64).join(''))}`
      let data: Record<string, unknown> | null = null
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try { data = JSON.parse(cached) } catch { /* corrupt cache → re-fetch */ }
      }
      if (!data) {
        if (showFillExample) {
          await new Promise(r => setTimeout(r, 700))
          data = DEV_MOCK.contract
        } else {
          const res = await supabase.functions.invoke('extract-contract', {
            body: { files },
          })
          if (res.error) throw res.error
          data = res.data
          try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* quota — skip caching */ }
        }
      }
      const d = data ?? {}
      if (d.buyerName) setBuyerName(String(d.buyerName))
      // Prefer the separately-extracted street/city; fall back to splitting the full
      // address on its last comma (older/looser extractions only return propertyAddress).
      if (d.street || d.city) {
        if (d.street) setStreet(String(d.street))
        if (d.city) setCity(String(d.city))
      } else if (d.propertyAddress) {
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
      setPurchaseAiDone(true)
    } catch {
      setPurchaseAiErr('לא הצלחנו לקרוא את החוזה — נסו שוב או מלאו ידנית.')
    } finally {
      setPurchaseAiBusy(false)
    }
  }

  // ── AI fill: rental agreement → rental fields ────────────────────────────────
  async function aiFillRental(fileList: File[]) {
    setRentalDocFiles(prev => [...prev, ...fileList])
    setRentalAiBusy(true)
    setRentalAiErr(null)
    setRentalAiDone(false)
    try {
      const files = await Promise.all(fileList.map(async f => ({ fileBase64: await fileToBase64(f), mediaType: f.type })))
      const cacheKey = `apt_extract_rental_v1_${hashString(files.map(f => f.fileBase64).join(''))}`
      let data: Record<string, unknown> | null = null
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try { data = JSON.parse(cached) } catch { /* corrupt cache → re-fetch */ }
      }
      if (!data) {
        if (showFillExample) {
          await new Promise(r => setTimeout(r, 700))
          data = DEV_MOCK.rental
        } else {
          const res = await supabase.functions.invoke('extract-rental', {
            body: { files },
          })
          if (res.error) throw res.error
          data = res.data
          try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* quota — skip caching */ }
        }
      }
      const d = data ?? {}
      if (d.tenantName) setCompanyName(String(d.tenantName))
      if (d.startDate) setStartDate(String(d.startDate))
      if (d.endDate) setEndDate(String(d.endDate))
      if (d.monthlyRent != null) setMonthlyRent(String(d.monthlyRent))
      if (d.paymentMethod === 'check') { setRentPaymentMethod('check'); setAddRentReminder(true) }
      else if (d.paymentMethod === 'bank_transfer') setRentPaymentMethod('bank_transfer')
      if (d.paymentDay != null) setRentPaymentDay(String(d.paymentDay))
      setRentalAiDone(true)
    } catch {
      setRentalAiErr('לא הצלחנו לקרוא את החוזה — נסו שוב או מלאו ידנית.')
    } finally {
      setRentalAiBusy(false)
    }
  }

  // Remove one already-picked file from a category's list (documents step manage view).
  // Only drops the file from what gets saved; any data already auto-filled is kept.
  function removeDocFile(category: 'purchase' | 'mortgage' | 'loan' | 'rental' | 'insurance', index: number) {
    const setters = {
      purchase: setPurchaseDocFiles, mortgage: setMortgageDocFiles,
      loan: setLoanDocFiles, rental: setRentalDocFiles, insurance: setInsuranceDocFiles,
    } as const
    setters[category](prev => prev.filter((_, i) => i !== index))
  }

  // Rename a chosen file in place. A File's name is immutable, so we rebuild it from
  // the same bytes — content (and therefore the extraction cache key) is unchanged,
  // so no re-read is triggered; only the stored document's filename changes.
  function renameDocFile(category: 'purchase' | 'mortgage' | 'loan' | 'rental' | 'insurance', index: number, newName: string) {
    const name = newName.trim()
    if (!name) return
    const setters = {
      purchase: setPurchaseDocFiles, mortgage: setMortgageDocFiles,
      loan: setLoanDocFiles, rental: setRentalDocFiles, insurance: setInsuranceDocFiles,
    } as const
    setters[category](prev => prev.map((f, i) =>
      i === index ? new File([f], name, { type: f.type, lastModified: f.lastModified }) : f))
  }

  // Background upload of the supplementary document files (purchase / mortgage / loan /
  // rental). Called WITHOUT await from handleFinish so "done" shows immediately; each
  // upload is independent and non-critical, so failures are swallowed (re-uploadable
  // from the Documents screen). Passing userId skips a getUser() round-trip per file.
  async function uploadOnboardingDocs(userId: string, propertyId: string, contractId: string | null) {
    const put = async (file: File, type: DocumentType, date: string | null, contract_id: string | null) => {
      try {
        const docId = crypto.randomUUID()
        const path = await uploadDocument(file, docId, userId)
        await supabase.from('documents').insert({
          id: docId, owner_id: userId, property_id: propertyId,
          contract_id, transaction_id: null,
          type, name: file.name, storage_path: path, date,
        })
      } catch { /* non-critical — re-uploadable from Documents */ }
    }
    const jobs: Promise<void>[] = []
    for (const f of purchaseDocFiles) jobs.push(put(f, 'purchase_contract', signingDate || null, null))
    for (const f of mortgageDocFiles) jobs.push(put(f, 'mortgage_statement', null, null))
    for (const f of loanDocFiles) jobs.push(put(f, 'loan_statement', null, null))
    for (const f of insuranceDocFiles) jobs.push(put(f, 'insurance_policy', null, null))
    for (const f of rentalDocFiles) jobs.push(put(f, 'rental_contract', startDate || null, contractId))
    await Promise.all(jobs)
  }

  // ── handleFinish ─────────────────────────────────────────────────────────────
  async function handleFinish() {
    if (!user) return
    if (finishingRef.current) return   // a finish is already in flight — ignore the re-fire
    finishingRef.current = true
    setSaving(true)
    setError(null)
    const failures: string[] = []
    try {
      // 1. Property — fatal: if this fails, stay on the step
      const address = [street.trim(), city.trim()].filter(Boolean).join(', ') || 'הנכס שלי'

      // A3 (C3 belt-and-suspenders): never insert a 2nd property for an owner who
      // already has one (e.g. if onboarding was somehow re-entered) — reuse it so
      // finishing twice can't corrupt the account with duplicate property data.
      const { data: existingProps } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)

      const property = existingProps && existingProps.length > 0
        ? (existingProps[0] as Property)
        : await createProperty({
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
            rooms: rooms !== '' ? parseFloat(rooms) : null,   // numeric column — keep half-rooms (4.5), don't truncate
          })

      // When payments begin: key-delivery is the real anchor for an off-plan buy;
      // fall back to the signing date, and only then to today. Mortgage/loan drafts
      // whose start_date wasn't set yet (extracted before the contract) inherit this,
      // so their schedule starts on the real date and surfaces in the ledger/cashflow.
      const paymentsAnchor = keyDeliveryDate || signingDate || todayISO()

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
                start_date: d.start_date || paymentsAnchor,
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
                  start_date: d.start_date || paymentsAnchor,
                })
              })

            for (const b of balloonLoans) {
              const balloonVal = parseFloat(b.amount) || 0
              if (balloonVal <= 0) continue
              loanWrites.push(upsertLoan({
                owner_id: user.id,
                property_id: property.id,
                label: b.lender.trim() || 'הלוואת בלון',
                lender: b.lender.trim() || null,
                repayment_type: 'balloon',
                track_type: null,
                principal: balloonVal,
                annual_rate: null,
                prime_rate: null,
                margin: null,
                term_months: null,
                grace_months: null,
                start_date: paymentsAnchor,
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
              ['appraiser', parseFloat(costs.appraiser) || 0],
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
      ])

      // Rent reminder — depends on the contract created above. Cheap and core, so awaited.
      if (contract) {
        // TS can't track that `contract` is assigned inside the awaited closure
        // above, so it narrows to `never` here; the cast restores the real type.
        const createdContract = contract as Contract
        if (monthlyRent) {
          try {
            await syncRentRecurringItem(
              {
                id: createdContract.id,
                monthly_rent: parseFloat(monthlyRent),
                start_date: startDate || todayISO(),
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
        }
      }

      if (failures.length > 0) {
        setError(`חלק מהפרטים לא נשמרו: ${failures.join(', ')} — ניתן להוסיף אותם מתוך האפליקציה`)
      }
      // Document files are supplementary — the app is fully usable without them. Upload
      // them in the background (not awaited) so the user reaches "done" immediately
      // instead of waiting on several storage round-trips. They keep uploading while the
      // user is on the done screen; fetch isn't tied to React so unmount won't abort them.
      uploadOnboardingDocs(user.id, property.id, contract ? (contract as Contract).id : null)
      // C2: data is now persisted server-side — drop the local draft so a later
      // visit doesn't rehydrate a stale wizard.
      clearOnboardingDraft(user.id)
      setStep('done')
    } catch (e) {
      // Only createProperty throws here — stay on step so the user can retry
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה')
    } finally {
      setSaving(false)
      finishingRef.current = false
    }
  }

  // ── Finish guard: don't finish while a doc is still being read ───────────────
  // True whenever any of the three background extractions is in flight.
  const anyAiBusy = purchaseAiBusy || mortgageAiBusy || rentalAiBusy || loanAiBusy

  // The finish entry point used by the UI. If a document is still being read,
  // defer the actual save until it resolves (the effect below fires it) so the
  // extracted property/mortgage/rental data makes it into the save.
  function requestFinish() {
    if (anyAiBusy) { setPendingFinish(true); return }
    handleFinish()
  }

  useEffect(() => {
    // Once all reads have settled (success OR failure), run the deferred finish.
    // The effect re-runs with fresh state, so handleFinish reads the just-filled
    // tracks/fields rather than the stale snapshot from when the user tapped.
    if (pendingFinish && !anyAiBusy) {
      setPendingFinish(false)
      handleFinish()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFinish, anyAiBusy])

  // ── C2: debounced persistence of the serializable wizard state ───────────────
  // Skip 'welcome' (nothing entered yet) and 'done' (already saved to the DB, draft
  // is cleared on finish). Files aren't included — re-pick-only, free to re-extract.
  useEffect(() => {
    if (step === 'welcome' || step === 'done') return
    const id = setTimeout(() => {
      saveOnboardingDraft<OnboardingDraft>(user?.id, {
        step, buyerName, street, city, rooms, purchasePrice, signingDate,
        keyDeliveryDate, propertySizeSqm, floorNumber,
        tracks, trackForm, graceOn, showTrackForm, editingIdx,
        equityMode, equityValue, costs, extraCosts,
        companyName, startDate, endDate, monthlyRent, rentPaymentMethod,
        rentPaymentDay, addRentReminder,
        policies, policyForm, showPolicyForm, editingPolicyIdx,
        loans, balloonLoans, loanForm, loanGraceOn, showLoanForm, editingLoanIdx,
      })
    }, 400)
    return () => clearTimeout(id)
  }, [
    step, buyerName, street, city, rooms, purchasePrice, signingDate,
    keyDeliveryDate, propertySizeSqm, floorNumber,
    tracks, trackForm, graceOn, showTrackForm, editingIdx,
    equityMode, equityValue, costs, extraCosts,
    companyName, startDate, endDate, monthlyRent, rentPaymentMethod,
    rentPaymentDay, addRentReminder,
    policies, policyForm, showPolicyForm, editingPolicyIdx,
    loans, balloonLoans, loanForm, loanGraceOn, showLoanForm, editingLoanIdx,
    user?.id,
  ])

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
      appraiser: '2500',
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

  // Grace controls driven from the mortgage step's top bar: one shared period, applied
  // to all tracks at once or toggled per track (grace lives on each track's grace_months).
  function setTrackGraceMonths(idx: number, months: string) {
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, grace_months: months } : t))
  }
  function applyGraceToAllTracks(months: string) {
    setTracks(prev => prev.map(t => ({ ...t, grace_months: months })))
  }
  // Period changed: re-apply it only to tracks that already have grace turned on.
  function setGraceMonthsForActive(months: string) {
    setTracks(prev => prev.map(t => (parseInt(t.grace_months) || 0) > 0 ? { ...t, grace_months: months } : t))
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
    step, setStep, advance, back, navDir, currentStepIndex, stepTotal,
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
    setTrackGraceMonths, applyGraceToAllTracks, setGraceMonthsForActive,
    trackEffectiveRate, trackMonthlyPayment, trackTypeLabel,
    totalPrincipal, totalMonthly, hasAnyGrace, totalGraceMonthly,
    effectiveTrackForm, previewMonthly, previewGrace,
    // AI mortgage fill
    mortgageDocRef, mortgageAiBusy, mortgageAiErr, mortgageAiDone, aiFillMortgage,
    loanDocRef, loanAiBusy, loanAiErr, loanAiDone, aiFillLoans,
    // AI purchase + rental fill
    purchaseAiBusy, purchaseAiErr, purchaseAiDone, aiFillPurchase,
    rentalAiBusy, rentalAiErr, rentalAiDone, aiFillRental,
    // Uploaded document files per category + remove (documents step manage view)
    purchaseDocFiles, mortgageDocFiles, loanDocFiles, rentalDocFiles, removeDocFile, renameDocFile,
    insuranceDocFiles, addInsuranceDocs,
    // investment / equity
    price, equityMode, setEquityMode, equityValue, setEquityValue,
    equityAmount, equityPercent, costsTotal, derivedEquityAmount, derivedEquityPct,
    costs, setCosts, extraCosts, setExtraCosts,
    balloonLoans, setBalloonLoans, balloonTotal,
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
    handleFinish, requestFinish, anyAiBusy, pendingFinish,
    // dev fill
    fillTestPurchase, fillTestMortgage, fillTestInvestment,
    fillTestRental, fillTestInsurance, fillTestLoans,
  }
}
