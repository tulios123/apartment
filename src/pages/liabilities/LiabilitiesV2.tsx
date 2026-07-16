import { useRef, useState } from 'react'
import { Bank, HandCoins, Scales, Plus, CaretDown, PencilSimple, Trash, Sparkle, CircleNotch } from '@phosphor-icons/react'
import { useMortgageData, ensureMortgage, upsertMortgageTrack, deleteMortgageTrack, setMortgagePaymentDay } from '../../hooks/useMortgageData'
import { useLoansData, upsertLoan, deleteLoan } from '../../hooks/useLoansData'
import { usePropertyData } from '../../hooks/usePropertyData'
import { useDocuments, createDocument, updateDocument, deleteDocument } from '../../hooks/useDocuments'
import { isManager } from '../../lib/admin'
import { uploadDocument, redirectToSignedUrl } from '../../lib/storage'
import { extractMortgageTracks, extractLoans } from '../../lib/extractFinancing'
import { monthlyPayment, trackSchedule } from '../../lib/mortgage'
import { loanBalance, loanMonthlyPayment, loanInterestToDate, loanEndDate } from '../../lib/loans'
import { MORTGAGE_TRACK_TYPES } from '../../lib/constants'
import { formatCurrency, formatNum, monthDayISO } from '../../lib/format'
import { monthlyVirtualEntries } from '../../lib/projections'
import { useAuth } from '../../contexts/AuthContext'
import { SkeletonList } from '../../components/ui/Skeleton'
import BottomSheet from '../../components/ui/BottomSheet'
import { PageError } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { shouldConfirmDiscard } from '../../lib/discardGuard'
import { ScanDocList } from './ScanDocList'
import { ScanReview, type ScanDraft } from './ScanReview'
import type { MortgageTrack, Loan, TrackType, LoanRepaymentType } from '../../types'
import './liabilities-v2.css'
import { DateField } from '../../components/ui/DateField'

const TRACK_LABEL: Record<TrackType, string> = { prime: 'פריים', fixed_unlinked: 'קבועה לא צמודה', fixed_linked: 'קבועה צמודה', variable: 'משתנה' }
const TRACK_COLOR: Record<TrackType, string> = { prime: 'blue', fixed_unlinked: 'teal', fixed_linked: 'purple', variable: 'amber' }
const fmt = (v: number) => formatCurrency(v)
const yearOf = (d: string | null) => d ? new Date(d).getFullYear() : null

const emptyTrack = { track_type: 'prime' as TrackType, label: '', principal: '', annual_rate: '', prime_rate: '', margin: '', term_months: '', grace_months: '0', start_date: monthDayISO(new Date()) }
const emptyLoan = { repayment_type: 'monthly_fixed' as LoanRepaymentType, track_type: 'fixed_unlinked' as TrackType, label: '', lender: '', principal: '', annual_rate: '', prime_rate: '', margin: '', term_months: '', grace_months: '0', start_date: monthDayISO(new Date()), payment_day: '' }
const isAnchoredType = (t: TrackType) => t === 'prime' || t === 'variable'

// Manager/dev fixtures: in local dev or the dev@test.local manager account, the AI
// scan returns these instead of calling the billed extract-* edge functions — so
// testing the scan flow never costs money. Real users always hit the real model.
const MOCK_MORTGAGE_TRACKS: Record<string, unknown>[] = [
  { track_type: 'prime', principal: 600000, prime_rate: 6, margin: -0.5, term_months: 360, grace_months: 0 },
  { track_type: 'fixed_unlinked', principal: 217500, annual_rate: 4.9, term_months: 360, grace_months: 0 },
]
const MOCK_LOANS: Record<string, unknown>[] = [
  { lender: 'בנק לאומי', principal: 120000, annual_rate: 6, term_months: 60, repayment_type: 'monthly_fixed' },
]

