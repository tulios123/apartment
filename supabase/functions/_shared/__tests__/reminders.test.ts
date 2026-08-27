import { describe, it, expect } from 'vitest'
import { pendingApprovalItems, reminderLine, isRentLike } from '../reminders'
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
