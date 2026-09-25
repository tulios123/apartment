import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * Omer's note 4 and the owner's answer on 21.09: mark what is required, refuse to continue
 * without it, keep the list to the critical few — and fold away what can be folded.
 *
 * The critical list is one field long. That is the interesting part and the part worth
 * pinning down: the purchase price is the only value the rest of the app cannot work
 * around, and everything else on the step degrades honestly without it. A test that
 * asserts "the wizard blocks" is worth little; this one also asserts what it does NOT
 * block on, so the list cannot quietly grow into a wall of red stars.
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

async function purchaseStep(page: Page) {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('onboarding_draft')) localStorage.removeItem(k)
  })
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
  await cont(page)   // welcome → documents
  await cont(page)   // documents → purchase
  await page.getByLabel(/מחיר רכישה/).waitFor({ state: 'visible' })
}
const cont = async (page: Page) => { await page.locator('.btn-onboard-primary').last().click(); await page.waitForTimeout(650) }

test('בלי מחיר רכישה — האשף לא ממשיך', async ({ page }) => {
  await purchaseStep(page)
  await cont(page)
  await page.waitForTimeout(350)

  // Still on the purchase step, and told why.
  await expect(page.getByLabel(/מחיר רכישה/)).toBeVisible()
  await expect(page.locator('.onboarding-field-error')).toBeVisible()
  await expect(page.locator('.onboarding-required').first(), 'the field is marked before you hit the wall').toBeVisible()
  await saveShot(page, 'required', 'blocked', 'light')

  // Typing the price clears the block immediately — no second failed attempt needed.
  await page.getByLabel(/מחיר רכישה/).fill('2180000')
  await page.waitForTimeout(250)
  await expect(page.locator('.onboarding-field-error')).toHaveCount(0)
  await cont(page)
  await expect(page.getByText('משכנתא').first(), 'and now it moves on').toBeVisible()
})

test('כל השאר לא חוסם — גם בלי כתובת ובלי תאריכים', async ({ page }) => {
  await purchaseStep(page)
  // Only the price. No name, no street, no city, no dates, no documents.
  await page.getByLabel(/מחיר רכישה/).fill('2180000')
  await cont(page)
  await page.waitForTimeout(350)
  await expect(
    page.locator('.onboarding-field-error'),
    'nothing but the price may block — the rest of the step degrades honestly',
  ).toHaveCount(0)
  await expect(page.getByText('משכנתא').first()).toBeVisible()
})

test('העלויות הנדירות מקופלות — ונפתחות בלחיצה', async ({ page }) => {
  await purchaseStep(page)
  await page.getByLabel(/מחיר רכישה/).fill('2180000')
  await cont(page); await cont(page); await cont(page)   // mortgage → loans → investment
  await page.locator('.onboarding-tax').waitFor({ state: 'visible', timeout: 10_000 })

  await expect(page.getByLabel('יועץ משכנתאות (₪)')).toHaveCount(0)
  await saveShot(page, 'required', 'costs-folded', 'light')
  await page.getByRole('button', { name: /עלויות נוספות/ }).click()
  await page.waitForTimeout(250)
  await expect(page.getByLabel('יועץ משכנתאות (₪)')).toBeVisible()
  await expect(page.getByLabel('שמאי (₪)')).toBeVisible()
})
