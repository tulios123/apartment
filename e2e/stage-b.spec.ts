import { test, expect, type Page } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { B, account } from './lib/personas'

/**
 * Stage B — signed, waiting for the key. Walked as אורי, not as the owner.
 *
 * He signed two months ago and is installing today, which is the ordinary case and the
 * hostile one: most of his dates are already behind him. He bought an INVESTMENT flat,
 * so purchase tax is 8% — ₪148,000 that has to appear, correctly, everywhere money is
 * totalled. (A single apartment at this price pays zero; that path is the edge case.)
 *
 * This spec photographs every pillar in the stage. It is not an assertion suite — the
 * assertions here only guard the arithmetic. The findings come from opening the PNGs.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

/** Both keys, every time. A leftover draft or plan hydrates the screen mid-way and the
 *  run photographs something that no real person would ever see. */
async function fresh(page: Page, theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, account(B.keyInDays, B.signedDaysAgo))
  // ONCE, not on every navigation. addInitScript re-runs on each page load, so the first
  // version of this wiped the plan the moment the walk moved to another pillar — and the
  // whole pillar sweep was photographed with no plan at all, silently. The sentinel makes
  // it a genuine "start clean", which is what it was always meant to be.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__walk_cleared')) return
    sessionStorage.setItem('__walk_cleared', '1')
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('onboarding_draft') || k.startsWith('purchase_plan:')) localStorage.removeItem(k)
    }
  })
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
}

/** Build אורי's plan the way he would: his split, and "דירה נוספת" — the ₪148,000 toggle. */
async function buildPlan(page: Page) {
  await page.getByRole('button', { name: 'לבנות את הלוח' }).click()
  await page.locator('.pln-setup').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '10% ואז 15%' }).click()
  await page.getByRole('button', { name: 'דירה נוספת' }).click()
  await page.waitForTimeout(300)
  await saveShot(page, 'b', '01-setup-investment', 'light')
  await page.getByRole('button', { name: 'בניית הלוח' }).click()
  await page.locator('.pmap').waitFor({ state: 'visible' })
  await page.waitForTimeout(700)
}

test('ב · הבית, והלוח שנבנה', async ({ page }) => {
  await fresh(page)
  await saveShot(page, 'b', '00-home-no-plan', 'light')
  await buildPlan(page)
  await saveShot(page, 'b', '02-home-map', 'light')

  // The arithmetic, guarded. ₪148,000 of purchase tax is the single largest thing the app
  // computes on its own here; if it is wrong or absent, every total downstream is a lie.
  const plan = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('purchase_plan:'))
    return k ? JSON.parse(localStorage.getItem(k)!) : null
  })
  expect(plan, 'a plan should exist after setup').not.toBeNull()
  const amount = (id: string) => plan.items.find((i: { id: string }) => i.id === id)?.amount
  expect(amount('pay1'), 'first payment = 10% of the price').toBe(B.expect.pay1)
  expect(amount('pay2'), 'second payment = 15% of the price').toBe(B.expect.pay2)
  expect(amount('tax-pay'), 'purchase tax on an ADDITIONAL apartment = 8%').toBe(B.expect.tax)

  // Every stage opened, so the fold is not hiding a broken row from the eye.
  for (const [i, name] of ['המשכנתא והמסירה', 'הסגירה'].entries()) {
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await page.waitForTimeout(400)
    await saveShot(page, 'b', `03-stage-${i + 2}-open`, 'light')
  }
})

test('ב · ארבעת העמודים', async ({ page }) => {
  await fresh(page)
  await buildPlan(page)

  for (const [route, name] of [['/finances', '10-finances'], ['/wealth', '11-wealth'], ['/property', '12-property']] as const) {
    await page.goto(route)
    await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForTimeout(1100)
    await saveShot(page, 'b', name, 'light')
  }
})

test('ב · כהה', async ({ page }) => {
  await fresh(page, 'dark')
  await buildPlan(page)
  await saveShot(page, 'b', '02-home-map', 'dark')
  await page.goto('/wealth')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(1100)
  await saveShot(page, 'b', '11-wealth', 'dark')
})
