import { describe, it, expect } from 'vitest'
import type { Task } from '../../types'
import { visibleHomeTasks, sortedHomeTasks } from '../homeTasks'

function task(p: Partial<Task>): Task {
  return { id: 't', title: '', category: 'כללי', source: 'manual', status: 'open', ...p } as unknown as Task
}

const TODAY = '2026-07-11'

describe('visibleHomeTasks', () => {
  it('hides a task dated more than 2 days ahead', () => {
    const t = task({ id: 'far', due_date: '2026-07-14' }) // 3 days out
    expect(visibleHomeTasks([t], TODAY)).toEqual([])
  })

  it('shows a task exactly 2 days before its date (the lead window edge)', () => {
    const t = task({ id: 'edge', due_date: '2026-07-13' })
    expect(visibleHomeTasks([t], TODAY).map(x => x.id)).toEqual(['edge'])
  })

  it('shows a task due today', () => {
    const t = task({ id: 'today', due_date: TODAY })
    expect(visibleHomeTasks([t], TODAY).map(x => x.id)).toEqual(['today'])
  })

  it('shows an overdue task', () => {
    const t = task({ id: 'late', due_date: '2026-07-01' })
    expect(visibleHomeTasks([t], TODAY).map(x => x.id)).toEqual(['late'])
  })

  it('always shows an undated task', () => {
    const t = task({ id: 'undated', due_date: null })
    expect(visibleHomeTasks([t], TODAY).map(x => x.id)).toEqual(['undated'])
  })

  it('sorts dated (soonest first) ahead of undated, hiding the far-future one', () => {
    const tasks = [
      task({ id: 'undated', due_date: null }),
      task({ id: 'far', due_date: '2026-08-01' }),   // hidden
      task({ id: 'soon', due_date: '2026-07-12' }),  // within window
      task({ id: 'late', due_date: '2026-07-05' }),  // overdue
    ]
    expect(visibleHomeTasks(tasks, TODAY).map(x => x.id)).toEqual(['late', 'soon', 'undated'])
  })
})

describe('sortedHomeTasks', () => {
  it('keeps every task regardless of date, dated (soonest first) ahead of undated', () => {
    const tasks = [
      task({ id: 'undated', due_date: null }),
      task({ id: 'far', due_date: '2026-08-01' }),
      task({ id: 'soon', due_date: '2026-07-12' }),
      task({ id: 'late', due_date: '2026-07-05' }),
    ]
    // Unlike visibleHomeTasks, the far-future task is NOT dropped — this is the full
    // list the "+ עוד X משימות" pill expands into.
    expect(sortedHomeTasks(tasks).map(x => x.id)).toEqual(['late', 'soon', 'far', 'undated'])
  })

  it('keeps a lone week-away task the collapsed view hides (owner: "task disappeared")', () => {
    // The reported bug: a single task a week out vanished from the home entirely —
    // filtered out of the collapsed view AND not counted anywhere. It must still live
    // in the full list so "+ עוד 1 משימה" surfaces it.
    const t = task({ id: 'week', due_date: '2026-07-18' }) // 7 days out
    expect(visibleHomeTasks([t], TODAY)).toEqual([])
    expect(sortedHomeTasks([t]).map(x => x.id)).toEqual(['week'])
  })
})
