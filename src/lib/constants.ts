export const OWNER_ID = '00000000-0000-0000-0000-000000000001'

export const INCOME_CATEGORIES = ['שכר דירה', 'אחר'] as const

export const EXPENSE_CATEGORIES = [
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
