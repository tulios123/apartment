import type { TrackType } from '../types'

// Canonical category sets — use these for filtering, never raw strings
export const RENT_CATEGORIES = ['שכר דירה', 'שכירות'] as const   // accept legacy
export const MORTGAGE_CATEGORIES = ['משכנתא', 'משכנתא – בנק', 'משכנתא – אב'] as const
export const INTEREST_CATEGORY = 'ריבית'
export const MAINTENANCE_CATEGORY = 'תיקונים'

// Lease lifecycle reminders: a renewal task/alert pops this many days before a
// contract ends (≈2 months), then reminders repeat monthly until it ends; once
// there's no active contract, a "no lease" reminder repeats fortnightly.
export const RENEWAL_WINDOW_DAYS = 60
export const RENEWAL_REPEAT_DAYS = 28      // ~monthly push while in the window
export const NO_LEASE_REPEAT_DAYS = 14     // fortnightly push when no active lease

// A dated task surfaces on the home action list only once it's this close (or
// overdue) — a task scheduled far ahead stays out of the way until it matters.
// Undated backlog tasks always show.
export const TASK_HOME_LEAD_DAYS = 2

// Categories for one-time transactions
export const INCOME_CATEGORIES = ['שכר דירה', 'אחר'] as const
export const EXPENSE_CATEGORIES = ['תיקונים', 'ריבית', 'אחר'] as const

// Categories for recurring item templates (includes mortgage, insurance)
export const RECURRING_INCOME_CATEGORIES = ['שכר דירה', 'אחר'] as const
export const RECURRING_EXPENSE_CATEGORIES = [
  'משכנתא – בנק',
  'משכנתא – אב',
  'ביטוח',
  'תיקונים',
  'ריבית',
  'אחר',
] as const

export const INVESTMENT_COST_CATEGORIES = [
  { value: 'self_equity',        label: 'הון עצמי' },
  { value: 'lawyer',             label: 'עורך דין' },
  { value: 'brokerage',          label: 'דמי תיווך' },
  { value: 'mortgage_advisor',   label: 'יועץ משכנתאות' },
  { value: 'investment_company', label: 'חברת ליווי השקעה' },
  { value: 'appraiser',          label: 'שמאי' },
] as const

export const MORTGAGE_TRACK_TYPES: { value: string; label: string }[] = [
  { value: 'prime',          label: 'פריים' },
  { value: 'fixed_unlinked', label: 'קבועה לא צמודה (קל"צ)' },
  { value: 'fixed_linked',   label: 'קבועה צמודה' },
  { value: 'variable',       label: 'משתנה' },
]

// SW-21: ONE canonical mortgage-track presentation set — label, chart color and
// badge class per track type. These used to be re-declared (and drift) in
// FinancingStructure, LiabilitiesV2 and ScanReview. The wizard's select keeps its
// own long-form labels in MORTGAGE_TRACK_TYPES above (e.g. the קל"צ suffix).
export const TRACK_LABELS: Record<TrackType, string> = {
  prime: 'פריים', fixed_unlinked: 'קבועה לא צמודה', fixed_linked: 'קבועה צמודה', variable: 'משתנה',
}
export const TRACK_COLORS: Record<TrackType, string> = {
  prime: '#5aa0ec', fixed_unlinked: 'var(--accent-teal)', fixed_linked: 'var(--accent-2)', variable: '#f0b24e',
}
export const TRACK_BADGES: Record<TrackType, string> = {
  prime: 'blue', fixed_unlinked: 'teal', fixed_linked: 'purple', variable: 'amber',
}

// SW-17/18/19: shared UI timings — previously copy-pasted magic numbers.
// SHEET_CLOSE_MS mirrors the 0.35s slide-out in bottom-sheet.css (+ a hair, so
// unmount never races the transition); MOCK_SCAN_DELAY_MS is the simulated
// document-scan latency used by the demo/mock paths.
export const SHEET_CLOSE_MS = 360
export const MOCK_SCAN_DELAY_MS = 600

export const TASK_CATEGORIES = ['תיקונים ותחזוקה', 'ביקור ובדיקה', 'כללי'] as const

export const UTILITIES = ['ארנונה', 'מים', 'חשמל', 'ועד בית'] as const

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: '', label: 'לא צוין' },
  { value: 'bit', label: 'ביט' },
  { value: 'cash', label: 'מזומן' },
  { value: 'check', label: "צ'ק" },
  { value: 'bank_transfer', label: 'העברה בנקאית' },
  { value: 'standing_order', label: 'הוראת קבע' },
]
