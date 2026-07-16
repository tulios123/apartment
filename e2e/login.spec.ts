import { test, expect } from '@playwright/test'
import { saveShot, setTheme, type Theme } from './lib/helpers'
import { layoutIntegrity } from './lib/layout'
import { attachConsoleMonitor } from './lib/monitors'

// Login screen audit — runs against the bypass-off server (port 5174, started
// separately with VITE_DEV_BYPASS_AUTH=false). Skips cleanly if it's not up.
const BASE = 'http://localhost:5174'

for (const theme of ['light', 'dark'] as Theme[]) {
  test(`login screen renders (${theme})`, async ({ page }) => {
    const hits = attachConsoleMonitor(page)
    await setTheme(page, theme)
    const res = await page.goto(BASE + '/').catch(() => null)
    test.skip(!res, 'bypass-off server not running')

    // Auth entry points visible
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

    const violations = await layoutIntegrity(page)
    await saveShot(page, 'login', 'initial', theme)
    console.log(`login ${theme} layout violations:`, JSON.stringify(violations))
    console.log(`login ${theme} console hits:`, JSON.stringify(hits))

    // Magic-link form: invalid email → specific, non-generic feedback (Lens D25)
    if (theme === 'light') {
      await page.locator('input[type="email"]').fill('not-an-email')
      const submit = page.getByRole('button', { name: /קישור|כניסה|שלח/ })
      if (await submit.count()) {
        await submit.first().click()
        await page.waitForTimeout(1500)
        await saveShot(page, 'login', 'invalid-email', theme)
      }
    }
  })
}
