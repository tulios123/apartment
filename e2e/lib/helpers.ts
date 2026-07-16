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
