import { test, expect, type Page } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { account, OWNER } from './lib/personas'

/**
 * The edge cases the brief asked for, walked rather than reasoned about.
 *
 * Each one is a state a real person reaches by accident: a corrupted plan after a browser
 * update, a price typed with one zero too many, a handover date entered before the signing
 * date. None of them should be able to make the app assert something absurd — and none of
 * them should be able to make it fall over, because a buyer who sees a blank screen the
 * first time he opens the app does not open it a second time.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const PLAN_KEY = `purchase_plan:${OWNER}`

/** Land on the home with whatever localStorage the case needs, and never crash. */
async function home(page: Page, seed: (k: string) => void, keyInDays = 217) {
  await setTheme(page, 'light')
  await stubSupabase(page, account(keyInDays, 60))
  await page.addInitScript(seed, PLAN_KEY)
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
}

/** Nothing on the page may read NaN, Infinity, undefined or null to a human. */
async function noGarbage(page: Page, where: string) {
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  for (const bad of ['NaN', 'Infinity', 'undefined', 'null', '[object']) {
    expect(text, `${where}: "${bad}" must never reach the screen`).not.toContain(bad)
  }
}

test('קצה · לוח תשלומים פגום ב-localStorage', async ({ page }) => {
  // A half-written value — the shape a quota error or an interrupted write leaves behind.
  await home(page, (k: string) => localStorage.setItem(k, '{"version":1,"items":[{"id":'))
  await noGarbage(page, 'corrupt plan')
  await saveShot(page, 'edge', '80-corrupt-plan', 'light')
  // The invitation should be back — a broken plan must degrade to "no plan", not to a
  // broken screen, and the way back must be offered rather than assumed.
  await expect(page.getByRole('button', { name: 'לבנות את הלוח' })).toBeVisible()
})

test('קצה · לוח עם מבנה תקין וערכים אבסורדיים', async ({ page }) => {
  // Valid JSON, insane numbers: a price with an extra zero and a negative payment.
  await home(page, (k: string) => localStorage.setItem(k, JSON.stringify({
    version: 1, price: 18_500_000_000, signing: '2026-07-12', handover: '2027-04-15',
    firstPct: 10, secondPct: 15, singleApartment: false,
    items: [
      { id: 'pay1', kind: 'payment', stage: 1, label: 'תשלום ראשון', amount: -5000, dep: 'date', due: '2026-07-12', done: false, certain: true },
      { id: 'pay2', kind: 'payment', stage: 1, label: 'תשלום שני', amount: 1e21, dep: 'date', due: null, done: false, certain: true },
    ],
  })))
  await noGarbage(page, 'absurd values')
  await saveShot(page, 'edge', '81-absurd-values', 'light')
})

test('קצה · תאריך מסירה לפני תאריך החתימה', async ({ page }) => {
  // possession() reads a past handover as "in hand", so this account should present as an
  // owner rather than as a buyer with a negative countdown.
  await home(page, () => {}, -30)
  await noGarbage(page, 'handover before signing')
  await saveShot(page, 'edge', '82-key-before-signing', 'light')
  await expect(page.locator('.pmap')).toHaveCount(0)
})

test('קצה · אין תוכנית כלל, והמסכים האחרים', async ({ page }) => {
  await home(page, (k: string) => localStorage.removeItem(k))
  for (const [route, name] of [['/finances', '83-finances'], ['/wealth', '84-wealth']] as const) {
    await page.goto(route)
    await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForTimeout(1000)
    await noGarbage(page, name)
    await saveShot(page, 'edge', name, 'light')
  }
})
