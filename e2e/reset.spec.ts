import { test, expect } from '@playwright/test'
import { gotoAuthed, saveShot } from './lib/helpers'

// Stage 0.5 sequencing: exercise the protected admin data-reset on the test account.
// Success = the app lands back on Onboarding (clean account). This is itself a
// feature under audit (manager/dev-only tool, R14 hardening).
test('admin data-reset wipes the test account and routes to onboarding', async ({ page }) => {
  await gotoAuthed(page, '/settings', { theme: 'light' })

  const resetBtn = page.getByRole('button', { name: 'איפוס כל הנתונים' })
  await resetBtn.scrollIntoViewIfNeeded()
  await expect(resetBtn).toBeVisible()
  await resetBtn.click()

  // Confirmation step (danger)
  const confirm = page.getByRole('button', { name: 'מחק הכול' })
  await expect(confirm).toBeVisible()
  await saveShot(page, 'settings', 'reset-confirm', 'light')
  await confirm.click()

  // resetAllData reloads the page on success; a property-less account lands on Onboarding.
  await page.waitForLoadState('load')
  await expect(page.locator('.onboarding-wrap')).toBeVisible({ timeout: 30_000 })
  await saveShot(page, 'onboarding', 'welcome-clean', 'light')
})
