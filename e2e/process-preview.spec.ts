import { test } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { base } from './lib/fixtures'

// The staging-only drawing of the purchase process (src/pages/preview/ProcessPreview.tsx).
// Rendered here for the same reason as everything else this week: a screen nobody has
// looked at is a screen nobody can judge.
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

async function shoot(page: import('@playwright/test').Page, theme: 'light' | 'dark', state: string) {
  await setTheme(page, theme)
  await stubSupabase(page, base(213))
  await page.goto('/preview/process')
  await page.locator('.pv-summary').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(600)
  await saveShot(page, 'process-preview', state, theme)
}

test('תהליך הרכישה · מקבלן', async ({ page }) => {
  await shoot(page, 'light', 'developer')
})

test('תהליך הרכישה · יד שנייה', async ({ page }) => {
  await setTheme(page, 'light')
  await stubSupabase(page, base(213))
  await page.goto('/preview/process')
  await page.locator('.pv-summary').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByRole('button', { name: 'יד שנייה' }).click()
  await page.waitForTimeout(400)
  await saveShot(page, 'process-preview', 'second-hand', 'light')
})

test('תהליך הרכישה · כהה', async ({ page }) => {
  await shoot(page, 'dark', 'developer')
})
