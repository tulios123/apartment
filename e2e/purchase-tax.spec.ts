import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'
import { purchaseTax } from '../src/lib/purchaseTax'

/**
 * Omer's note 5 — the costs step asked about the lawyer, the agent, the appraiser and the
 * mortgage advisor, and never once mentioned purchase tax: the one cost fixed by law, the
 * one the app can compute exactly, and usually the largest of them all. A costs step that
 * omits it does not merely leave a field blank; it produces a "סה״כ הושקע" that is short
 * by tens of thousands, and every screen downstream inherits that.
 *
 * The rule the owner set on 21.09 is the lawyer fee's rule: forecast the amount, show the
 * working, let him change it. So this spec checks all three.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const empty: Fixture = {
  owners: [{ id: OWNER, name: 'עומר' }],
  properties: [], mortgages: [], mortgage_tracks: [], investment_costs: [],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}

const PRICE = 2_180_000

/** welcome → documents → purchase (price) → mortgage → loans → investment. */
async function costsStep(page: Page) {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('onboarding_draft') || k.startsWith('purchase_plan')) localStorage.removeItem(k)
    }
  })
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)

  const cont = async () => { await page.locator('.btn-onboard-primary').last().click(); await page.waitForTimeout(650) }
  await cont()                                        // welcome → documents
  await cont()                                        // documents → purchase
  await page.getByLabel('מחיר רכישה (₪)').fill(String(PRICE))
  await page.waitForTimeout(250)
  await cont()                                        // purchase → mortgage
  await cont()                                        // mortgage → loans
  await cont()                                        // loans → investment
  await page.locator('.onboarding-tax').waitFor({ state: 'visible', timeout: 10_000 })
}

test('מס רכישה מחושב, מוסבר וניתן לשינוי', async ({ page }) => {
  await costsStep(page)
  const field = page.locator('.onboarding-tax input')

  // 1 — computed. Single apartment is the default, so it is the single-home ladder.
  const expected = purchaseTax(PRICE, true).toLocaleString('en-US')
  await expect(field, 'the tax must arrive already calculated, like the lawyer fee').toHaveValue(expected)
  await saveShot(page, 'tax', '01-computed', 'light')

  // 2 — explained. The brackets are the answer to "why that number".
  await page.getByRole('button', { name: 'איך חושב?' }).click()
  await page.waitForTimeout(250)
  const brackets = page.locator('.onboarding-tax-bracket')
  expect(await brackets.count(), 'the ladder plus its sum row').toBeGreaterThan(1)
  await saveShot(page, 'tax', '02-brackets', 'light')

  // 3 — and the toggle is not decoration: an additional apartment pays 8% from the first
  // shekel, which on this price is an order of magnitude more.
  await page.getByRole('button', { name: 'דירה נוספת' }).click()
  await page.waitForTimeout(250)
  await expect(field).toHaveValue(purchaseTax(PRICE, false).toLocaleString('en-US'))
  await saveShot(page, 'tax', '03-additional', 'light')

  // 4 — editable, and his number wins.
  await page.getByRole('button', { name: 'דירה יחידה' }).click()
  await field.fill('12345')
  await page.waitForTimeout(250)
  await expect(field).toHaveValue('12,345')
})

test('בלי מחיר — לא ממציא מספר', async ({ page }) => {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)

  /**
   * Since 21.09 the purchase price is required, so the costs step cannot be REACHED
   * without one by walking forward — which is the point of that gate. A draft can still
   * arrive here with the field empty (saved before the gate existed, or saved after the
   * user went back and cleared it), and that is exactly the state worth pinning: the tax
   * field must stay blank rather than compute something from a price of zero.
   */
  await page.addInitScript((owner) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('onboarding_draft')) localStorage.removeItem(k)
    localStorage.setItem(`onboarding_draft:${owner}`, JSON.stringify({
      v: 1,
      step: 'investment',
      docRefs: { purchase: [], tabu: [], mortgage: [], loan: [], rental: [], insurance: [] },
      buyerName: '', street: '', city: '', rooms: '',
      purchasePrice: '', signingDate: '', keyDeliveryDate: '',
      propertySizeSqm: '', floorNumber: '',
      tracks: [], trackForm: null, graceOn: false, showTrackForm: false, editingIdx: null,
      equityMode: 'amount', equityValue: '',
      costs: { lawyer: '', brokerage: '', mortgage_advisor: '', investment_company: '', appraiser: '', purchase_tax: '' },
      extraCosts: [], singleApartment: true,
      companyName: '', startDate: '', endDate: '', monthlyRent: '',
      rentPaymentMethod: 'check', rentPaymentDay: '', addRentReminder: false,
      policies: [], policyForm: null, showPolicyForm: false, editingPolicyIdx: null,
      loans: [], balloonLoans: [], loanForm: null, loanGraceOn: false,
      showLoanForm: false, editingLoanIdx: null,
    }))
  }, OWNER)

  await page.goto('/')
  await page.locator('.onboarding-tax').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(500)

  await expect(page.locator('.onboarding-tax input')).toHaveValue('')
  await expect(page.getByText('יחושב אוטומטית ברגע שיוזן מחיר רכישה')).toBeVisible()
  // …and no bracket ladder to open, because there is nothing to explain.
  await expect(page.getByRole('button', { name: 'איך חושב?' })).toHaveCount(0)
})
