import { test, type Page } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { account } from './lib/personas'
import { leased, task, d } from './lib/fixtures'

/**
 * PASS 2 — stage C, the stage that works, walked by someone who is not the owner.
 *
 * This is a safety net, so it is deliberately unkind in one specific way: it walks the
 * moment nobody photographs, the week AFTER the key and BEFORE a tenant. The owner has
 * never been in that state — he bought a flat that came with a tenant — so every screen
 * there has been reasoned about and none of it has been looked at.
 *
 * Two accounts:
 *   just-in-hand — keys a week old, no lease, no transactions. Income is genuinely zero.
 *   running      — the ordinary account the owner actually has.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

async function clearOnce(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__walk_cleared')) return
    sessionStorage.setItem('__walk_cleared', '1')
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('onboarding_draft') || k.startsWith('purchase_plan:')) localStorage.removeItem(k)
    }
  })
}

async function open(page: Page, fixture: Parameters<typeof stubSupabase>[1], theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, fixture)
  await clearOnce(page)
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
}

async function sweep(page: Page, tag: string) {
  await saveShot(page, 'c', `${tag}-home`, 'light')
  for (const [route, name] of [['/finances', 'finances'], ['/wealth', 'wealth'], ['/property', 'property']] as const) {
    await page.goto(route)
    await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForTimeout(1100)
    await saveShot(page, 'c', `${tag}-${name}`, 'light')
  }
}

/** The week after the key, with nobody in the flat yet. Nobody has ever looked at this. */
test('ג · המפתח ביד, אין עדיין שוכר', async ({ page }) => {
  await open(page, account(-7))
  await sweep(page, '40-just-in-hand')
})

/** The ordinary running account — the regression net. */
test('ג · דירה מושכרת, שכר הדירה טרם אושר', async ({ page }) => {
  await open(page, leased({ tasks: [task('t1', 'לתאם בדיקת דוד שמש', d(4))] }))
  await sweep(page, '41-running')
})

/** Renewal pressure — the state the owner built the alerts for. */
test('ג · חוזה לקראת חידוש', async ({ page }) => {
  await open(page, leased({ rentPaid: true, renewalSoon: true }))
  await saveShot(page, 'c', '42-renewal-home', 'light')
})

test('ג · כהה', async ({ page }) => {
  await open(page, leased({ rentPaid: true }), 'dark')
  await saveShot(page, 'c', '41-running-home', 'dark')
})
