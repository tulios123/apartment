import type { TrackType, LoanRepaymentType } from '../../types'
import { todayISO } from '../../lib/format'

// ── Step types ────────────────────────────────────────────────────────────────
export type Step = 'welcome' | 'documents' | 'purchase' | 'mortgage' | 'loans' | 'investment' | 'rental' | 'insurance' | 'done'

export const STEP_ORDER: Step[] = ['purchase', 'mortgage', 'loans', 'investment', 'rental', 'insurance']

// ── Draft types ────────────────────────────────────────────────────────────────
export type TrackDraft = {
  track_type: TrackType
  principal: string
  annual_rate: string
  prime_rate: string
  margin: string
  term_months: string
  grace_months: string
  start_date: string
}

export type PolicyDraft = {
  type: string
  company: string
  monthly_premium: string
  start_date: string
  end_date: string
}

export type LoanDraft = {
  repayment_type: LoanRepaymentType
  track_type: TrackType
  label: string
  lender: string
  principal: string
  annual_rate: string
  prime_rate: string
  margin: string
  term_months: string
  grace_months: string
  start_date: string
}

export type ExtraCost = { name: string; amount: string }

// A single balloon loan (interest-free, repaid on sale) — e.g. 50k from each parent.
export type BalloonRow = { amount: string; lender: string }

export function emptyTrack(startDate?: string): TrackDraft {
  return {
    track_type: 'fixed_unlinked',
    principal: '',
    annual_rate: '',
    prime_rate: '',
    margin: '',
    term_months: '',
    grace_months: '',
    start_date: startDate || todayISO(),
  }
}

export function emptyPolicy(): PolicyDraft {
  return { type: 'חיים', company: '', monthly_premium: '', start_date: '', end_date: '' }
}

export function emptyLoan(startDate?: string): LoanDraft {
  return {
    repayment_type: 'monthly_fixed',
    track_type: 'fixed_unlinked',
    label: '',
    lender: '',
    principal: '',
    annual_rate: '',
    prime_rate: '',
    margin: '',
    term_months: '',
    grace_months: '',
    start_date: startDate || todayISO(),
  }
}

export const INS_TYPES = ['מבנה', 'חיים', 'משכנתא', 'תכולה', 'אחר']

export const TRACK_TYPES: TrackType[] = ['prime', 'fixed_unlinked', 'fixed_linked', 'variable']

// ── Helpers ────────────────────────────────────────────────────────────────────
export function formatPrice(raw: string) {
  if (!raw) return ''
  return Number(raw).toLocaleString('he-IL')
}

export function formatCurrency(n: number) {
  // Sign-aware: a negative value (e.g. equity net of balloon loans) must read
  // "-₪50,000", not the malformed "₪-50,000".
  const r = Math.round(n)
  return (r < 0 ? '-' : '') + '₪' + Math.abs(r).toLocaleString('he-IL')
}

export function formatNum(raw: string | number): string {
  const str = String(raw)
  if (str === '') return ''
  const n = Number(str)
  return isNaN(n) ? str : n.toLocaleString('he-IL')
}

export function defaultLawyerCost(price: number): string {
  return price > 0 ? String(Math.round((price * 0.005 + 1000) * 1.18)) : ''
}

export function defaultBrokerageCost(price: number): string {
  return price > 0 ? String(Math.round(price * 0.02 * 1.18)) : ''
}
