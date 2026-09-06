import { describe, it, expect } from 'vitest'
import { awaitingKeyDelivery, dueDayOfMonth, pendingApprovalItems, reminderLine, isRentLike } from '../reminders'
import type { DueItem, MonthTx } from '../reminders'

const rentCheck: DueItem = {
  id: 'rent-1',
  direction: 'income',
  category: 'שכר דירה',
  payee: 'דייר',
  payment_method: 'check',
}

describe('pendingApprovalItems', () => {
  it('nags to deposit the check when no rent was recorded this month', () => {
    const pending = pendingApprovalItems([rentCheck], [])
    expect(pending.map((i) => i.id)).toEqual(['rent-1'])
    expect(reminderLine(pending[0])).toBe('הפקדת צ׳ק שכר דירה – דייר')
  })

  it('stays silent when the deposit is linked to the recurring item', () => {
    const tx: MonthTx[] = [{ recurring_item_id: 'rent-1', direction: 'income', category: 'שכר דירה' }]
    expect(pendingApprovalItems([rentCheck], tx)).toEqual([])
  })

  // #53: the owner deposited the check but recorded it as a plain rent-category income
  // (not linked to the recurring item) — the push must NOT nag to deposit it again.
  it('stays silent when a rent-category income landed this month, even unlinked', () => {
    const tx: MonthTx[] = [{ recurring_item_id: null, direction: 'income', category: 'שכר דירה' }]
    expect(pendingApprovalItems([rentCheck], tx)).toEqual([])
  })

  it('still recognises the legacy "שכירות" rent category', () => {
    const tx: MonthTx[] = [{ recurring_item_id: null, direction: 'income', category: 'שכירות' }]
    expect(pendingApprovalItems([rentCheck], tx)).toEqual([])
  })

  it('does not silence a rent item just because an unrelated expense was recorded', () => {
    const tx: MonthTx[] = [{ recurring_item_id: null, direction: 'expense', category: 'תיקונים' }]
    expect(pendingApprovalItems([rentCheck], tx).map((i) => i.id)).toEqual(['rent-1'])
  })

  it('still nags a non-rent expense item even when rent was recorded', () => {
    const expense: DueItem = {
      id: 'pay-1', direction: 'expense', category: 'ועד בית', payee: null, payment_method: null,
    }
    const tx: MonthTx[] = [{ recurring_item_id: null, direction: 'income', category: 'שכר דירה' }]
    const pending = pendingApprovalItems([rentCheck, expense], tx)
    expect(pending.map((i) => i.id)).toEqual(['pay-1'])
    expect(reminderLine(pending[0])).toBe('תשלום ועד בית')
  })
})

describe('rent-cheque items are silenced by the same rule that words them', () => {
  // Regression (owner, 28.07): reminderLine() calls anything income+cheque a rent
  // cheque, but the silencing rule required a rent CATEGORY. An income-by-cheque item
  // filed under another category therefore nagged forever — recording the rent could
  // never quiet it.
  const chequeUnderOtherCategory = {
    id: 'r1', direction: 'income', category: 'אחר', payee: 'דייר', payment_method: 'check',
  }

  it('words it as a rent-cheque deposit', () => {
    expect(reminderLine(chequeUnderOtherCategory)).toContain('הפקדת צ׳ק שכר דירה')
  })

  it('treats it as rent for silencing too', () => {
    expect(isRentLike(chequeUnderOtherCategory)).toBe(true)
  })

  it('goes quiet once any rent income is recorded that month', () => {
    const pending = pendingApprovalItems(
      [chequeUnderOtherCategory],
      [{ recurring_item_id: null, direction: 'income', category: 'שכר דירה' }],
    )
    expect(pending).toEqual([])
  })

  it('still reminds while nothing has been recorded', () => {
    expect(pendingApprovalItems([chequeUnderOtherCategory], [])).toHaveLength(1)
  })

  it('leaves a genuine expense approval alone', () => {
    const expense = { id: 'e1', direction: 'expense', category: 'ועד בית', payee: null, payment_method: 'check' }
    expect(isRentLike(expense)).toBe(false)
    expect(pendingApprovalItems(
      [expense],
      [{ recurring_item_id: null, direction: 'income', category: 'שכר דירה' }],
    )).toHaveLength(1)
  })
})

describe('dueDayOfMonth', () => {
  const item = { day_of_month: 1, contract_id: 'c1' }

  it('falls back to the lease start day when the item is still on the default 1st', () => {
    // The bug: every rent item was created with day_of_month = 1, so the "deposit the
    // cheque" push fired from the 1st even for a lease (and cheques) dated the 15th.
    expect(dueDayOfMonth(item, { start_date: '2026-03-15' })).toBe(15)
  })

  it('never overrides a day the item already carries', () => {
    expect(dueDayOfMonth({ day_of_month: 5, contract_id: 'c1' }, { start_date: '2026-03-20' })).toBe(5)
  })

  it('clamps to 28 so the day exists in February too', () => {
    expect(dueDayOfMonth(item, { start_date: '2026-03-31' })).toBe(28)
  })

  it('keeps the 1st when nothing else is known', () => {
    expect(dueDayOfMonth(item, null)).toBe(1)
  })
})

describe('awaitingKeyDelivery', () => {
  const today = '2026-09-06'

  it('is waiting while the key delivery is still ahead', () => {
    // The owner's brother and friend: they bought, the handover is months away, and the
    // fortnightly "add a tenant" push asked them to let a flat they cannot enter.
    expect(awaitingKeyDelivery([{ key_delivery_date: '2027-03-01' }], today)).toBe(true)
  })

  it('is not waiting once the delivery date has arrived or passed', () => {
    expect(awaitingKeyDelivery([{ key_delivery_date: today }], today)).toBe(false)
    expect(awaitingKeyDelivery([{ key_delivery_date: '2025-01-01' }], today)).toBe(false)
  })

  it('treats a missing date as possession, so no existing owner loses the nudge', () => {
    expect(awaitingKeyDelivery([{ key_delivery_date: null }], today)).toBe(false)
    expect(awaitingKeyDelivery([{}], today)).toBe(false)
  })

  it('is not waiting when any property is already in hand', () => {
    expect(awaitingKeyDelivery(
      [{ key_delivery_date: '2027-03-01' }, { key_delivery_date: '2025-01-01' }], today,
    )).toBe(false)
  })

  it('is not waiting when there is no property at all', () => {
    expect(awaitingKeyDelivery([], today)).toBe(false)
  })
})
