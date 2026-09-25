import { describe, it, expect } from 'vitest'
import { checklistSlots } from '../documentChecklist'

/**
 * Omer's note 14: the wizard and the Documents screen asked for different documents, so a
 * freshly-finished account opened Documents to find something "missing" that nothing had
 * ever asked for. The point of this module is that there is one list; these tests are what
 * stop a second one growing back.
 */
describe('the document checklist is one list', () => {
  const bare = { hasLease: false, hasMortgage: false, hasLoan: false }

  it('asks everyone for the purchase contract, the tabu extract and insurance', () => {
    expect(checklistSlots(bare).map(s => s.type))
      .toEqual(['purchase_contract', 'tabu_extract', 'insurance_policy'])
  })

  it('adds the conditional documents only when the account has that thing', () => {
    expect(checklistSlots({ hasLease: true, hasMortgage: true, hasLoan: true }).map(s => s.type))
      .toEqual(['purchase_contract', 'tabu_extract', 'mortgage_statement', 'loan_statement', 'rental_contract', 'insurance_policy'])
    expect(checklistSlots({ ...bare, hasMortgage: true }).map(s => s.type))
      .toContain('mortgage_statement')
    expect(checklistSlots({ ...bare, hasMortgage: true }).map(s => s.type))
      .not.toContain('rental_contract')
  })

  it('offers every slot in the wizard, where nothing is known yet', () => {
    // The wizard is not claiming anything is missing — it is offering a place to put each
    // document. So it must be a superset of anything the Documents screen can ask for.
    const wizard = checklistSlots('wizard').map(s => s.type)
    const everything = checklistSlots({ hasLease: true, hasMortgage: true, hasLoan: true }).map(s => s.type)
    expect(wizard).toEqual(everything)
  })

  it('gives every slot a reason to show while it is empty', () => {
    for (const s of checklistSlots('wizard')) {
      expect(s.hint.trim().length, `${s.type} has no hint`).toBeGreaterThan(0)
      expect(s.label.trim().length, `${s.type} has no label`).toBeGreaterThan(0)
    }
  })
})
