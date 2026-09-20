import { test } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { leased } from './lib/fixtures'

// The owner's OWN state, on the three pillars that are not the home. Rendered here for the
// first time (09.09): the pre-key work has screenshots of every stage, while the screen the
// family actually opens every day had only ever been photographed on the home tab.
//
// It doubles as the regression guard for tonight's truthfulness fixes — none of them should
// touch a leased account, and a picture is how that gets checked rather than asserted.
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

async function shoot(page: import('@playwright/test').Page, route: string, name: string) {
  await setTheme(page, 'light')
  await stubSupabase(page, leased({ rentPaid: true }))
  await page.goto(route)
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await saveShot(page, name, 'leased', 'light')
}

test('תזרים · מושכרת', async ({ page }) => {
  await shoot(page, '/finances', 'finances')
})

test('הון · מושכרת', async ({ page }) => {
  await shoot(page, '/wealth', 'wealth')
})

test('הנכס · מושכרת', async ({ page }) => {
  await shoot(page, '/property', 'property')
})
