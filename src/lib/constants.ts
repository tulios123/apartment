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
] as const

export const MORTGAGE_TRACK_TYPES: { value: string; label: string }[] = [
  { value: 'prime',          label: 'פריים' },
  { value: 'fixed_unlinked', label: 'קבועה לא צמודה (קל"צ)' },
  { value: 'fixed_linked',   label: 'קבועה צמודה' },
  { value: 'variable',       label: 'משתנה' },
]

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
