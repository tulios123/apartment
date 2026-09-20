import { test, expect, type Page } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { owner } from './lib/owner'

/**
 * The surfaces no walk has ever opened.
 *
 * Eleven passes in, the app's pillars have been read, its two daily gestures performed, and
 * its wizard walked step by step. What remains unopened is everything a family member hits
 * in their SECOND week: the document store they upload a lease into, the settings they go
 * to when a notification annoys them, the drawer they tap when they typed an amount wrong,
 * the year view they open the first time they wonder how the flat did.
 *
 * Every screen here gets the same two questions: does it say anything untrue, and would
 * someone who did not build it know what to do on it.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

async function open(page: Page, route = '/', theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, owner())
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__uw')) return
    sessionStorage.setItem('__uw', '1')
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('onboarding_draft') || k.startsWith('purchase_plan:')) localStorage.removeItem(k)
    }
  })
  await page.goto(route)
  await page.locator('.bottom-nav, .page-header, .settings-page').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(1200)
}

/** Nothing a human reads may be NaN / Infinity / undefined / null. */
async function clean(page: Page, where: string) {
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  for (const bad of ['NaN', 'Infinity', 'undefined', 'null', '[object']) {
    expect(text, `${where}: "${bad}" reached the screen`).not.toContain(bad)
  }
}

test('לא-נבדק · מסמכים', async ({ page }) => {
  await open(page, '/property/documents')
  await clean(page, 'documents')
  await saveShot(page, 'uw', '01-documents', 'light')
})

test('לא-נבדק · ביטוח', async ({ page }) => {
  await open(page, '/property/insurance')
  await clean(page, 'insurance')
  await saveShot(page, 'uw', '02-insurance', 'light')
})

test('לא-נבדק · הגדרות', async ({ page }) => {
  await open(page, '/settings')
  await clean(page, 'settings')
  await saveShot(page, 'uw', '03-settings', 'light')
})

test('לא-נבדק · עריכת תנועה', async ({ page }) => {
  await open(page, '/finances')
  // The REAL rent receipt, not the forecast row above it — a virtual entry has nothing to
  // edit, and targeting `.first()` silently clicked it and opened nothing while the test
  // still passed. Assert the drawer, not the tap.
  const row = page.locator('[class*="finv-tx"]').filter({ hasText: 'יובל אברהם' }).first()
  await expect(row, 'the real rent transaction should be on screen').toBeVisible()
  // The ROW is inert — editing lives on its own pencil. Worth knowing: the first version of
  // this walk tapped the row, opened nothing, and passed anyway.
  await row.getByRole('button', { name: 'עריכה' }).click()
  await page.waitForTimeout(1000)
  await expect(page.getByText('עריכת תנועה'), 'the pencil must open the editor').toBeVisible()
  await clean(page, 'transaction drawer')
  await saveShot(page, 'uw', '10-tx-drawer', 'light')
})

test('לא-נבדק · תזרים שנתי ופילוח קטגוריות', async ({ page }) => {
  await open(page, '/finances')
  await page.getByRole('button', { name: 'שנה' }).click()
  await page.waitForTimeout(1200)
  await clean(page, 'year view')
  await saveShot(page, 'uw', '20-year', 'light')

  // The category breakdown is a headline feature; with only three expense categories in
  // the app, this is where that shows.
  const breakdown = page.getByRole('button', { name: /פילוח הוצאות/ })
  if (await breakdown.count()) {
    await breakdown.click()
    await page.waitForTimeout(900)
    await saveShot(page, 'uw', '21-categories', 'light')
  }
})

test('לא-נבדק · כהה — מסמכים והגדרות', async ({ page }) => {
  await open(page, '/property/documents', 'dark')
  await saveShot(page, 'uw', '01-documents', 'dark')
  await page.goto('/settings')
  await page.waitForTimeout(1200)
  await saveShot(page, 'uw', '03-settings', 'dark')
})
