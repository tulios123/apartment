import { RENT_CATEGORIES } from './constants'
import type { Task } from '../types'

// Tasks whose category/source imply a money movement. Kept here (not inline in a
// screen) so every completion surface — the Tasks hub AND the dashboard hero card —
// offers the same "record the transaction?" follow-up. Previously this logic lived
// only in TasksV2, so completing the same task from the dashboard recorded nothing.

const REPAIR_CATEGORY = 'תיקונים ותחזוקה'

export type TaskFollowup = {
  msg: string
  prefill: { direction: 'income' | 'expense'; category: string; description: string }
}

// Returns the follow-up prompt + transaction prefill for a just-completed task,
// or null when completion carries no money implication. Mirrors the recurring
// approval flow from the spec: marking a "collect rent" / "pay …" task done leads
// to recording the matching transaction.
export function taskCompletionFollowup(t: Task): TaskFollowup | null {
  if (t.category === REPAIR_CATEGORY) {
    return {
      msg: 'המשימה הושלמה. להזין הוצאת תיקון עבור משימה זו?',
      prefill: { direction: 'expense', category: 'תיקונים', description: t.title },
    }
  }
  if (t.source === 'recurring_item' && t.title.startsWith('גביית')) {
    return {
      msg: 'המשימה הושלמה. להזין קבלת שכר דירה?',
      prefill: { direction: 'income', category: RENT_CATEGORIES[0], description: t.title },
    }
  }
  // Expense approvals from generation are titled "תשלום …" (e.g. the monthly
  // transfer to dad) — previously these prompted nothing.
  if (t.source === 'recurring_item' && t.title.startsWith('תשלום')) {
    return {
      msg: 'המשימה הושלמה. להזין את התשלום?',
      prefill: { direction: 'expense', category: 'אחר', description: t.title },
    }
  }
  return null
}
