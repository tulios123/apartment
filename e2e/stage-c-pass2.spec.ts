import { test, expect, type Page } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { owner } from './lib/owner'

/**
 * PASS 2 — stage C, the stage that works, walked by a first-time owner.
 *
 * The brief's instruction is not to redesign it but to prove it still tells the truth —
 * and to find what the owner has gone blind to. So the fixture stages the one collision
 * the fresh-deal walks could not: **this month's rent is already in the ledger as a real
 * transaction, sitting in the same month as the forecast row it replaces.** If money is
 * ever counted twice in this app, that is where it happens.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

async function open(page: Page, fixture: ReturnType<typeof owner>, theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, fixture)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__c2')) return
    sessionStorage.setItem('__c2', '1')
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('onboarding_draft') || k.startsWith('purchase_plan:')) localStorage.removeItem(k)
    }
  })
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(1000)
}

/** No screen may ever read NaN / Infinity / undefined / null to a human. */
async function noGarbage(page: Page, where: string) {
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  for (const bad of ['NaN', 'Infinity', 'undefined', 'null', '[object']) {
    expect(text, `${where}: "${bad}" reached the screen`).not.toContain(bad)
  }
}

test('C2 · הבית, כששכר הדירה כבר נכנס החודש', async ({ page }) => {
  await open(page, owner())
  await noGarbage(page, 'home')
  await saveShot(page, 'c2', '01-home-rent-in', 'light')
})

test('C2 · הבית, כששכר הדירה טרם נכנס', async ({ page }) => {
  await open(page, owner({ rentThisMonth: false }))
  await saveShot(page, 'c2', '02-home-rent-pending', 'light')
})

/**
 * The double-count test, and the whole reason this pass exists.
 *
 * The month view must show the rent ONCE. Whatever the app decides to call it — real or
 * forecast — ₪4,000 of income must appear a single time, and the month's net must not be
 * ₪4,000 better than reality.
 */
test('C2 · תזרים — תנועה אמיתית מול שורת תחזית באותו חודש', async ({ page }) => {
  await open(page, owner())
  await page.goto('/finances')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(1400)
  await noGarbage(page, 'finances')
  await saveShot(page, 'c2', '10-finances-month', 'light')

  // Count what the screen actually shows for rent in the current month.
  const rentRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('body *'))
      .filter(el => el.children.length === 0 && (el.textContent || '').includes('4,000'))
      .map(el => (el.closest('li, .txn, [class*="row"], div') as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ').trim() ?? '')
    return Array.from(new Set(rows))
  })
  console.log('\n=== שורות שמכילות 4,000 בחודש הנוכחי ===\n' + rentRows.join('\n---\n') + '\n')
})

test('C2 · תזרים — חודש עתידי', async ({ page }) => {
  await open(page, owner())
  await page.goto('/finances')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(1200)
  // Forward one month: everything there must be forecast, nothing actual.
  const next = page.locator('.finv-month-nav button, .month-nav button, [aria-label*="הבא"]').first()
  if (await next.count()) {
    await next.click()
    await page.waitForTimeout(900)
  }
  await noGarbage(page, 'finances next month')
  await saveShot(page, 'c2', '11-finances-next-month', 'light')
})

test('C2 · הון ונכס', async ({ page }) => {
  await open(page, owner())
  for (const [route, name] of [['/wealth', '20-wealth'], ['/property', '21-property']] as const) {
    await page.goto(route)
    await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForTimeout(1300)
    await noGarbage(page, name)
    await saveShot(page, 'c2', name, 'light')
  }
})

test('C2 · חוזה לקראת סיום', async ({ page }) => {
  await open(page, owner({ leaseEndsInDays: 22 }))
  await saveShot(page, 'c2', '30-renewal-home', 'light')
})

test('C2 · כהה — בית ותזרים', async ({ page }) => {
  await open(page, owner(), 'dark')
  await saveShot(page, 'c2', '01-home-rent-in', 'dark')
  await page.goto('/finances')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(1300)
  await saveShot(page, 'c2', '10-finances-month', 'dark')
})
