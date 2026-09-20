import { test, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'

/**
 * PASS 1 — stage B, walked as the persona Gemini specified, not as the owner.
 *
 * A 22-year-old buying his ONLY apartment for ₪1,090,000. Two things make this walk
 * different from the investment walk beside it, and both are load-bearing:
 *
 *  1. **Purchase tax is ₪0.** Under the 2026 single-apartment exemption (₪1,978,745) he
 *     owes nothing — so the app's largest computed number is zero, and every row, total
 *     and progress bar has to survive that without looking broken or lying.
 *  2. **The key is a month away, not seven.** Stage 2 is not a distant fold; it is next.
 *
 * His equity is ₪290,000 against ₪272,500 of scheduled payments — ₪17,500 of slack for
 * every cost in the deal. He is not afraid of the apartment. He is afraid of being short.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const OWNER = '00000000-0000-0000-0000-0000000000aa'
const P = 'p1'

/** Exact dates, not offsets — the persona's deal is specified to the day. */
export const SIGNING = '2026-07-11'
export const KEY = '2026-10-11'
const PRICE = 1_090_000

const empty: Fixture = {
  owners: [{ id: OWNER, name: 'רון' }],
  properties: [], mortgages: [], mortgage_tracks: [], investment_costs: [],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}

/** After onboarding: only what he could honestly answer. No insurance, no loans, no lease. */
const afterWizard: Fixture = {
  owners: [{ id: OWNER, name: 'רון' }],
  properties: [{
    id: P, owner_id: OWNER, address: 'ויצמן 12, פתח תקווה', purchase_price: PRICE,
    purchase_date: SIGNING, key_delivery_date: KEY, property_size_sqm: 52, floor: 2,
    rooms: 2.5, estimated_value: PRICE, buyer_name: 'רון', notes: null,
    block_parcel: null, created_at: SIGNING,
  }],
  mortgages: [{ id: 'm1', property_id: P, lender: 'בנק הפועלים', payment_day: null }],
  mortgage_tracks: [
    { id: 't1', mortgage_id: 'm1', owner_id: OWNER, label: 'משכנתא', track_type: 'fixed_unlinked',
      principal: 817_500, annual_rate: 4.6, prime_rate: null, margin: null,
      term_months: 360, grace_months: 0, start_date: KEY },
  ],
  // ₪290,000 of equity, and NOT the closing costs — he does not have those numbers.
  investment_costs: [{ id: 'c1', owner_id: OWNER, category: 'self_equity', amount: 290_000, label: null }],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}

/** Clear ONCE per context — addInitScript fires on every navigation and would wipe the
 *  plan the moment the walk moves to another pillar. */
async function clearOnce(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__walk_cleared')) return
    sessionStorage.setItem('__walk_cleared', '1')
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('onboarding_draft') || k.startsWith('purchase_plan:')) localStorage.removeItem(k)
    }
  })
}

