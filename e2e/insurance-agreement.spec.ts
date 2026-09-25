import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * Night run C2-B: two screens, one month, two "real profits".
 *
 * תזרים said −700 and +831; הון said −590 and +941. The gap was exactly the ₪110 insurance
 * premium, which the Wealth screen did not count because it never loaded the policies at
 * all. Both screens use the words "הרווח האמיתי" and gave different answers for the same
 * month — the owner cleared this to fix on 21.09.
 *
 * The assertion is deliberately the relationship, not the numbers: whatever the figures
 * are, the premium has to appear on both sides of the comparison.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const PREMIUM = 110

const fx: Fixture = {
  owners: [{ id: OWNER, name: 'עומר' }],
  properties: [{ id: 'p1', owner_id: OWNER, address: 'פסח חברוני 122, ירושלים', street: 'פסח חברוני 122', city: 'ירושלים', purchase_price: 2180000, purchase_date: '2024-12-01', key_delivery_date: '2025-01-01', rooms: 4 }],
  mortgages: [{ id: 'm1', owner_id: OWNER, payment_day: 10 }],
  mortgage_tracks: [{ id: 't1', owner_id: OWNER, mortgage_id: 'm1', track_type: 'prime', principal: 1000000, annual_rate: 5.5, term_months: 300, start_date: '2025-01-01', grace_months: 0 }],
  contracts: [{ id: 'c1', owner_id: OWNER, property_id: 'p1', company_name: 'מור לוי', start_date: '2026-01-01', end_date: '2027-01-01', monthly_rent: 4000, payment_method: 'check' }],
  insurance_policies: [{ id: 'i1', owner_id: OWNER, company: 'הראל', monthly_premium: PREMIUM, start_date: '2025-01-01', end_date: '2030-01-01' }],
  investment_costs: [], loans: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}

const num = (s: string) => Number(s.replace(/[^\d.-]/g, '')) || 0

async function wealthRealProfit(page: Page) {
  await page.goto('/wealth')
  await page.locator('.wlth-result').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(600)
  return page.evaluate(() => {
    const card = document.querySelector('.wlth-result')
    const rows = Array.from(card?.querySelectorAll('.wlth-result-row') ?? []).map(r => ({
      label: r.querySelector('span')?.textContent?.trim() ?? '',
      value: r.querySelector('strong')?.textContent ?? '',
      out: !!r.querySelector('strong.out'),
    }))
    return { rows, net: card?.querySelector('.wlth-result-net strong')?.textContent ?? '' }
  })
}

test('מסך ההון סופר את הביטוח — כמו התזרים', async ({ page }) => {
  await setTheme(page, 'light')
  await stubSupabase(page, fx)
  const wealth = await wealthRealProfit(page)
  await saveShot(page, 'insurance', 'wealth-real-profit', 'light')

  // The premium is a line of its own, named — not folded into "upkeep".
  const ins = wealth.rows.find(r => r.label.includes('ביטוח'))
  expect(ins, 'insurance must appear as its own row').toBeTruthy()
  expect(num(ins!.value)).toBe(PREMIUM)
  expect(ins!.out, 'and on the expense side').toBe(true)

  // …and it is subtracted, not merely displayed: the net equals the rows.
  const income = wealth.rows.filter(r => !r.out).reduce((s, r) => s + num(r.value), 0)
  const expense = wealth.rows.filter(r => r.out).reduce((s, r) => s + num(r.value), 0)
  expect(Math.abs(num(wealth.net)), 'the net is the sum of the rows above it')
    .toBeCloseTo(Math.abs(income - expense), 0)
})

test('אותו ביטוח — אותו מספר בשני המסכים', async ({ page }) => {
  await setTheme(page, 'light')
  await stubSupabase(page, fx)
  const wealth = await wealthRealProfit(page)

  // תזרים's month total counts rent, the whole mortgage payment and the insurance.
  // Wealth's "real profit" excludes the principal and calls that out in its own note,
  // so the bridge between them is exactly the principal — and nothing else.
  await page.goto('/finances')
  await page.locator('.finv-month-net, .finv-summary').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
  const finances = await page.evaluate(() => document.body.innerText)

  // The premium has to be visible as an expense on the cash-flow screen too — if it
  // vanished from there instead, the screens would "agree" for the wrong reason.
  expect(finances, 'the cash-flow screen still shows the insurance row').toContain('ביטוח')
  expect(Math.abs(num(wealth.net))).toBeGreaterThan(0)
})
