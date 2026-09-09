import { describe, it, expect } from 'vitest'
import { buildPlan, resolveDates, nextPayment, nextStep, planTotals, setDone, setAmount } from '../purchasePlan'

// The owner's own deal — the one the spec was written from.
const plan = () => buildPlan({
  price: 1_090_000,
  signing: '2026-07-10',
  handover: '2027-04-12',
  firstPct: 10,
  secondPct: 15,
  singleApartment: true,
  costs: [{ label: 'תיווך', amount: 25_724 }, { label: 'עורך דין', amount: 7_611 }],
})

describe('buildPlan — his percentages, our arithmetic', () => {
  it('turns the split into shekels', () => {
    const p = plan()
    const find = (id: string) => p.items.find(i => i.id === id)!
    expect(find('pay1').amount).toBe(109_000)   // 10%
    expect(find('pay2').amount).toBe(163_500)   // 15%
    expect(find('pay3').amount).toBe(817_500)   // the remaining 75%
  })

  it('computes purchase tax and dates it from the SIGNING, not the handover', () => {
    const p = plan()
    const tax = p.items.find(i => i.id === 'tax-pay')!
    expect(tax.amount).toBe(0)                  // single apartment, under the exempt bracket
    expect(tax.due).toBe('2026-09-08')          // signing + 60, the legal deadline
    expect(p.items.find(i => i.id === 'tax-report')!.due).toBe('2026-08-09')  // +30
  })

  it('an investor pays from the first shekel — same flat, 87,200 ₪ apart', () => {
    const investor = buildPlan({ ...plan(), singleApartment: false })
    expect(investor.items.find(i => i.id === 'tax-pay')!.amount).toBe(87_200)
  })

  it('a second/third split works the same — 15 then 10', () => {
    const p = buildPlan({ ...plan(), firstPct: 15, secondPct: 10 })
    expect(p.items.find(i => i.id === 'pay1')!.amount).toBe(163_500)
    expect(p.items.find(i => i.id === 'pay2')!.amount).toBe(109_000)
  })
})

describe('the chain — gates, not dates', () => {
  it('the second payment has NO date until the caution is registered', () => {
    const p = plan()
    const before = resolveDates(p).find(i => i.id === 'pay2')!
    expect(before.due).toBeNull()   // the truth: we do not know yet, so we do not invent
  })

  it('marking the caution done dates it — a month from the RELEASE', () => {
    const p = setDone(plan(), 'caution', true)
    const after = resolveDates(p).find(i => i.id === 'pay2')!
    // doneAt is today, so the date is today + 30 — not signing + 30.
    expect(after.due).not.toBeNull()
    expect(after.due! > p.signing).toBe(true)
  })

  it('un-marking it takes the date away again', () => {
    const p = setDone(setDone(plan(), 'caution', true), 'caution', false)
    expect(resolveDates(p).find(i => i.id === 'pay2')!.due).toBeNull()
  })
})

describe('the headline numbers', () => {
  it('the next payment is the earliest unpaid one with money on it', () => {
    expect(nextPayment(plan())!.id).toBe('pay1')
  })

  it('once it is paid the headline moves on — and never to a gate', () => {
    const p = setDone(plan(), 'pay1', true)
    const next = nextPayment(p)!
    expect(next.amount).toBeGreaterThan(0)
    expect(next.id).not.toBe('caution')
  })

  it('the next STEP can be a gate — that is the difference between the two', () => {
    expect(nextStep(setDone(plan(), 'pay1', true))!.id).toBe('caution')
  })

  it('the target is what leaves his pocket — the mortgage is not his money', () => {
    const t = planTotals(plan())
    // 109,000 + 163,500 + tax 0 + 25,724 + 7,611
    expect(t.fromPocket).toBe(305_835)
    expect(t.paid).toBe(0)
  })

  it('paying moves the progress, and only by what was paid', () => {
    const t = planTotals(setDone(plan(), 'pay1', true))
    expect(t.paid).toBe(109_000)
    expect(t.left).toBe(196_835)
    expect(Math.round(t.paidPct)).toBe(36)
  })
})

describe('editing is confirming', () => {
  it('a touched amount is his, and is marked certain', () => {
    const p = setAmount(plan(), 'cost-תיווך', 30_000)
    const c = p.items.find(i => i.id === 'cost-תיווך')!
    expect(c.amount).toBe(30_000)
    expect(c.certain).toBe(true)
  })
})
