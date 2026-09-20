import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * The first minute — walked as the brother.
 *
 * The owner's whole reason for this work was "יש חבר ואח שלי שנכנסו לאפליקציה אבל עוד
 * לפני העברת המפתח", and "הדקה הראשונה באפליקציה זו הנקודה החשובה ביותר". A week of work
 * later, nobody had LOOKED at that minute: the wizard has never been rendered here.
 *
 * So this spec plays that person. It answers only what a buyer before handover can
 * honestly answer, skips what he cannot, and photographs every step — including the ones
 * where the honest answer is "I don't know yet".
 *
 * An empty account (no property) is what routes the app into the wizard, so the fixture
 * is deliberately bare.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

/** A brand-new account: the user exists, nothing else does. */
const empty: Fixture = {
  owners: [{ id: OWNER, name: 'אח של איתי' }],
  properties: [], mortgages: [], mortgage_tracks: [], investment_costs: [],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}

async function startWizard(page: Page) {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await page.addInitScript(() => {
    // A leftover draft from another run would hydrate the wizard mid-way and the walk
    // would photograph the wrong thing (the wizard backs its state up per user id).
    for (const k of Object.keys(localStorage)) if (k.startsWith('onboarding_draft')) localStorage.removeItem(k)
  })
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
}

async function step(page: Page, name: string) {
  await page.waitForTimeout(500)
  await saveShot(page, 'onboarding', name, 'light')
}

/** The step's own primary CTA — the one a person taps to move on. */
async function cont(page: Page) {
  await page.locator('.btn-onboard-primary').last().click()
  await page.waitForTimeout(700)
}

test('the first minute, as a buyer who has not got the key', async ({ page }) => {
  await startWizard(page)
  await step(page, '1-welcome')

  await cont(page)                      // מתחילים → documents
  await step(page, '2-documents')

  await cont(page)                      // → purchase
  await step(page, '3-purchase-empty')

  // What he can answer honestly. Signing happened; handover has a date; everything about
  // living in the flat does not exist yet.
  //
  // By LABEL — and that is the point. On the first walk getByLabel found nothing here:
  // every <label> in the wizard was decorative text with no htmlFor and no wrapping, so a
  // screen reader announced unnamed edit boxes and tapping a label focused nothing. This
  // step's labels are now real, and this locator is what keeps them real.
  await page.getByLabel('שם הרוכש').fill('אח של איתי')
  await page.getByLabel('רחוב').fill('הרצל 45')
  await page.getByLabel('עיר').fill('תל אביב')
  await page.getByLabel('מחיר רכישה (₪)').fill('1850000')

  // The signing date FIRST, and it is not optional any more. Every statutory deadline in
  // the plan is measured from it, so the app refuses to invent one: without this field
  // there is no plan at all (see the sibling test below, which holds that guarantee).
  await page.locator('.datefield').first().click()
  await page.locator('.calpop').waitFor({ state: 'visible' })
  await page.locator('.calpop-day:not(.blank):not([disabled])').first().click()
  await page.locator('.calpop').waitFor({ state: 'detached' }).catch(() => {})
  await page.waitForTimeout(300)

  // The two dates are not inputs at all — DateField is a button that opens a calendar.
  // Photograph it: it is a first-minute surface nobody here had ever seen either.
  await page.locator('.datefield').last().click()
  await page.locator('.calpop').waitFor({ state: 'visible' })
  await step(page, '4a-calendar')
  // Seven months forward, then a day — the buyer's real gesture for "מסירה באפריל".
  for (let i = 0; i < 7; i++) await page.locator('.calpop-nav').first().click()
  await page.locator('.calpop-day:not(.blank):not([disabled])').nth(9).click()
  await page.locator('.calpop').waitFor({ state: 'detached' }).catch(() => {})
  await page.waitForTimeout(400)
  await step(page, '4-purchase-filled')

  // The payment terms appear on this step once a future key date is set — this is where
  // the plan is now built (owner, 10.09: "ההקמה אמורה לקרות בעיקר באונבורדינג").
  await page.locator('.onboarding-terms').waitFor({ state: 'visible', timeout: 5000 })
  await page.getByRole('button', { name: '15% ואז 10%' }).click()
  await page.waitForTimeout(400)
  await step(page, '4b-terms')

  await cont(page)
  await step(page, '5-mortgage')

  await cont(page)
  await step(page, '6-loans')

  await cont(page)
  await step(page, '7-investment')

  await cont(page)
  await step(page, '8-rental')

  await cont(page)
  await step(page, '9-insurance')

  await cont(page)
  await step(page, '10-done')

  // The handoff into the app cannot be photographed here — the stub echoes writes without
  // persisting them, so the account still looks empty and the home shows its "no property"
  // state. What CAN be proven is the half that matters: the wizard built the plan, with the
  // split he chose. The other half (the home rendering it) is covered by purchase-map.spec.
  const stored = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('purchase_plan:'))
    return k ? JSON.parse(localStorage.getItem(k)!) : null
  })
  expect(stored, 'the wizard should have built a payment plan').not.toBeNull()
  expect(stored.firstPct).toBe(15)
  expect(stored.secondPct).toBe(10)
  expect(stored.items.find((i: { id: string }) => i.id === 'pay1').amount).toBe(277_500)
})

/**
 * The guarantee behind the change above: the app will not invent the date its legal
 * deadlines hang on.
 *
 * A buyer who signed two months ago and skips this field used to be told his 30-day tax
 * report was due in a month — because the plan was built with `signingDate || todayISO()`
 * and quietly anchored every statutory deadline to the day he installed. No signing date
 * now means no plan, which is the honest answer.
 */
test('בלי תאריך חתימה — האפליקציה לא ממציאה מועדים', async ({ page }) => {
  await startWizard(page)
  await cont(page)                      // → documents
  await cont(page)                      // → purchase

  await page.getByLabel('מחיר רכישה (₪)').fill('1850000')
  // Handover only. The signing DateField is left untouched, on purpose.
  await page.locator('.datefield').last().click()
  await page.locator('.calpop').waitFor({ state: 'visible' })
  for (let i = 0; i < 7; i++) await page.locator('.calpop-nav').first().click()
  await page.locator('.calpop-day:not(.blank):not([disabled])').nth(9).click()
  await page.locator('.calpop').waitFor({ state: 'detached' }).catch(() => {})
  await page.waitForTimeout(600)

  // The terms block still does its honest half — the amounts and the tax depend only on
  // the price and the declaration — but it must not assert a deadline it cannot place.
  const terms = page.locator('.onboarding-terms')
  await terms.waitFor({ state: 'visible', timeout: 5000 })
  await expect(terms).toContainText('מלאו תאריך חתימה')
  await expect(terms).not.toContainText('60 יום מהחתימה')

  const stored = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('purchase_plan:'))
    return k ? localStorage.getItem(k) : null
  })
  expect(stored, 'no signing date must mean no plan, not a plan dated from today').toBeNull()
})
