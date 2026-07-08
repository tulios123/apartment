import { describe, it, expect } from 'vitest'
import type { Task } from '../../types'
import { taskCompletionFollowup } from '../taskFollowup'

function task(p: Partial<Task>): Task {
  return { id: 't', title: '', category: 'כללי', source: 'manual', status: 'open', ...p } as unknown as Task
}

describe('taskCompletionFollowup', () => {
  it('repair task → expense prefill (valid תיקונים category, title carried)', () => {
    const f = taskCompletionFollowup(task({ category: 'תיקונים ותחזוקה', title: 'תיקון דוד שמש' }))
    expect(f).not.toBeNull()
    expect(f!.prefill).toEqual({ direction: 'expense', category: 'תיקונים', description: 'תיקון דוד שמש' })
  })
  it('recurring rent-collection task → income prefill (rent category)', () => {
    const f = taskCompletionFollowup(task({ source: 'recurring_item', title: 'גביית שכר דירה' }))
    expect(f!.prefill.direction).toBe('income')
    expect(f!.prefill.category).toBe('שכר דירה')
  })
  it('recurring payment task → expense prefill (אחר)', () => {
    const f = taskCompletionFollowup(task({ source: 'recurring_item', title: 'תשלום לאבא' }))
    expect(f!.prefill).toEqual({ direction: 'expense', category: 'אחר', description: 'תשלום לאבא' })
  })
  it('non-money task → no follow-up', () => {
    expect(taskCompletionFollowup(task({ category: 'ביקור ובדיקה', title: 'לבדוק נזילה' }))).toBeNull()
  })
  it('a "גביית" titled task that is NOT from a recurring item → no follow-up', () => {
    expect(taskCompletionFollowup(task({ source: 'manual', title: 'גביית שכר דירה' }))).toBeNull()
  })
})
