// Categories for one-time transactions
export const INCOME_CATEGORIES = ['שכר דירה', 'אחר'] as const
export const EXPENSE_CATEGORIES = ['תיקונים', 'אחר'] as const

// Categories for recurring item templates (includes mortgage, insurance)
export const RECURRING_INCOME_CATEGORIES = ['שכר דירה', 'אחר'] as const
export const RECURRING_EXPENSE_CATEGORIES = [
  'משכנתא – בנק',
  'משכנתא – אב',
  'ביטוח',
  'תיקונים',
  'אחר',
] as const

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
