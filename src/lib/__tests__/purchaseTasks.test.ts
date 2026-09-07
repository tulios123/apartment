import { describe, it, expect } from 'vitest'
import { purchaseTaskPlan, PURCHASE_TASK_TITLES } from '../purchaseTasks'

const today = '2026-09-07'
const keyDate = '2027-04-07'   // seven months out

describe('purchaseTaskPlan', () => {
  const plan = purchaseTaskPlan(keyDate, today)

  it('anchors each task to the handover date', () => {
    const byTitle = Object.fromEntries(plan.map(t => [t.title, t.due_date]))
    expect(byTitle['להתחיל לחפש שוכר']).toBe('2027-02-06')          // 60 days before
    expect(byTitle['בדיקת ליקויים לקראת המסירה']).toBe('2027-03-24') // 14 days before
    expect(byTitle['להעביר חשמל, מים, ארנונה וועד בית על שמכם']).toBe(keyDate)
  })

  it('seeds exactly one undated task — the dates we are not entitled to invent', () => {
    // Purchase tax and the instalments to the seller carry legal and contractual
    // deadlines that differ per deal. The app asks; it does not guess.
    const undated = plan.filter(t => t.due_date === null)
    expect(undated).toHaveLength(1)
    expect(undated[0].title).toBe('לקבוע את מועדי התשלום מהחוזה')
  })

  it('keeps the home calm — at most one task inside the two-day window', () => {
    // An undated task is always visible and dated ones surface two days out, so on day
    // one this must amount to a single visible item, not a wall.
    const visibleNow = plan.filter(t => t.due_date === null || t.due_date <= '2026-09-09')
    expect(visibleNow).toHaveLength(1)
  })

  it('never hands someone a task that is already overdue', () => {
    // Signing up three weeks before handover must not produce five red rows for work
    // they were never asked to do.
    const soon = purchaseTaskPlan('2026-09-28', today)
    for (const t of soon) {
      if (t.due_date) expect(t.due_date >= today).toBe(true)
    }
    // …and the ones whose anchor has passed collapse onto today, which is honest: if
    // handover is in three weeks, the insurance really is due now.
    expect(soon.filter(t => t.due_date === today).length).toBeGreaterThan(0)
  })

  it('uses only categories the app already offers, so editing one cannot reset it', () => {
    const known = new Set(['תיקונים ותחזוקה', 'ביקור ובדיקה', 'כללי'])
    for (const t of plan) expect(known.has(t.category)).toBe(true)
  })

  it('exposes its titles for the once-only detection', () => {
    expect(PURCHASE_TASK_TITLES).toHaveLength(plan.length)
    expect(new Set(PURCHASE_TASK_TITLES).size).toBe(plan.length)
  })
})
