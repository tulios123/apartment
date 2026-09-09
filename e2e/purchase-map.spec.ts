import { test } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { base } from './lib/fixtures'

// The stage between signing and the key, walked the way the owner will walk it: no plan,
// build the plan, then the map. Rendered because a screen nobody has looked at is a screen
// nobody can judge — the rule that came out of 08.09.
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

async function home(page: import('@playwright/test').Page, theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, base(213))
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('purchase_plan:')) localStorage.removeItem(k)
  })
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
}

test('בית · טרם מסירה · אין עדיין לוח', async ({ page }) => {
  await home(page)
  await saveShot(page, 'purchase', 'no-plan', 'light')
})

test('בניית הלוח, ואז המפה', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: 'לבנות את הלוח' }).click()
  await page.locator('.pln-setup').waitFor({ state: 'visible' })
  await page.waitForTimeout(500)
  await saveShot(page, 'purchase', 'setup', 'light')

  await page.getByRole('button', { name: 'בניית הלוח' }).click()
  await page.locator('.pmap').waitFor({ state: 'visible' })
  await page.waitForTimeout(600)
  await saveShot(page, 'purchase', 'map', 'light')

  // Mark the caution registered — the gate that dates the second payment.
  await page.getByRole('button', { name: /לסמן שבוצע: הערת אזהרה/ }).click()
  await page.waitForTimeout(500)
  await saveShot(page, 'purchase', 'map-gate-passed', 'light')
})

test('המפה · כהה', async ({ page }) => {
  await home(page, 'dark')
  await page.getByRole('button', { name: 'לבנות את הלוח' }).click()
  await page.locator('.pln-setup').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'בניית הלוח' }).click()
  await page.locator('.pmap').waitFor({ state: 'visible' })
  await page.waitForTimeout(600)
  await saveShot(page, 'purchase', 'map', 'dark')
})
