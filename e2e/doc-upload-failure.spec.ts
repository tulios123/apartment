import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * "העלה מסמך, והמסמך נעלם" (the owner, 24.09, relaying Omer — and explicitly NOT about
 * extraction: he already knows insurance is not read).
 *
 * Three separate silent losses on that path, all now closed:
 *  1. a file over the 15MB ceiling throws at pick time AND again at finish — it can never
 *     succeed — and both throws were caught and discarded;
 *  2. any storage or RLS error did the same;
 *  3. the finish uploaded documents fire-and-forget and deleted the draft on the very next
 *     line, so a phone suspending the page mid-flight orphaned the blob with nothing left
 *     pointing at it.
 * Through all three the card kept saying "1 קובץ נשמר", because that count comes from the
 * in-memory file list and not from anything that reached the server.
 *
 * The harness routes only /auth and /rest, so storage uploads genuinely fail here — which
 * is precisely the condition under test. The assertion is that the failure is VISIBLE.
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

async function documentsStep(page: Page) {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('onboarding_draft')) localStorage.removeItem(k)
  })
  // The shared stub makes storage succeed; this spec is about what happens when it does
  // not, so it is overridden here. Registered AFTER stubSupabase so it takes precedence.
  await page.route('**/storage/v1/**', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ message: 'storage unavailable' }),
  }))
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
  await page.locator('.btn-onboard-primary').last().click()
  await page.waitForTimeout(900)
  await page.locator('.onboarding-doc-cards').waitFor({ state: 'visible' })
}

/** The insurance card — the one Omer used, and the one with no extraction to hide behind. */
const insuranceCard = (page: Page) =>
  page.locator('.onboarding-doc-card-wrap').filter({ hasText: 'פוליסת ביטוח' })

test('העלאה שנכשלה נאמרת, לא נבלעת', async ({ page }) => {
  await documentsStep(page)
  const card = insuranceCard(page)

  await card.locator('input[type="file"]').setInputFiles({
    name: 'פוליסה.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 stub'),
  })
  await page.waitForTimeout(2500)
  await saveShot(page, 'docfail', 'card-error', 'light')

  const status = (await card.locator('.onboarding-doc-card-status').textContent()) ?? ''
  expect(
    status,
    `the card must not report a save that did not happen — it said: "${status}"`,
  ).not.toMatch(/^\s*\d+ (קובץ נשמר|קבצים נשמרו)/)
  expect(status, 'and it says what went wrong, in its own words').toContain('לא הצלחנו לשמור')
  expect(status, 'naming the file').toContain('פוליסה.pdf')
  await expect(
    card.locator('.onboarding-doc-card.is-error'),
    'the card carries the failed state',
  ).toBeVisible()
})

test('קובץ גדול מדי — נאמר מיד, ובשמו', async ({ page }) => {
  await documentsStep(page)
  const card = insuranceCard(page)

  // Over MAX_UPLOAD_BYTES (15MB). This one can never succeed on a retry either, which is
  // why saying so at pick time is the whole point.
  await card.locator('input[type="file"]').setInputFiles({
    name: 'סריקה גדולה.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(16 * 1024 * 1024, 1),
  })
  await page.waitForTimeout(2500)
  await saveShot(page, 'docfail', 'too-large', 'light')

  const shown = await card.textContent()
  expect(shown, 'the file is named').toContain('סריקה גדולה.pdf')
  expect(shown, 'and the reason is given').toMatch(/גדול מדי|לא הצלחנו לשמור/)
})
