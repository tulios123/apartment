import { test } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { base, leased, task, d } from './lib/fixtures'

// Every state the home can be in, rendered offline. Built for the brains-tour (08.09):
// judging a screen's hierarchy from source is guesswork, and the leased state — the one
// the owner and his family look at daily — had never been rendered here at all.
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

async function shoot(page: import('@playwright/test').Page, fixture: Fixture, state: string, theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, fixture)
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
  await saveShot(page, 'home', state, theme)
}

test('leased — rent still pending, nothing else', async ({ page }) => {
  await shoot(page, leased(), 'leased-rent-pending')
})

test('leased — rent in, all clear', async ({ page }) => {
  await shoot(page, leased({ rentPaid: true }), 'leased-all-clear')
})

test('leased — a busy day: rent, two tasks, a renewal', async ({ page }) => {
  await shoot(page, leased({
    renewalSoon: true,
    tasks: [
      task('k1', 'לתאם בדיקת דוד שמש', d(0), 'תיקונים ותחזוקה'),
      task('k2', 'לשלם ארנונה', d(-2)),
      task('k3', 'לחדש ביטוח מבנה', d(40)),
    ],
  }), 'leased-busy')
})

test('leased — dark', async ({ page }) => {
  await shoot(page, leased({ rentPaid: true }), 'leased-all-clear', 'dark')
})

test('keys held, no tenant yet', async ({ page }) => {
  await shoot(page, base(-60), 'vacant')
})
