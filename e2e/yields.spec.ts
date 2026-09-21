import { test, expect } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * Omer's note 17 — "three yields, one number, no explanation".
 *
 * The research first, because the owner asked for it before a fix: his screenshot showed
 * 2.5% / 2.5% / 2.5%, and my instinct was that the equity-based ones should be several
 * times the gross. They should — WHEN there is debt. With no debt on the books all three
 * formulas reduce to the same expression: the equity IS the property value, there is no
 * interest to subtract and no principal to add back, so each one is rent ÷ value. It was
 * arithmetic, not a calculation fault, and this spec is the reproduction that settles it.
 *
 * What was wrong is the presentation: three rows saying one thing, and no (?) anywhere.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

/** ₪2.18m, ₪4,500 rent ⇒ a gross yield of 2.48%. Debt is the variable. */
function fx(principal: number): Fixture {
  return {
    owners: [{ id: OWNER, name: 'עומר' }],
    properties: [{ id: 'p1', owner_id: OWNER, address: 'פסח חברוני 122, ירושלים', street: 'פסח חברוני 122', city: 'ירושלים', purchase_price: 2180000, purchase_date: '2024-12-01', key_delivery_date: '2025-01-01', rooms: 4 }],
    mortgages: [{ id: 'm1', owner_id: OWNER, payment_day: 10 }],
    mortgage_tracks: principal > 0
      ? [{ id: 't1', owner_id: OWNER, mortgage_id: 'm1', track_type: 'prime', principal, annual_rate: 5.5, term_months: 300, start_date: '2025-01-01', grace_months: 0 }]
      : [],
    contracts: [{ id: 'c1', owner_id: OWNER, property_id: 'p1', company_name: 'מור לוי', start_date: '2026-01-01', end_date: '2027-01-01', monthly_rent: 4500, payment_method: 'check' }],
    investment_costs: [], loans: [], insurance_policies: [], transactions: [],
    recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
  }
}

const yieldRows = (page: import('@playwright/test').Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll('.wlth-yields div'))
    .map(d => ({
      label: (d.querySelector('span')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      value: (d.querySelector('strong')?.textContent ?? '').trim(),
    })))

async function wealth(page: import('@playwright/test').Page, principal: number) {
  await setTheme(page, 'light')
  await stubSupabase(page, fx(principal))
  await page.goto('/wealth')
  await page.locator('.wlth-yields').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
}

test('בלי חוב — תשואה אחת, ולא שלוש פעמים אותו מספר', async ({ page }) => {
  await wealth(page, 0)
  const rows = await yieldRows(page)
  const pct = rows.filter(r => r.value.endsWith('%'))
  expect(pct.length, 'one percentage, not three identical ones').toBe(1)
  expect(pct[0].value).toBe('2.5%')
  await expect(page.getByText(/אין חוב רשום על הנכס/)).toBeVisible()
  await saveShot(page, 'yields', '01-no-debt', 'light')
})

test('עם חוב — שלוש תשואות שונות באמת', async ({ page }) => {
  await wealth(page, 1_200_000)
  const rows = await yieldRows(page)
  const pct = rows.filter(r => r.value.endsWith('%')).map(r => r.value)
  expect(pct.length).toBe(3)
  // The whole point of showing three: with debt they genuinely differ.
  expect(new Set(pct).size, `all three read the same: ${pct.join(', ')}`).toBe(3)
  expect(pct).toContain('2.5%')   // the gross one is unchanged by the debt
  await saveShot(page, 'yields', '02-with-debt', 'light')
})

test('ה-(?) מסביר מה כל תשואה מודדת', async ({ page }) => {
  await wealth(page, 1_200_000)
  await page.getByRole('button', { name: 'מה ההבדל בין התשואות' }).click()
  await page.waitForTimeout(300)
  const help = page.locator('.wlth-yield-help-body')
  await expect(help).toBeVisible()
  await expect(help).toContainText('שכר הדירה השנתי חלקי שווי הנכס')
  await expect(help, 'and it says which "equity" it means — today\'s, not what was put in')
    .toContainText('לא הסכום שהשקעת')
  await saveShot(page, 'yields', '03-explained', 'light')
})
