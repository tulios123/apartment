import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * Omer's note 7 — "let me proofread before it is saved".
 *
 * The wizard used to end on a congratulations screen with four numbers, AFTER the write.
 * There was nothing to read back and nothing to fix: the save path guards each section
 * against a repeat write, so a correction made afterwards would have been silently dropped.
 * The review screen is therefore placed BEFORE the save, and the test that matters is not
 * "the screen exists" — it is that a value corrected from the review screen is the value
 * that survives to the summary.
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

const cont = async (page: Page) => { await page.locator('.btn-onboard-primary').last().click(); await page.waitForTimeout(650) }

/** Fill the purchase step, then walk to the end and ask to finish. */
async function toReview(page: Page) {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('onboarding_draft')) localStorage.removeItem(k)
  })
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
  await cont(page); await cont(page)                       // → documents → purchase
  await page.getByLabel(/מחיר רכישה/).fill('2180000')
  await page.getByLabel('עיר').fill('ירושלים')
  await cont(page)                                          // → mortgage
  await cont(page); await cont(page); await cont(page)      // → loans → investment → rental
  await cont(page)                                          // → insurance
  await cont(page)                                          // סיום → review
  await page.locator('.onboarding-review').waitFor({ state: 'visible', timeout: 15_000 })
}

test('הסיכום מראה מה עומד להישמר — לפני שנשמר', async ({ page }) => {
  await toReview(page)
  await saveShot(page, 'review', '01-summary', 'light')

  await expect(page.getByRole('heading', { name: 'רגע לפני שמירה' })).toBeVisible()
  await expect(page.getByText('₪2,180,000').first()).toBeVisible()
  await expect(page.getByText('ירושלים').first()).toBeVisible()
  // Empty sections state the absence rather than vanishing — a lease that quietly
  // disappeared from the summary is exactly how a lost lease goes unnoticed.
  await expect(page.getByText('לא הוזן חוזה שכירות')).toBeVisible()
  await expect(page.getByText('לא הוזנה משכנתא')).toBeVisible()
  // Nothing has been written yet.
  await expect(page.getByRole('heading', { name: 'הכול מוכן!' })).toHaveCount(0)

  // The rows under "סך העלויות" must add up to it. This is the fault that produced the
  // night run's B-1 on מבנה העסקה — a total arriving from somewhere the rows did not —
  // and it is least acceptable on the screen whose entire job is letting you check.
  const sum = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.onboarding-review-card'))
    const card = cards.find(c => c.querySelector('h3')?.textContent === 'הון ועלויות')
    if (!card) return null
    const num = (s: string) => Number(s.replace(/[^0-9.-]/g, '')) || 0
    let rows = 0, total = 0, equity = 0
    for (const r of Array.from(card.querySelectorAll('.onboarding-review-row'))) {
      const label = r.querySelector('span')?.textContent ?? ''
      const value = num(r.querySelector('b')?.textContent ?? '')
      if (label === 'סך העלויות') total = value
      else if (label === 'הון עצמי') equity = value
      else rows += value
    }
    return { rows, total, equity }
  })
  expect(sum, 'the costs card must exist').not.toBeNull()
  expect(sum!.rows, 'every shekel in the total has a row above it').toBe(sum!.total)
})

test('תיקון מהסיכום הוא התיקון שנשמר', async ({ page }) => {
  await toReview(page)
  await page.getByRole('button', { name: 'עריכת פרטי הרכישה' }).click()
  await page.waitForTimeout(500)

  // Back on the purchase step, with what was entered still there.
  const price = page.getByLabel(/מחיר רכישה/)
  await expect(price).toHaveValue('2,180,000')
  await price.fill('2250000')
  await page.waitForTimeout(250)

  // Forward again to the review screen and check the corrected figure is what it shows.
  await cont(page); await cont(page); await cont(page); await cont(page); await cont(page); await cont(page)
  await page.locator('.onboarding-review').waitFor({ state: 'visible', timeout: 15_000 })
  await saveShot(page, 'review', '02-corrected', 'light')
  await expect(page.getByText('₪2,250,000').first()).toBeVisible()
  await expect(page.getByText('₪2,180,000')).toHaveCount(0)
})