export default function LiabilitiesV2({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { mortgage, tracks, summary, loading: loadingM, error: errorM, refetch: refetchM } = useMortgageData()
  const { monthlyLoans, balloonLoans, summary: loansSummary, loading: loadingL, error: errorL, refetch: refetchL } = useLoansData()
  const { property } = usePropertyData()
  const { documents, refetch: refetchDocs } = useDocuments()
  const mortgageDocs = documents.filter(d => d.type === 'mortgage_statement')
  const loanDocs = documents.filter(d => d.type === 'loan_statement')

  const [open, setOpen] = useState<string | null>(null)
  // Collapse the long lists by default (owner request): mortgage tracks, and the loan
  // groups. Regular loans only get a toggle when there's more than one.
  const [tracksOpen, setTracksOpen] = useState(false)
  const [regularLoansOpen, setRegularLoansOpen] = useState(false)
  const [balloonOpen, setBalloonOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [kind, setKind] = useState<'mortgage' | 'loan'>('mortgage')
  const [editId, setEditId] = useState<string | null>(null)
  const [tForm, setTForm] = useState(emptyTrack)
  const [graceOn, setGraceOn] = useState(false)
  const [lForm, setLForm] = useState(emptyLoan)
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const openSnapshot = useRef('')
  const [formError, setFormError] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  // Deleting a track/loan removes real money data — confirm first, like every other
  // delete in the app (the buttons used to delete on a single stray tap).
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'track' | 'loan'; id: string } | null>(null)

  // ── AI document scan (mortgage statement / loan doc → review form) ──
  type TrackDraft = typeof emptyTrack
  type LoanDraft = typeof emptyLoan
  const [aiBusy, setAiBusy] = useState<'mortgage' | 'loan' | null>(null)
  const [aiErr, setAiErr] = useState<{ kind: 'mortgage' | 'loan'; msg: string } | null>(null)
  // After a scan we show a smart review card (ScanReview): inline-editable rows with
  // completeness badges + a gated "add" button — instead of popping a bare form.
  const [scanResult, setScanResult] = useState<{ kind: 'mortgage' | 'loan'; drafts: ScanDraft[] } | null>(null)
  const [scanSaving, setScanSaving] = useState(false)
  const mortgageDocRef = useRef<HTMLInputElement>(null)
  const loanDocRef = useRef<HTMLInputElement>(null)

  // Manager/dev-only quick-fill for the open drawer (track or loan by kind).
  const showFill = isManager(user?.email)            // A4: button — manager only
  const useMock = import.meta.env.DEV || isManager(user?.email)  // AI mock/demo — also in dev, never bills
  function fillDrawerExample() {
    if (kind === 'mortgage') {
      setTForm({ track_type: 'fixed_unlinked', label: 'מסלול לדוגמה', principal: '600000', annual_rate: '4.5', prime_rate: '', margin: '', term_months: '360', grace_months: '0', start_date: monthDayISO(new Date()) })
    } else {
      setLForm({ repayment_type: 'monthly_fixed', track_type: 'fixed_unlinked', label: 'הלוואה לדוגמה', lender: 'בנק לאומי', principal: '120000', annual_rate: '6', prime_rate: '', margin: '', term_months: '60', grace_months: '0', start_date: monthDayISO(new Date()), payment_day: '' })
    }
  }

  const today = monthDayISO(new Date())
  const mortgageBalance = summary.currentBalance || 0
  const loanBal = loansSummary.monthlyBalance || 0
  const balloonBal = loansSummary.balloonOutstanding || 0
  const total = mortgageBalance + loanBal + balloonBal
  // W7/R9: "תשלום חודשי" = THIS month's actual outlay from the same schedule source
  // the ledger/home use (monthlyVirtualEntries) — grace months show the grace payment,
  // paid-off / not-yet-started tracks and loans contribute 0. The old sum of nominal
  // lifetime payments overstated during grace and kept counting finished loans.
  const nowD = new Date()
  const monthly = monthlyVirtualEntries([], tracks, nowD.getFullYear(), nowD.getMonth() + 1, monthlyLoans, [])
    .filter(e => e.direction === 'expense')
    .reduce((s, e) => s + e.amount, 0)
  const pct = (v: number) => total > 0 ? (v / total) * 100 : 0

  function trackStats(t: MortgageTrack) {
    const sched = trackSchedule(t)
    const lastPaid = [...sched].reverse().find(r => r.date <= today)
    const balance = lastPaid ? lastPaid.balance : t.principal
    const interestPaid = sched.filter(r => r.date <= today).reduce((s, r) => s + r.interest, 0)
    const interestLeft = sched.filter(r => r.date > today).reduce((s, r) => s + r.interest, 0)
    const endYear = sched.length ? yearOf(sched[sched.length - 1].date) : null
    const pay = monthlyPayment(t.principal, t.annual_rate, t.term_months, t.grace_months ?? 0)
    const paidPct = t.principal > 0 ? ((t.principal - balance) / t.principal) * 100 : 0
    return { balance, interestPaid, interestLeft, endYear, pay, paidPct }
  }

  function openAddMortgage() { setKind('mortgage'); setEditId(null); setTForm(emptyTrack); openSnapshot.current = JSON.stringify(emptyTrack); setGraceOn(false); setFormError(null); setActionErr(null); setConfirmDiscard(false); setDrawerOpen(true) }
  function openAddLoan() { setKind('loan'); setEditId(null); setLForm(emptyLoan); openSnapshot.current = JSON.stringify(emptyLoan); setGraceOn(false); setFormError(null); setActionErr(null); setConfirmDiscard(false); setDrawerOpen(true) }
  function editTrack(t: MortgageTrack) {
    setKind('mortgage'); setEditId(t.id); setFormError(null); setActionErr(null)
    // R8: load the anchor/margin split too — editing a prime/variable track used to
    // show only the folded effective rate and the save wiped the stored split.
    // Older anchored tracks that never stored the split: seed anchor = the folded
    // effective rate, margin = 0 (same effective rate, nothing corrupted on save).
    const anchoredNoSplit = isAnchoredType(t.track_type) && t.prime_rate == null
    const tf = { track_type: t.track_type, label: t.label ?? '', principal: String(t.principal), annual_rate: String(t.annual_rate), prime_rate: t.prime_rate != null ? String(t.prime_rate) : (anchoredNoSplit ? String(t.annual_rate) : ''), margin: t.margin != null ? String(t.margin) : (anchoredNoSplit ? '0' : ''), term_months: String(t.term_months), grace_months: String(t.grace_months ?? 0), start_date: t.start_date }
    setTForm(tf); openSnapshot.current = JSON.stringify(tf)
    setGraceOn((t.grace_months ?? 0) > 0)
    setConfirmDiscard(false)
    setDrawerOpen(true)
  }
  function editLoan(l: Loan) {
    setKind('loan'); setEditId(l.id); setFormError(null); setActionErr(null)
    const lf = { repayment_type: l.repayment_type, track_type: l.track_type ?? 'fixed_unlinked', label: l.label ?? '', lender: l.lender ?? '', principal: String(l.principal), annual_rate: l.annual_rate != null ? String(l.annual_rate) : '', prime_rate: l.prime_rate != null ? String(l.prime_rate) : '', margin: l.margin != null ? String(l.margin) : '', term_months: l.term_months != null ? String(l.term_months) : '', grace_months: String(l.grace_months ?? 0), start_date: l.start_date ?? monthDayISO(new Date()), payment_day: l.payment_day != null ? String(l.payment_day) : '' }
    setLForm(lf); openSnapshot.current = JSON.stringify(lf)
    setGraceOn((l.grace_months ?? 0) > 0)
    setConfirmDiscard(false)
    setDrawerOpen(true)
  }

  // A dismiss shouldn't silently drop typed input; ask only when the active form changed
  // from what it opened with. A pristine or untouched-edit form closes without a prompt.
  // The save path calls forceClose() so a just-saved (still-populated) form never prompts.
  const isDirty = JSON.stringify(kind === 'mortgage' ? tForm : lForm) !== openSnapshot.current
  function forceClose() { setConfirmDiscard(false); setDrawerOpen(false) }
  function closeDrawer() {
    if (confirmDiscard) return
    if (shouldConfirmDiscard(isDirty, saving ? 'saving' : 'idle')) setConfirmDiscard(true)
    else setDrawerOpen(false)
  }

  // Map an extracted record to the drawer's form shape. For an anchored mortgage
  // track (prime/variable) the track form holds one effective rate, so fold
  // anchor + margin into annual_rate (mirrors how the tracks are stored).
  function mapTrack(t: Record<string, unknown>): TrackDraft {
    const tt = (['prime', 'fixed_unlinked', 'fixed_linked', 'variable'].includes(t.track_type as string) ? t.track_type : 'fixed_unlinked') as TrackType
    const anchored = tt === 'prime' || tt === 'variable'
    const rate = anchored ? (Number(t.prime_rate) || 0) + (Number(t.margin) || 0) : (Number(t.annual_rate) || 0)
    return {
      track_type: tt,
      label: '',
      principal: t.principal != null ? String(t.principal) : '',
      annual_rate: rate ? String(rate) : '',
      // R8: keep the extracted anchor/margin split alongside the folded rate, so a
      // scanned prime/variable track stays editable as anchor+margin later.
      prime_rate: anchored && t.prime_rate != null ? String(t.prime_rate) : '',
      margin: anchored && t.margin != null ? String(t.margin) : '',
      term_months: t.term_months != null ? String(t.term_months) : '',
      grace_months: t.grace_months != null ? String(t.grace_months) : '0',
      start_date: t.start_date ? String(t.start_date) : monthDayISO(new Date()),
    }
  }
  function mapLoan(l: Record<string, unknown>): LoanDraft {
    const isBalloon = l.repayment_type === 'balloon'
    return {
      repayment_type: (isBalloon ? 'balloon' : 'monthly_fixed') as LoanRepaymentType,
      track_type: 'fixed_unlinked' as TrackType,
      label: l.lender != null ? String(l.lender) : '',
      lender: l.lender != null ? String(l.lender) : '',
      principal: l.principal != null ? String(l.principal) : '',
      annual_rate: !isBalloon && l.annual_rate != null ? String(l.annual_rate) : '',
      prime_rate: '', margin: '',
      term_months: !isBalloon && l.term_months != null ? String(l.term_months) : '',
      grace_months: l.grace_months != null ? String(l.grace_months) : '0',
      start_date: l.start_date ? String(l.start_date) : monthDayISO(new Date()),
      payment_day: '',
    }
  }

  // Persist every reviewed draft at once from the smart review card, then clear it.
  async function saveScannedDrafts(drafts: ScanDraft[]) {
    if (!user || !scanResult) return
    setScanSaving(true)
    try {
      if (scanResult.kind === 'mortgage') {
        const mortgageId = mortgage?.id ?? (await ensureMortgage(user.id)).id
        await Promise.all(drafts.map(d => {
          const t = d as TrackDraft
          // R8: persist the anchor/margin split only when it still folds to the saved
          // rate (the review card edits the folded rate — a stale split would lie).
          const anchored = isAnchoredType(t.track_type)
          const splitOk = anchored && t.prime_rate !== '' &&
            Math.abs((Number(t.prime_rate || 0) + Number(t.margin || 0)) - Number(t.annual_rate || 0)) < 0.005
          return upsertMortgageTrack({
            mortgage_id: mortgageId, owner_id: user.id,
            label: t.label || null, track_type: t.track_type,
            principal: Number(t.principal) || 0, annual_rate: Number(t.annual_rate || 0),
            prime_rate: splitOk ? Number(t.prime_rate || 0) : null,
            margin: splitOk ? Number(t.margin || 0) : null,
            term_months: Number(t.term_months || 0), grace_months: Number(t.grace_months || 0),
            start_date: t.start_date,
          })
        }))
        refetchM()
        setTracksOpen(true)   // show the scanned tracks, not hidden behind a collapsed header
      } else {
        await Promise.all(drafts.map(d => {
          const l = d as LoanDraft
          const isMonthly = l.repayment_type === 'monthly_fixed'
          return upsertLoan({
            owner_id: user.id, label: l.label || null, lender: l.lender || null,
            repayment_type: l.repayment_type, track_type: isMonthly ? l.track_type : null,
            principal: Number(l.principal) || 0,
            annual_rate: isMonthly ? Number(l.annual_rate || 0) : null,
            prime_rate: null, margin: null,
            term_months: isMonthly ? (Number(l.term_months) || 0) : null,
            grace_months: isMonthly ? (Number(l.grace_months) || 0) : 0,
            start_date: l.start_date,
          })
        }))
        refetchL()
        setRegularLoansOpen(true); setBalloonOpen(true)   // show the scanned loans in their groups
      }
      setScanResult(null)
    } catch {
      setAiErr({ kind: scanResult.kind, msg: 'לא הצלחנו לשמור — נסו שוב.' })
    } finally {
      setScanSaving(false)
    }
  }

  // Persist the scanned file(s) as documents so they're not lost and show in the
  // Documents screen too. Best-effort (re-uploadable), not awaited by the scan.
  async function persistScanFiles(files: File[], type: 'mortgage_statement' | 'loan_statement') {
    if (!user) return
    await Promise.all(files.map(async (f) => {
      try {
        const id = crypto.randomUUID()
        const path = await uploadDocument(f, id, user.id)
        await createDocument({
          id, owner_id: user.id, property_id: property?.id ?? null,
          contract_id: null, transaction_id: null, task_id: null,
          type, name: f.name, storage_path: path, date: null,
        })
      } catch { /* best-effort — re-uploadable from Documents */ }
    }))
    refetchDocs()
  }
  function openDoc(path: string) { const w = window.open('', '_blank'); redirectToSignedUrl(w, path) }
  async function renameDoc(id: string, name: string) { try { await updateDocument(id, { name }); refetchDocs() } catch { /* ignore */ } }
  async function removeDoc(id: string, path: string) { try { await deleteDocument(id, path); refetchDocs() } catch { /* ignore */ } }

  async function scanMortgageDoc(files: File[]) {
    if (files.length === 0) return
    setAiBusy('mortgage'); setAiErr(null)
    try {
      persistScanFiles(files, 'mortgage_statement')
      // Manager/dev: skip the billed extraction entirely and use demo data.
      let raw: Record<string, unknown>[]
      if (useMock) { await new Promise(r => setTimeout(r, 600)); raw = MOCK_MORTGAGE_TRACKS }
      else raw = await extractMortgageTracks(files)
      const drafts = raw.map(mapTrack)
      if (drafts.length === 0) { setAiErr({ kind: 'mortgage', msg: 'לא זוהו מסלולים במסמך — נסו קובץ ברור יותר או הוסיפו ידנית.' }); return }
      setScanResult({ kind: 'mortgage', drafts })
    } catch {
      setAiErr({ kind: 'mortgage', msg: 'לא הצלחנו לקרוא את המסמך — נסו שוב או הוסיפו ידנית.' })
    } finally { setAiBusy(null) }
  }
  async function scanLoanDoc(files: File[]) {
    if (files.length === 0) return
    setAiBusy('loan'); setAiErr(null)
    try {
      persistScanFiles(files, 'loan_statement')
      // Manager/dev: skip the billed extraction entirely and use demo data.
      let raw: Record<string, unknown>[]
      if (useMock) { await new Promise(r => setTimeout(r, 600)); raw = MOCK_LOANS }
      else raw = await extractLoans(files)
      const drafts = raw.map(mapLoan)
      if (drafts.length === 0) { setAiErr({ kind: 'loan', msg: 'לא זוהתה הלוואה במסמך — נסו קובץ ברור יותר או הוסיפו ידנית.' }); return }
      setScanResult({ kind: 'loan', drafts })
    } catch {
      setAiErr({ kind: 'loan', msg: 'לא הצלחנו לקרוא את המסמך — נסו שוב או הוסיפו ידנית.' })
    } finally { setAiBusy(null) }
  }

  async function save() {
    if (!user) return
    setSaving(true); setFormError(null)
    try {
      if (kind === 'mortgage') {
        if (!tForm.principal || Number(tForm.principal) <= 0) throw new Error('יש להזין קרן (סכום ההלוואה)')
        if (Number(tForm.term_months || 0) <= 0) throw new Error('יש להזין תקופה (מספר חודשים)')
        if (graceOn && Number(tForm.grace_months || 0) >= Number(tForm.term_months || 0)) throw new Error('תקופת הגרייס חייבת להיות קצרה מהתקופה הכוללת')
        const mortgageId = mortgage?.id ?? (await ensureMortgage(user.id)).id
        // R8: prime/variable tracks are entered as anchor + margin (like loans);
        // annual_rate stays the folded effective rate that drives the schedule.
        const tAnchored = isAnchoredType(tForm.track_type)
        const tEffRate = tAnchored ? Number(tForm.prime_rate || 0) + Number(tForm.margin || 0) : Number(tForm.annual_rate || 0)
        await upsertMortgageTrack({
          id: editId ?? undefined, mortgage_id: mortgageId, owner_id: user.id,
          label: tForm.label || null, track_type: tForm.track_type,
          principal: Number(tForm.principal), annual_rate: tEffRate,
          prime_rate: tAnchored ? Number(tForm.prime_rate || 0) : null,
          margin: tAnchored ? Number(tForm.margin || 0) : null,
          term_months: Number(tForm.term_months || 0), grace_months: graceOn ? Number(tForm.grace_months || 0) : 0, start_date: tForm.start_date,
        })
        refetchM()
        setTracksOpen(true)   // reveal the section so the just-saved track isn't hidden behind a collapsed header
      } else {
        if (!lForm.principal || Number(lForm.principal) <= 0) throw new Error('יש להזין קרן (סכום ההלוואה)')
        const isMonthly = lForm.repayment_type === 'monthly_fixed'
        if (isMonthly) {
          if (Number(lForm.term_months || 0) <= 0) throw new Error('יש להזין תקופה (מספר חודשים)')
          if (graceOn && Number(lForm.grace_months || 0) >= Number(lForm.term_months || 0)) throw new Error('תקופת הגרייס חייבת להיות קצרה מהתקופה הכוללת')
        }
        const anchored = isMonthly && isAnchoredType(lForm.track_type)
        // Prime/variable: effective rate = anchor + margin (margin can be negative, "prime minus").
        const effRate = anchored ? Number(lForm.prime_rate || 0) + Number(lForm.margin || 0) : Number(lForm.annual_rate || 0)
        await upsertLoan({
          id: editId ?? undefined, owner_id: user.id, label: lForm.label || null, lender: lForm.lender || null,
          repayment_type: lForm.repayment_type, track_type: isMonthly ? lForm.track_type : null,
          principal: Number(lForm.principal),
          annual_rate: isMonthly ? effRate : null,
          prime_rate: anchored ? Number(lForm.prime_rate || 0) : null,
          margin: anchored ? Number(lForm.margin || 0) : null,
          term_months: isMonthly ? Number(lForm.term_months || 0) : null,
          grace_months: isMonthly && graceOn ? Number(lForm.grace_months || 0) : 0, start_date: lForm.start_date,
          payment_day: isMonthly && lForm.payment_day ? Number(lForm.payment_day) : null,
        })
        refetchL()
        // reveal the right loan group so the just-saved loan isn't hidden behind a collapsed header
        if (lForm.repayment_type === 'balloon') setBalloonOpen(true); else setRegularLoansOpen(true)
      }
      forceClose()
    } catch (e) { setFormError(e instanceof Error ? e.message : 'שגיאה בשמירה') }
    setSaving(false)
  }

  async function removeTrack(id: string) {
    setActionErr(null)
    try { await deleteMortgageTrack(id) }
    catch { setActionErr('מחיקת המסלול נכשלה — נסו שוב') }
    finally { refetchM() }
  }
  async function removeLoan(id: string) {
    setActionErr(null)
    try { await deleteLoan(id) }
    catch { setActionErr('מחיקת ההלוואה נכשלה — נסו שוב') }
    finally { refetchL() }
  }

  if (errorM || errorL) return <PageError message={errorM || errorL || 'שגיאה'} />

  return (
    <div className={embedded ? 'liav liav-embedded' : 'page liav'}>
      {!embedded && <div className="page-header"><h1>התחייבויות</h1></div>}
      {actionErr && <div className="liav-form-err" role="alert">{actionErr}</div>}

      {(loadingM || loadingL) ? <SkeletonList rows={4} /> : (
        <>
          <div className={`liav-hero${embedded ? ' slim' : ''}`}>
            {!embedded && (
              <>
                <div className="liav-hero-label">סך התחייבויות</div>
                <div className="liav-hero-value">{fmt(total)}</div>
                <div className="liav-comp-bar">
                  {mortgageBalance > 0 && <div className="mortgage" style={{ width: `${pct(mortgageBalance)}%` }} />}
                  {loanBal > 0 && <div className="loan" style={{ width: `${pct(loanBal)}%` }} />}
                  {balloonBal > 0 && <div className="balloon" style={{ width: `${pct(balloonBal)}%` }} />}
                </div>
                <div className="liav-comp-legend">
                  {mortgageBalance > 0 && <span><i className="liav-comp-dot" style={{ background: '#5aa0ec' }} /> משכנתא {fmt(mortgageBalance)}</span>}
                  {loanBal > 0 && <span><i className="liav-comp-dot" style={{ background: 'var(--accent-teal)' }} /> הלוואה {fmt(loanBal)}</span>}
                  {balloonBal > 0 && <span><i className="liav-comp-dot" style={{ background: '#f0b24e' }} /> בלון {fmt(balloonBal)}</span>}
                </div>
              </>
            )}
            <div className="liav-hero-foot">
              <div><span>תשלום חודשי</span><strong>{fmt(monthly)}</strong></div>
              <div><span>ריבית שנותרה לתשלום</span><strong>{fmt(Math.max(0, summary.totalInterestLife - summary.interestPaidToDate))}</strong></div>
            </div>
          </div>

          <section className="liav-section">
              {tracks.length > 0 ? (
                <h2 className="liav-group-h">
                  <button type="button" className="liav-group-toggle" onClick={() => setTracksOpen(o => !o)} aria-expanded={tracksOpen}>
                    <Bank size={18} weight="duotone" color="var(--brand-navy)" />
                    <span className="liav-group-title">תמהיל המשכנתא · {tracks.length} מסלולים</span>
                    <CaretDown className={`liav-group-caret${tracksOpen ? ' open' : ''}`} size={16} weight="bold" />
                  </button>
                </h2>
              ) : (
                <div className="liav-section-head"><Bank size={18} weight="duotone" color="var(--brand-navy)" /><h2>תמהיל המשכנתא</h2></div>
              )}
              {tracksOpen && tracks.map(t => {
                const s = trackStats(t); const color = TRACK_COLOR[t.track_type]; const isOpen = open === t.id
                return (
                  <div key={t.id} className={`liav-card${isOpen ? ' open' : ''}`}>
                    <button className="liav-card-head" onClick={() => setOpen(isOpen ? null : t.id)}>
                      <span className={`liav-badge ${color}`}>{TRACK_LABEL[t.track_type]}</span>
                      {/* Product decision 15.07: linked tracks are computed NOMINALLY (no CPI
                          linkage yet) — disclose it wherever the track's numbers are read. */}
                      <div className="liav-card-main"><div className="liav-card-title">{fmt(s.pay)} לחודש</div><div className="liav-card-sub">ריבית {Number(t.annual_rate).toFixed(1)}%{t.track_type === 'fixed_linked' ? ' · ללא הצמדה למדד' : ''}{s.endYear ? ` · עד ${s.endYear}` : ''}{t.label ? ` · ${t.label}` : ''}</div></div>
                      <div className="liav-card-balance"><b>{fmt(s.balance)}</b><span>יתרה</span></div>
                      <CaretDown className="liav-card-caret" size={16} weight="bold" />
                    </button>
                    <div className="liav-progress"><div className="liav-progress-track"><div className={`liav-progress-fill ${color}`} style={{ width: `${s.paidPct}%` }} /></div><div className="liav-progress-labels"><span>נפרעו {Math.round(s.paidPct)}%</span><span>מתוך {fmt(t.principal)}</span></div></div>
                    <div className="liav-detail"><div className="liav-detail-inner">
                      <div className="liav-detail-grid">
                        <div className="liav-detail-item"><span>קרן מקורית</span><strong>{fmt(t.principal)}</strong></div>
                        <div className="liav-detail-item"><span>תקופה</span><strong>{Math.round(t.term_months / 12)} שנים</strong></div>
                        <div className="liav-detail-item"><span>ריבית ששולמה</span><strong className="interest">{fmt(s.interestPaid)}</strong></div>
                        <div className="liav-detail-item"><span>ריבית שנותרה</span><strong className="interest">{fmt(s.interestLeft)}</strong></div>
                        {(t.grace_months ?? 0) > 0 && <div className="liav-detail-item"><span>גרייס</span><strong>{t.grace_months} חודשים</strong></div>}
                      </div>
                      <div className="liav-detail-actions">
                        <button className="liav-detail-btn" onClick={() => editTrack(t)}><PencilSimple size={14} /> עריכה</button>
                        <button className="liav-detail-btn danger" onClick={() => setConfirmDelete({ kind: 'track', id: t.id })}><Trash size={14} /> מחיקה</button>
                      </div>
                    </div></div>
                  </div>
                )
              })}
              {tracksOpen && mortgage && (
                <label className="liav-payday">
                  <span>יום חיוב חודשי</span>
                  <select
                    value={mortgage.payment_day != null ? String(mortgage.payment_day) : ''}
                    onChange={async e => {
                      const day = e.target.value ? Number(e.target.value) : null
                      try { await setMortgagePaymentDay(mortgage.id, day); refetchM() }
                      catch { setActionErr('לא הצלחנו לעדכן את יום החיוב — נסו שוב') }
                    }}
                  >
                    <option value="">כמו יום ההתחלה</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d} בחודש</option>)}
                  </select>
                </label>
              )}
              <div className="liav-add-row">
                <button className="liav-add-track" onClick={openAddMortgage}><Plus size={15} weight="bold" /> הוסף מסלול משכנתא</button>
                <button className="liav-scan-btn" onClick={() => mortgageDocRef.current?.click()} disabled={aiBusy !== null}>
                  {aiBusy === 'mortgage' ? <CircleNotch className="spin" size={15} weight="bold" /> : <Sparkle size={15} weight="fill" />}
                  {aiBusy === 'mortgage' ? 'קורא את המסמך…' : 'סריקת מסמך משכנתא (AI)'}
                </button>
              </div>
              <input ref={mortgageDocRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }}
                onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) scanMortgageDoc(fs); e.target.value = '' }} />
              {aiErr?.kind === 'mortgage' && <div className="liav-form-err" role="alert">{aiErr.msg}</div>}
              {scanResult?.kind === 'mortgage' && (
                <ScanReview kind="mortgage" initial={scanResult.drafts} saving={scanSaving} demo={useMock}
                  onConfirm={saveScannedDrafts} onCancel={() => setScanResult(null)} />
              )}
              {mortgageDocs.length > 0 && (
                <ScanDocList docs={mortgageDocs} busy={aiBusy === 'mortgage'} addLabel="הוספת מסמך משכנתא" onOpen={openDoc} onRename={renameDoc} onRemove={removeDoc} onAdd={() => mortgageDocRef.current?.click()} />
              )}
            </section>

          <section className="liav-section">
              <div className="liav-section-head"><HandCoins size={18} weight="duotone" color="var(--brand-navy)" /><h2>הלוואות</h2></div>
              {monthlyLoans.length > 1 && (
                <h3 className="liav-group-h">
                  <button type="button" className="liav-group-toggle sub" onClick={() => setRegularLoansOpen(o => !o)} aria-expanded={regularLoansOpen}>
                    <span className="liav-group-title">הלוואות רגילות · {monthlyLoans.length}</span>
                    <span className="liav-group-sum">{fmt(loansSummary.monthlyPayment)}/חודש</span>
                    <CaretDown className={`liav-group-caret${regularLoansOpen ? ' open' : ''}`} size={16} weight="bold" />
                  </button>
                </h3>
              )}
              {(monthlyLoans.length <= 1 || regularLoansOpen) && monthlyLoans.map(l => {
                const bal = loanBalance(l); const isOpen = open === l.id
                const paidPct = l.principal > 0 ? ((l.principal - bal) / l.principal) * 100 : 0
                return (
                  <div key={l.id} className={`liav-card${isOpen ? ' open' : ''}`}>
                    <button className="liav-card-head" onClick={() => setOpen(isOpen ? null : l.id)}>
                      <span className={`liav-badge ${l.track_type ? TRACK_COLOR[l.track_type] : 'teal'}`}>{l.track_type ? TRACK_LABEL[l.track_type] : 'שפיצר'}</span>
                      <div className="liav-card-main"><div className="liav-card-title">{l.label || 'הלוואה'}</div><div className="liav-card-sub">{[l.lender, `${fmt(loanMonthlyPayment(l))} לחודש`, Number.isFinite(Number(l.annual_rate)) ? `${Number(l.annual_rate).toFixed(1)}%` : null].filter(Boolean).join(' · ')}</div></div>
                      <div className="liav-card-balance"><b>{fmt(bal)}</b><span>יתרה</span></div>
                      <CaretDown className="liav-card-caret" size={16} weight="bold" />
                    </button>
                    <div className="liav-progress"><div className="liav-progress-track"><div className="liav-progress-fill teal" style={{ width: `${paidPct}%` }} /></div><div className="liav-progress-labels"><span>נפרעו {Math.round(paidPct)}%</span><span>{loanEndDate(l) ? `עד ${yearOf(loanEndDate(l))}` : ''}</span></div></div>
                    <div className="liav-detail"><div className="liav-detail-inner">
                      <div className="liav-detail-grid">
                        <div className="liav-detail-item"><span>קרן מקורית</span><strong>{fmt(l.principal)}</strong></div>
                        <div className="liav-detail-item"><span>תקופה</span><strong>{l.term_months ? `${Math.round(l.term_months / 12)} שנים` : '—'}</strong></div>
                        <div className="liav-detail-item"><span>ריבית ששולמה</span><strong className="interest">{fmt(loanInterestToDate(l))}</strong></div>
                      </div>
                      <div className="liav-detail-actions">
                        <button className="liav-detail-btn" onClick={() => editLoan(l)}><PencilSimple size={14} /> עריכה</button>
                        <button className="liav-detail-btn danger" onClick={() => setConfirmDelete({ kind: 'loan', id: l.id })}><Trash size={14} /> מחיקה</button>
                      </div>
                    </div></div>
                  </div>
                )
              })}
              {balloonLoans.length > 0 && (
                <h3 className="liav-group-h">
                  <button type="button" className="liav-group-toggle sub" onClick={() => setBalloonOpen(o => !o)} aria-expanded={balloonOpen}>
                    <Scales size={16} weight="duotone" color="var(--warning-text)" />
                    <span className="liav-group-title">הלוואות בלון · {balloonLoans.length}</span>
                    <span className="liav-group-sum">{fmt(balloonBal)}</span>
                    <CaretDown className={`liav-group-caret${balloonOpen ? ' open' : ''}`} size={16} weight="bold" />
                  </button>
                </h3>
              )}
              {balloonOpen && balloonLoans.map(l => (
                <div key={l.id} className="liav-balloon">
                  <div className="liav-balloon-top">
                    <div className="liav-balloon-icon"><Scales size={20} weight="duotone" /></div>
                    <div className="liav-balloon-main"><div className="liav-balloon-title">{l.label || 'הלוואת בלון'}{l.lender ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {l.lender}</span> : null}</div></div>
                    <div className="liav-balloon-amount">{fmt(l.principal)}</div>
                    <button className="liav-detail-btn icon-only" style={{ marginInlineStart: 8 }} onClick={() => editLoan(l)} aria-label="עריכת הלוואה" title="עריכה"><PencilSimple size={14} /></button>
                    <button className="liav-detail-btn danger icon-only" onClick={() => setConfirmDelete({ kind: 'loan', id: l.id })} aria-label="מחיקת הלוואה" title="מחיקה"><Trash size={14} /></button>
                  </div>
                  <div className="liav-balloon-note">בלון · נפרע במכירת הנכס · ללא תשלום חודשי</div>
                </div>
              ))}
              <div className="liav-add-row">
                <button className="liav-add-track" onClick={openAddLoan}><Plus size={15} weight="bold" /> הוסף הלוואה</button>
                <button className="liav-scan-btn" onClick={() => loanDocRef.current?.click()} disabled={aiBusy !== null}>
                  {aiBusy === 'loan' ? <CircleNotch className="spin" size={15} weight="bold" /> : <Sparkle size={15} weight="fill" />}
                  {aiBusy === 'loan' ? 'קורא את המסמך…' : 'סריקת מסמך הלוואה (AI)'}
                </button>
              </div>
              <input ref={loanDocRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }}
                onChange={e => { const fs = Array.from(e.target.files ?? []); if (fs.length) scanLoanDoc(fs); e.target.value = '' }} />
              {aiErr?.kind === 'loan' && <div className="liav-form-err" role="alert">{aiErr.msg}</div>}
              {scanResult?.kind === 'loan' && (
                <ScanReview kind="loan" initial={scanResult.drafts} saving={scanSaving} demo={useMock}
                  onConfirm={saveScannedDrafts} onCancel={() => setScanResult(null)} />
              )}
              {loanDocs.length > 0 && (
                <ScanDocList docs={loanDocs} busy={aiBusy === 'loan'} addLabel="הוספת מסמך הלוואה" onOpen={openDoc} onRename={renameDoc} onRemove={removeDoc} onAdd={() => loanDocRef.current?.click()} />
              )}
            </section>
        </>
      )}

      <BottomSheet open={drawerOpen} onClose={forceClose} onDismiss={closeDrawer} minimizable={false} title={editId ? (kind === 'mortgage' ? 'עריכת מסלול' : 'עריכת הלוואה') : (kind === 'mortgage' ? 'הוספת מסלול משכנתא' : 'הוספת הלוואה')}>
        {/* The sheet portals to <body>, outside the scoped `.liav` — re-wrap so the field CSS applies. */}
        <div className="liav"><div className="liav-sheet-form">
        {showFill && !editId && (
          <div className="onboarding-fill-top">
            <button type="button" className="onboarding-fill-top-btn" onClick={fillDrawerExample}>מילוי דוגמה</button>
          </div>
        )}

        {kind === 'mortgage' ? (
          <>
            <label className="liav-field"><span>סוג מסלול</span><select value={tForm.track_type} onChange={e => setTForm(f => ({ ...f, track_type: e.target.value as TrackType }))}>{MORTGAGE_TRACK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            <div className="liav-row2">
              <label className="liav-field"><span>קרן ₪</span><input type="text" inputMode="numeric" value={formatNum(tForm.principal)} onChange={e => setTForm(f => ({ ...f, principal: e.target.value.replace(/[^\d]/g, '') }))} autoFocus={drawerOpen} /></label>
              {isAnchoredType(tForm.track_type)
                ? <div className="liav-field" />
                : <label className="liav-field"><span>ריבית %</span><input type="number" step="0.01" value={tForm.annual_rate} onChange={e => setTForm(f => ({ ...f, annual_rate: e.target.value }))} /></label>}
            </div>
            {/* R8: prime/variable tracks keep the anchor+margin split (mirrors the loan form). */}
            {isAnchoredType(tForm.track_type) && (
              <div className="liav-row2">
                <label className="liav-field"><span>עוגן (פריים/בסיס) %</span><input type="number" step="0.01" value={tForm.prime_rate} onChange={e => setTForm(f => ({ ...f, prime_rate: e.target.value }))} placeholder="6.00" /></label>
                <label className="liav-field"><span>מרווח % (פריים מינוס = שלילי)</span><input type="number" step="0.01" value={tForm.margin} onChange={e => setTForm(f => ({ ...f, margin: e.target.value }))} placeholder="-0.50" /></label>
              </div>
            )}
            <div className="liav-row2">
              <label className="liav-field"><span>תקופה (חודשים)</span><input type="number" value={tForm.term_months} onChange={e => setTForm(f => ({ ...f, term_months: e.target.value }))} /></label>
              {graceOn
                ? <label className="liav-field"><span>גרייס (חודשים)</span><input type="number" min="0" value={tForm.grace_months} onChange={e => setTForm(f => ({ ...f, grace_months: e.target.value }))} /></label>
                : <div className="liav-field" />}
            </div>
            <label className="liav-grace-toggle">
              <input type="checkbox" checked={graceOn} onChange={e => { setGraceOn(e.target.checked); if (e.target.checked && !Number(tForm.grace_months)) setTForm(f => ({ ...f, grace_months: '1' })) }} />
              <span>תקופת גרייס</span>
            </label>
            <label className="liav-field"><span>תאריך התחלה</span><DateField value={tForm.start_date} onChange={v => setTForm(f => ({ ...f, start_date: v }))} ariaLabel="תאריך התחלה" /></label>
            <label className="liav-field"><span>תווית (אופציונלי)</span><input type="text" value={tForm.label} onChange={e => setTForm(f => ({ ...f, label: e.target.value }))} /></label>
          </>
        ) : (
          <>
            <label className="liav-field"><span>סוג החזר</span><select value={lForm.repayment_type} onChange={e => setLForm(f => ({ ...f, repayment_type: e.target.value as LoanRepaymentType }))}><option value="monthly_fixed">שפיצר (חודשי קבוע)</option><option value="balloon">בלון (נפרע במכירה)</option></select></label>
            {lForm.repayment_type === 'monthly_fixed' && (
              <label className="liav-field"><span>סוג מסלול</span><select value={lForm.track_type} onChange={e => setLForm(f => ({ ...f, track_type: e.target.value as TrackType }))}>{MORTGAGE_TRACK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            )}
            <div className="liav-row2">
              <label className="liav-field"><span>קרן ₪</span><input type="text" inputMode="numeric" value={formatNum(lForm.principal)} onChange={e => setLForm(f => ({ ...f, principal: e.target.value.replace(/[^\d]/g, '') }))} autoFocus={drawerOpen} /></label>
              <label className="liav-field"><span>מלווה</span><input type="text" value={lForm.lender} onChange={e => setLForm(f => ({ ...f, lender: e.target.value }))} /></label>
            </div>
            {lForm.repayment_type === 'monthly_fixed' && (
              <>
                {isAnchoredType(lForm.track_type) ? (
                  <div className="liav-row2">
                    <label className="liav-field"><span>עוגן (פריים/בסיס) %</span><input type="number" step="0.01" value={lForm.prime_rate} onChange={e => setLForm(f => ({ ...f, prime_rate: e.target.value }))} placeholder="6.00" /></label>
                    <label className="liav-field"><span>מרווח % (פריים מינוס = שלילי)</span><input type="number" step="0.01" value={lForm.margin} onChange={e => setLForm(f => ({ ...f, margin: e.target.value }))} placeholder="-0.50" /></label>
                  </div>
                ) : (
                  <label className="liav-field"><span>ריבית %</span><input type="number" step="0.01" value={lForm.annual_rate} onChange={e => setLForm(f => ({ ...f, annual_rate: e.target.value }))} /></label>
                )}
                <div className="liav-row2">
                  <label className="liav-field"><span>תקופה (חודשים)</span><input type="number" value={lForm.term_months} onChange={e => setLForm(f => ({ ...f, term_months: e.target.value }))} /></label>
                  <div className="liav-field" />
                </div>
                <div className="liav-row2">
                  {graceOn
                    ? <label className="liav-field"><span>גרייס (חודשים)</span><input type="number" min="0" value={lForm.grace_months} onChange={e => setLForm(f => ({ ...f, grace_months: e.target.value }))} /></label>
                    : <div className="liav-field" />}
                  <div className="liav-field" />
                </div>
                <label className="liav-grace-toggle">
                  <input type="checkbox" checked={graceOn} onChange={e => { setGraceOn(e.target.checked); if (e.target.checked && !Number(lForm.grace_months)) setLForm(f => ({ ...f, grace_months: '1' })) }} />
                  <span>תקופת גרייס</span>
                </label>
              </>
            )}
            <label className="liav-field"><span>תאריך התחלה</span><DateField value={lForm.start_date} onChange={v => setLForm(f => ({ ...f, start_date: v }))} ariaLabel="תאריך התחלה" /></label>
            {lForm.repayment_type === 'monthly_fixed' && (
              <label className="liav-field"><span>יום חיוב</span>
                <select value={lForm.payment_day} onChange={e => setLForm(f => ({ ...f, payment_day: e.target.value }))}>
                  <option value="">כמו יום ההתחלה</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={String(d)}>{d} בחודש</option>)}
                </select>
              </label>
            )}
            <label className="liav-field"><span>תווית (אופציונלי)</span><input type="text" value={lForm.label} onChange={e => setLForm(f => ({ ...f, label: e.target.value }))} /></label>
          </>
        )}
        {formError && <div className="liav-form-err" role="alert">{formError}</div>}
        <button className="liav-save" disabled={saving} onClick={save}>{saving ? 'שומר…' : 'שמירה'}</button>
        </div></div>
        <ConfirmDialog
          open={confirmDiscard}
          title="לצאת בלי לשמור?"
          message="מה שהוזן לא יישמר."
          confirmLabel="יציאה" cancelLabel="המשך עריכה" tone="danger"
          onConfirm={forceClose}
          onCancel={() => setConfirmDiscard(false)}
        />
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete !== null}
        tone="danger"
        title={confirmDelete?.kind === 'track' ? 'למחוק את המסלול?' : 'למחוק את ההלוואה?'}
        message="הנתונים והתשלום החודשי בתחזית יוסרו. אי אפשר לבטל את הפעולה."
        confirmLabel="מחיקה"
        onConfirm={() => {
          if (confirmDelete?.kind === 'track') removeTrack(confirmDelete.id)
          else if (confirmDelete) removeLoan(confirmDelete.id)
          setConfirmDelete(null)
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
