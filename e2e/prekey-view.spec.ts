import { test } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'

test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const PROPERTY_ID = 'p1'

function shift(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function account({ keyInDays, tasks = [], expectedRent }: {
  keyInDays: number
  tasks?: unknown[]
  expectedRent?: number
}): Fixture {
  return {
    owners: [{ id: '00000000-0000-0000-0000-0000000000aa', name: 'איתי בדיקה' }],
    properties: [{
      id: PROPERTY_ID, owner_id: 'u', address: 'הרצל 45, תל אביב',
      purchase_price: 1_850_000, purchase_date: shift(-60), key_delivery_date: shift(keyInDays),
      property_size_sqm: 68, floor: 4, rooms: 3, estimated_value: 1_850_000,
      buyer_name: 'איתי בדיקה', notes: null, block_parcel: null, created_at: shift(-60),
      ...(expectedRent === undefined ? {} : { expected_monthly_rent: expectedRent }),
    }],
    contracts: [],
    mortgages: [{ id: 'm1', property_id: PROPERTY_ID, lender: 'בנק לאומי', payment_day: null }],
    mortgage_tracks: [
      { id: 't1', mortgage_id: 'm1', label: 'פריים', track_type: 'prime', principal: 600_000,
        annual_rate: 5.5, prime_rate: 6, margin: -0.5, term_months: 240, grace_months: 0,
        start_date: shift(keyInDays) },
      { id: 't2', mortgage_id: 'm1', label: 'קבועה לא צמודה', track_type: 'fixed_unlinked',
        principal: 550_000, annual_rate: 4.2, prime_rate: null, margin: null,
        term_months: 300, grace_months: 0, start_date: shift(keyInDays) },
    ],
    investment_costs: [
      { id: 'c1', category: 'self_equity', amount: 700_000, label: null },
      { id: 'c2', category: 'lawyer', amount: 12_000, label: null },
      { id: 'c3', category: 'brokerage', amount: 39_000, label: null },
    ],
    loans: [], insurance_policies: [], transactions: [], recurring_items: [],
    tasks, documents: [], push_subscriptions: [],
  }
}

async function open(page: import('@playwright/test').Page, fixture: Fixture) {
  await setTheme(page, 'light')
  await stubSupabase(page, fixture)
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
}

test('pre-key home, seven months out, checklist not yet added', async ({ page }) => {
  await open(page, account({ keyInDays: 213 }))
  await saveShot(page, 'prekey-home', 'far-no-tasks', 'light')
})

test('pre-key home with the expected-rent lever filled', async ({ page }) => {
  await open(page, account({ keyInDays: 213, expectedRent: 5200 }))
  await saveShot(page, 'prekey-home', 'far-with-rent', 'light')
})

test('pre-key home, handover in two weeks, checklist added', async ({ page }) => {
  const tasks = [
    { id: 'k1', title: 'לקבוע מועדים: מס רכישה ותשלומים למוכר', due_date: null, due_time: null, category: 'כללי', status: 'open', source: 'manual', is_recurring: false, property_id: PROPERTY_ID, recurring_item_id: null, transaction_id: null, recurrence_days: null },
    { id: 'k2', title: 'להתחיל לחפש שוכר', due_date: shift(0), due_time: null, category: 'כללי', status: 'open', source: 'manual', is_recurring: false, property_id: PROPERTY_ID, recurring_item_id: null, transaction_id: null, recurrence_days: null },
    { id: 'k3', title: 'בדיקת ליקויים לקראת המסירה', due_date: shift(0), due_time: null, category: 'ביקור ובדיקה', status: 'open', source: 'manual', is_recurring: false, property_id: PROPERTY_ID, recurring_item_id: null, transaction_id: null, recurrence_days: null },
    { id: 'k4', title: 'להעביר חשמל, מים, ארנונה וועד בית על שמכם', due_date: shift(14), due_time: null, category: 'כללי', status: 'open', source: 'manual', is_recurring: false, property_id: PROPERTY_ID, recurring_item_id: null, transaction_id: null, recurrence_days: null },
  ]
  await open(page, account({ keyInDays: 14, tasks, expectedRent: 5200 }))
  await saveShot(page, 'prekey-home', 'soon-with-tasks', 'light')
})

test('handover day', async ({ page }) => {
  await open(page, account({ keyInDays: -1 }))
  await saveShot(page, 'prekey-home', 'handover', 'light')
})

test('pre-key home in dark mode', async ({ page }) => {
  await setTheme(page, 'dark')
  await stubSupabase(page, account({ keyInDays: 213, expectedRent: 5200 }))
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(900)
  await saveShot(page, 'prekey-home', 'far-with-rent', 'dark')
})
