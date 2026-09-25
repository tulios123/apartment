import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * Omer's note 17 — "three yields, one number, no explanation" — and the owner's decision
 * of 24.09 that followed from the research.
 *
 * The research first: three rows reading 2.5% was arithmetic, not a fault. Under the OLD
 * definition the denominator was current net equity (value − debt), so with no debt the
 * equity IS the value, there is no interest to subtract and no principal to add back, and
 * all three formulas collapsed to rent ÷ value.
 *
 * That definition had a property nobody wants from a yield: repaying the mortgage grows
 * the equity, so the number FALLS every month while nothing about the deal changes, and a
 * re-valuation of the flat moves it too. The owner's answer: measure against the money
 * that actually went in. The decisive test here is therefore not a number — it is that
 * the equity yield is now INDIFFERENT to what the flat is worth, and the gross one is not.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const PRICE = 2_180_000
const EQUITY = 980_000
const COSTS = 14_042 + 51_448 + 7_044
const INVESTED = EQUITY + COSTS

/** ₪4,500 rent. `mortgage` is the variable; `value` lets the flat be re-valued. */
function fx(o: { mortgage: number; value?: number }): Fixture {
  return {
    owners: [{ id: OWNER, name: 'עומר' }],
    properties: [{
      id: 'p1', owner_id: OWNER, address: 'פסח חברוני 122, ירושלים',
      street: 'פסח חברוני 122', city: 'ירושלים', rooms: 4,
      purchase_price: PRICE, estimated_value: o.value ?? null,
      purchase_date: '2024-12-01', key_delivery_date: '2025-01-01',
    }],
    mortgages: [{ id: 'm1', owner_id: OWNER, payment_day: 10 }],
    mortgage_tracks: o.mortgage > 0
      ? [{ id: 't1', owner_id: OWNER, mortgage_id: 'm1', track_type: 'prime', principal: o.mortgage, annual_rate: 5.5, term_months: 300, start_date: '2025-01-01', grace_months: 0 }]
      : [],
    investment_costs: [
      { id: 'ic1', owner_id: OWNER, category: 'self_equity', label: null, amount: EQUITY },
      { id: 'ic2', owner_id: OWNER, category: 'lawyer', label: null, amount: 14_042 },
      { id: 'ic3', owner_id: OWNER, category: 'brokerage', label: null, amount: 51_448 },
      { id: 'ic4', owner_id: OWNER, category: 'purchase_tax', label: null, amount: 7_044 },
    ],
    contracts: [{ id: 'c1', owner_id: OWNER, property_id: 'p1', company_name: 'מור לוי', start_date: '2026-01-01', end_date: '2027-01-01', monthly_rent: 4500, payment_method: 'check' }],
    loans: [], insurance_policies: [], transactions: [],
    recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
  }
}

async function yields(page: Page, cfg: Parameters<typeof fx>[0]) {
  await setTheme(page, 'light')
  await stubSupabase(page, fx(cfg))
  await page.goto('/wealth')
  await page.locator('.wlth-yields').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
  return page.evaluate(() => Array.from(document.querySelectorAll('.wlth-yields div')).map(d => ({
    label: (d.querySelector('span')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    value: (d.querySelector('strong')?.textContent ?? '').trim(),
  })))
}
const pcts = (rows: { label: string; value: string }[]) => rows.filter(r => r.value.endsWith('%'))

test('התשואה על ההשקעה לא זזה כששווי הדירה זז — הברוטו כן', async ({ page }) => {
  const base = pcts(await yields(page, { mortgage: 1_200_000 }))
  const equityBefore = base.filter(r => r.label.includes('שהשקעת')).map(r => r.value)
  const grossBefore = base.find(r => r.label.includes('ברוטו'))!.value

  // The same deal, the flat now valued 400k higher. Nothing about the investment changed.
  const after = pcts(await yields(page, { mortgage: 1_200_000, value: PRICE + 400_000 }))
  const equityAfter = after.filter(r => r.label.includes('שהשקעת')).map(r => r.value)
  const grossAfter = after.find(r => r.label.includes('ברוטו'))!.value

  expect(
    equityAfter,
    'this is the whole point of the 24.09 change: the yield measures the investment, not the market',
  ).toEqual(equityBefore)
  expect(grossAfter, 'while the gross yield is a statement about the value, so it does move')
    .not.toBe(grossBefore)
})

test('עם החזר קרן — שלוש תשואות, ושלושתן שונות', async ({ page }) => {
  const rows = await yields(page, { mortgage: 1_200_000 })
  const p = pcts(rows).map(r => r.value)
  expect(p.length).toBe(3)
  expect(new Set(p).size, `all three read the same: ${p.join(', ')}`).toBe(3)
  // …and the card says what it measured against, without being opened.
  await expect(page.locator('.wlth-yield-note')).toContainText(String(INVESTED).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
  await saveShot(page, 'yields', '01-with-debt', 'light')
})

test('בלי החזר קרן — שתיים, לא שלוש פעמים אותו מספר', async ({ page }) => {
  const rows = await yields(page, { mortgage: 0 })
  const p = pcts(rows)
  expect(p.length, 'no principal to add back, so the pair is one figure').toBe(2)
  expect(p.some(r => r.label.includes('כולל בניית הון')), 'and the second label is gone').toBe(false)
  await saveShot(page, 'yields', '02-no-principal', 'light')
})

test('ה-(?) אומר מול מה נמדד, ושזה סכום קבוע', async ({ page }) => {
  await yields(page, { mortgage: 1_200_000 })
  await page.getByRole('button', { name: 'מה ההבדל בין התשואות' }).click()
  await page.waitForTimeout(300)
  const help = page.locator('.wlth-yield-help-body')
  await expect(help).toBeVisible()
  await expect(help).toContainText('שכר הדירה השנתי חלקי שווי הנכס')
  await expect(help, 'names the denominator').toContainText('ההון העצמי ועלויות הרכישה')
  await expect(help, 'and why it is the right one').toContainText('סכום קבוע')
  await saveShot(page, 'yields', '03-explained', 'light')
})
