import { test, expect } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * Omer's note 19 — the accelerator during grace.
 *
 * "מאיץ ההון" answers one question: how much of this month's payment becomes yours. In a
 * grace period the answer is none of it, and the card said so with a full-width interest
 * bar and "בונה הון ₪0 (0%)" — which reads as a verdict on how badly the owner is doing,
 * in a window where the choice does not exist yet.
 *
 * The owner's call (21.09): hide it during grace, behind a line that can be opened. The
 * test worth having is not that it is hidden — it is that the card is still THERE (a card
 * that silently vanishes raises a worse question than the sentence that explains it), that
 * it names when the accelerator starts, and that outside grace nothing changed.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

/** Today is 21.09.2026. A track drawn 1.8.2026 with 12 months' grace is interest-only now. */
function fixture(graceMonths: number): Fixture {
  return {
    owners: [{ id: OWNER, name: 'עומר' }],
    properties: [{ id: 'p1', owner_id: OWNER, address: 'פסח חברוני 122, ירושלים', street: 'פסח חברוני 122', city: 'ירושלים', purchase_price: 2180000, purchase_date: '2026-08-01', key_delivery_date: '2026-08-01', rooms: 4 }],
    mortgages: [{ id: 'm1', owner_id: OWNER, payment_day: 10 }],
    mortgage_tracks: [{ id: 't1', owner_id: OWNER, mortgage_id: 'm1', track_type: 'prime', principal: 1200000, annual_rate: 5.5, term_months: 300, start_date: '2026-08-01', grace_months: graceMonths }],
    investment_costs: [], contracts: [], loans: [], insurance_policies: [], transactions: [],
    recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
  }
}

test('בגרייס — המאיץ מתקפל ואומר ממתי', async ({ page }) => {
  await setTheme(page, 'light')
  await stubSupabase(page, fixture(12))
  await page.goto('/wealth')
  await page.locator('.wlth-accel').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)

  const card = page.locator('.wlth-accel.is-grace')
  await expect(card, 'the card stays — only its contents fold').toBeVisible()
  await expect(page.locator('.wlth-split-bar'), 'no 0%/100% verdict bar during grace').toHaveCount(0)
  // Grace runs 12 months from 1.8.2026, so principal first appears in August 2027.
  await expect(card).toContainText('אוגוסט 2027')
  await saveShot(page, 'grace', '01-collapsed', 'light')

  await page.locator('.wlth-accel-grace-head').click()
  await page.waitForTimeout(300)
  await expect(page.locator('.wlth-accel-grace-body')).toContainText('ריבית בלבד')
  await saveShot(page, 'grace', '02-open', 'light')
})

test('בלי גרייס — הכרטיס כרגיל', async ({ page }) => {
  await setTheme(page, 'light')
  await stubSupabase(page, fixture(0))
  await page.goto('/wealth')
  await page.locator('.wlth-accel').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)

  await expect(page.locator('.wlth-accel.is-grace')).toHaveCount(0)
  await expect(page.locator('.wlth-split-bar'), 'outside grace the split is the whole point').toBeVisible()
  await expect(page.getByText('בונה הון')).toBeVisible()
})
