import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export type Theme = 'light' | 'dark'

const EVIDENCE_DIR = path.resolve('docs/audit/evidence')

// Force a theme deterministically: the app reads localStorage 'theme' at boot
// (src/lib/theme.ts) and keys tokens on :root[data-theme].
export async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
}

// Navigate and wait until the authenticated shell is interactive (splash gone,
// bottom nav mounted). The dev bypass signs in automatically.
export async function gotoAuthed(page: Page, route = '/', opts: { theme?: Theme } = {}) {
  if (opts.theme) await setTheme(page, opts.theme)
  await page.goto(route)
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
  // Home holds a splash overlay until first data lands (or the 5s ceiling).
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {})
}

// Archive a screenshot as evidence: docs/audit/evidence/<screen>--<state>--<theme>--w<width>.png
export async function saveShot(page: Page, screen: string, state: string, theme: Theme) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  const width = page.viewportSize()?.width ?? 0
  const file = path.join(EVIDENCE_DIR, `${screen}--${state}--${theme}--w${width}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

// Tag helpers for rows this run creates (cleanup targets these).
export const E2E_TAG = '[E2E]'
export const STRESS_TAG = '[STRESS]'

// The onboarding wizard backs its state up to localStorage (key onboarding_draft:<uid>)
// and only clears it on a fully successful finish. Across test runs a leftover draft
// re-hydrates stale tracks/loans — so clear it (on every navigation) before any
// onboarding test. In-session (SPA) state is React memory, unaffected by this.
export async function clearOnboardingDraft(page: Page) {
  await page.addInitScript(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('onboarding_draft'))
        .forEach((k) => localStorage.removeItem(k))
    } catch { /* storage unavailable */ }
  })
}

// Wipe the test account via the protected Settings reset and land back on Onboarding.
/**
 * May this run wipe the live test account?
 *
 * `resetAccount` clicks "מחק הכול" against the HOSTED Supabase — staging and production
 * share one project, so it is real data being deleted, not a fixture. Until now that was
 * held back by an accident: the specs that call it could not launch a browser in the cloud
 * container at all, so `npx playwright test` there quietly skipped past them. Fixing the
 * launch path (playwright.config) removes that accident, and an accident is not a safety
 * measure — so the interlock is explicit instead.
 *
 * Opt in with E2E_ALLOW_DESTRUCTIVE=1 when you actually mean to reset the test account.
 */
export function destructiveAllowed(): boolean {
  return process.env.E2E_ALLOW_DESTRUCTIVE === '1'
}

export async function resetAccount(page: Page) {
  // Backstop: a spec that forgets the skip must still not delete anybody's data.
  if (!destructiveAllowed()) {
    throw new Error('resetAccount wipes the live test account — set E2E_ALLOW_DESTRUCTIVE=1 to allow it')
  }
  await gotoAuthed(page, '/settings')
  const resetBtn = page.getByRole('button', { name: 'איפוס כל הנתונים' })
  await resetBtn.scrollIntoViewIfNeeded()
  await resetBtn.click()
  await page.getByRole('button', { name: 'מחק הכול' }).click()
  await page.waitForLoadState('load')
  await page.locator('.onboarding-wrap').waitFor({ state: 'visible', timeout: 30_000 })
}
