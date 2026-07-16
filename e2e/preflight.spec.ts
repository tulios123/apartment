import { test, expect } from '@playwright/test'
import { gotoAuthed, saveShot, setTheme } from './lib/helpers'
import { attachConsoleMonitor } from './lib/monitors'

// Pre-flight gate (NIGHT_RUN Stage 0.4): the dev-bypass login must actually land
// on the authenticated shell. If this fails, the run degrades to code-only audit.
test('pre-flight: bypass login reaches authenticated Home', async ({ page }) => {
  const consoleHits = attachConsoleMonitor(page)
  await gotoAuthed(page, '/', { theme: 'light' })

  await expect(page.locator('.bottom-nav')).toBeVisible()
  await expect(page.locator('.bottom-nav-link')).toHaveCount(4)
  await saveShot(page, 'home', 'preflight', 'light')

  // dark theme boots correctly too
  const dark = await page.context().newPage()
  await setTheme(dark, 'dark')
  await dark.goto('/')
  await dark.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
  await expect(dark.locator('html')).toHaveAttribute('data-theme', 'dark')
  await saveShot(dark, 'home', 'preflight', 'dark')
  await dark.close()

  console.log('console hits during preflight:', JSON.stringify(consoleHits, null, 2))
})
