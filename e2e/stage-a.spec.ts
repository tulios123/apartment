import { test, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'

/**
 * PASS 3 — stage A: someone who has chosen a flat and has NOT signed.
 *
 * There is nothing to regression-test here, because there is nothing here. The app has
 * exactly two states, derived from the key-handover date, and neither of them is "still
 * deciding". So this walk is evidence-gathering for a design brief: it does not ask
 * whether the screens are good, it asks **what the app actually does to this person** —
 * which nobody has watched, because the assumption has always been that he is not a user
 * yet.
 *
 * He is: the owner's own framing is that the app must catch a customer at every stage,
 * and the before-signing buyer is the one with the most questions and the least data.
 *
 * The walk is deliberately honest to the point of stubbornness: this persona enters NO
 * price and NO dates, because he does not have them. Everything the app then shows him is
 * the finding.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const OWNER = '00000000-0000-0000-0000-0000000000aa'

const empty: Fixture = {
  owners: [{ id: OWNER, name: 'מאיה' }],
  properties: [], mortgages: [], mortgage_tracks: [], investment_costs: [],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}

async function start(page: Page) {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__walk_cleared')) return
    sessionStorage.setItem('__walk_cleared', '1')
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('onboarding_draft') || k.startsWith('purchase_plan:')) localStorage.removeItem(k)
    }
  })
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(800)
}

/**
 * מאיה is weighing two flats at about ₪1.4M. She has no contract, no signing date, no
 * handover date, no mortgage approval — she has a question: can I afford this, and what
 * will it actually cost me. She answers only what is true.
 */
test('א · מי שעוד לא חתם, עונה רק אמת', async ({ page }) => {
  await start(page)
  await saveShot(page, 'a', '50-welcome', 'light')

  await page.locator('.btn-onboard-primary').last().click()
  await page.waitForTimeout(600)
  await saveShot(page, 'a', '51-documents', 'light')     // she has no documents to upload

  await page.locator('.btn-onboard-primary').last().click()
  await page.waitForTimeout(600)

  // Her name and roughly where she is looking. That is the whole truthful set.
  await page.getByLabel('שם הרוכש').fill('מאיה')
  await page.getByLabel('עיר').fill('חיפה')
  await page.waitForTimeout(400)
  await saveShot(page, 'a', '52-purchase-honest', 'light')

  // Everything after this she cannot answer: mortgage, loans, costs, rent, insurance.
  for (const name of ['53-mortgage', '54-loans', '55-investment', '56-rental', '57-insurance', '58-done']) {
    await page.locator('.btn-onboard-primary').last().click()
    await page.waitForTimeout(650)
    await saveShot(page, 'a', name, 'light')
  }
})

/**
 * Where the wizard actually puts her.
 *
 * `possession(null, today)` returns `in_hand` — a blank handover date means the place is
 * yours, deliberately, so that every existing owner reads correctly on deploy. For מאיה
 * that same rule hands a woman who owns nothing the full owner experience: net worth,
 * ownership percentage, a monthly cycle. The stub echoes writes without persisting, so
 * this fixture IS her account as the wizard would have left it.
 */
const asWizardLeftHer: Fixture = {
  ...empty,
  properties: [{
    id: 'p1', owner_id: OWNER, address: 'חיפה', purchase_price: 0,
    purchase_date: null, key_delivery_date: null, property_size_sqm: null, floor: null,
    rooms: null, estimated_value: null, buyer_name: 'מאיה', notes: null,
    block_parcel: null, created_at: '2026-09-10',
  }],
}

test('א · לאן היא נוחתת — האפליקציה של בעלת-דירה, בלי דירה', async ({ page }) => {
  await setTheme(page, 'light')
  await stubSupabase(page, asWizardLeftHer)
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(1000)
  await saveShot(page, 'a', '70-home', 'light')

  for (const [route, name] of [['/wealth', '71-wealth'], ['/finances', '72-finances']] as const) {
    await page.goto(route)
    await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForTimeout(1100)
    await saveShot(page, 'a', name, 'light')
  }
})

/**
 * The other thing she might do: put in a price to see what happens. No dates — she has
 * none. This is the likeliest real behaviour, and it is where the app's two-state model
 * decides, silently, that she already owns the flat.
 */
test('א · מחיר בלי תאריכים — לאן האפליקציה שמה אותה', async ({ page }) => {
  await start(page)
  await page.locator('.btn-onboard-primary').last().click()
  await page.locator('.btn-onboard-primary').last().click()
  await page.waitForTimeout(500)

  await page.getByLabel('שם הרוכש').fill('מאיה')
  await page.getByLabel('עיר').fill('חיפה')
  await page.getByLabel('מחיר רכישה (₪)').fill('1400000')
  await page.waitForTimeout(500)
  await saveShot(page, 'a', '60-price-no-dates', 'light')
})