// ── The first minute: the wizard, filled only with what he honestly knows ──────────────
test('P1 · הדקה הראשונה — האשף, במסלול הזול-והכן', async ({ page }) => {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await clearOnce(page)
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(800)
  await saveShot(page, 'p1', '01-first-screen', 'light')

  await page.locator('.btn-onboard-primary').last().click()   // → documents
  await page.waitForTimeout(600)
  await saveShot(page, 'p1', '02-documents', 'light')

  await page.locator('.btn-onboard-primary').last().click()   // → purchase
  await page.waitForTimeout(600)
  await saveShot(page, 'p1', '03-purchase-empty', 'light')

  // Only what a 22-year-old knows without opening a drawer: his name, the address, the
  // price, and the two dates on the contract he signed. Size/floor/rooms are skipped —
  // he could look them up, and the cheapest honest path does not.
  await page.getByLabel('שם הרוכש').fill('רון')
  await page.getByLabel('רחוב').fill('ויצמן 12')
  await page.getByLabel('עיר').fill('פתח תקווה')
  await page.getByLabel('מחיר רכישה (₪)').fill(String(PRICE))
  await page.waitForTimeout(300)
  await saveShot(page, 'p1', '04-typed-no-dates', 'light')

  // The handover date. DateField is a button, not an input — one tap, one month forward,
  // one day. (Signing is the other DateField; its own walk is below.)
  await page.locator('.datefield').last().click()
  await page.locator('.calpop').waitFor({ state: 'visible' })
  await page.locator('.calpop-nav').first().click()
  await page.locator('.calpop-day:not(.blank):not([disabled])').nth(10).click()
  await page.locator('.calpop').waitFor({ state: 'detached' }).catch(() => {})
  await page.waitForTimeout(500)
  await saveShot(page, 'p1', '05-key-date-set', 'light')

  // Payment terms appear here once a future key date exists. This is the moment the app
  // first computes rather than echoes — the cost measurement stops at whatever this shows.
  const terms = page.locator('.onboarding-terms')
  if (await terms.count()) {
    await terms.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await saveShot(page, 'p1', '06-terms-default', 'light')
    await page.getByRole('button', { name: '10% ואז 15%' }).click()
    await page.waitForTimeout(400)
    await saveShot(page, 'p1', '07-terms-10-15', 'light')
  }

  // Every remaining step, skipped — nothing here he can answer without documents.
  for (const [i, name] of ['08-mortgage', '09-loans', '10-investment', '11-rental', '12-insurance', '13-done'].entries()) {
    await page.locator('.btn-onboard-primary').last().click()
    await page.waitForTimeout(650)
    await saveShot(page, 'p1', `${name}`, 'light')
    if (i > 6) break
  }
})

// ── The app he lands in ───────────────────────────────────────────────────────────────
async function inApp(page: Page, theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, afterWizard)
  await clearOnce(page)
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
}

test('P1 · הבית והלוח', async ({ page }) => {
  await inApp(page)
  await saveShot(page, 'p1', '20-home-no-plan', 'light')

  await page.getByRole('button', { name: 'לבנות את הלוח' }).click()
  await page.locator('.pln-setup').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '10% ואז 15%' }).click()
  await page.getByRole('button', { name: 'דירה יחידה' }).click()
  await page.waitForTimeout(400)
  await saveShot(page, 'p1', '21-setup-single', 'light')

  await page.getByRole('button', { name: 'בניית הלוח' }).click()
  await page.locator('.pmap').waitFor({ state: 'visible' })
  await page.waitForTimeout(700)
  await saveShot(page, 'p1', '22-home-map', 'light')

  for (const [i, name] of ['המשכנתא והמסירה', 'הסגירה'].entries()) {
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await page.waitForTimeout(400)
    await saveShot(page, 'p1', `23-stage-${i + 2}`, 'light')
  }
})

test('P1 · שאר העמודים', async ({ page }) => {
  await inApp(page)
  await page.getByRole('button', { name: 'לבנות את הלוח' }).click()
  await page.locator('.pln-setup').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'דירה יחידה' }).click()
  await page.getByRole('button', { name: 'בניית הלוח' }).click()
  await page.locator('.pmap').waitFor({ state: 'visible' })
  await page.waitForTimeout(500)

  for (const [route, name] of [['/finances', '30-finances'], ['/wealth', '31-wealth'], ['/property', '32-property']] as const) {
    await page.goto(route)
    await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForTimeout(1100)
    await saveShot(page, 'p1', name, 'light')
  }
})

test('P1 · כהה', async ({ page }) => {
  await inApp(page, 'dark')
  await page.getByRole('button', { name: 'לבנות את הלוח' }).click()
  await page.locator('.pln-setup').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'דירה יחידה' }).click()
  await page.getByRole('button', { name: 'בניית הלוח' }).click()
  await page.locator('.pmap').waitFor({ state: 'visible' })
  await page.waitForTimeout(700)
  await saveShot(page, 'p1', '22-home-map', 'dark')
})
