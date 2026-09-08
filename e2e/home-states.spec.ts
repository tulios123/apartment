import { test } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'

// Every state the home can be in, rendered offline. Built for the brains-tour (08.09):
// judging a screen's hierarchy from source is guesswork, and the leased state — the one
// the owner and his family look at daily — had never been rendered here at all.
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const P = 'p1'
const OWNER = '00000000-0000-0000-0000-0000000000aa'

function d(days: number): string {
  const x = new Date()
  x.setDate(x.getDate() + days)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const monthDay = (day: number) => `${d(0).slice(0, 8)}${String(day).padStart(2, '0')}`

const base = (keyInDays: number): Fixture => ({
  owners: [{ id: OWNER, name: 'איתי בדיקה' }],
  properties: [{
    id: P, owner_id: OWNER, address: 'הרצל 45, תל אביב', purchase_price: 1_850_000,
    purchase_date: d(-60), key_delivery_date: d(keyInDays), property_size_sqm: 68,
    floor: 4, rooms: 3, estimated_value: 1_950_000, buyer_name: 'איתי בדיקה',
    notes: null, block_parcel: null, created_at: d(-60),
  }],
  mortgages: [{ id: 'm1', property_id: P, lender: 'בנק לאומי', payment_day: null }],
  mortgage_tracks: [
    { id: 't1', mortgage_id: 'm1', owner_id: OWNER, label: 'פריים', track_type: 'prime',
      principal: 600_000, annual_rate: 5.5, prime_rate: 6, margin: -0.5,
      term_months: 240, grace_months: 0, start_date: d(keyInDays) },
    { id: 't2', mortgage_id: 'm1', owner_id: OWNER, label: 'קל״צ', track_type: 'fixed_unlinked',
      principal: 550_000, annual_rate: 4.2, prime_rate: null, margin: null,
      term_months: 300, grace_months: 0, start_date: d(keyInDays) },
  ],
  investment_costs: [
    { id: 'c1', owner_id: OWNER, category: 'self_equity', amount: 700_000, label: null },
    { id: 'c2', owner_id: OWNER, category: 'lawyer', amount: 12_000, label: null },
    { id: 'c3', owner_id: OWNER, category: 'brokerage', amount: 39_000, label: null },
  ],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
})

/** The ordinary account: keys long held, a tenant in place, the monthly cycle running. */
function leased(opts: { rentPaid?: boolean; tasks?: unknown[]; renewalSoon?: boolean } = {}): Fixture {
  const f = base(-400)
  f.contracts = [{
    id: 'ct1', owner_id: OWNER, property_id: P, company_name: 'דנה לוי',
    start_date: d(-300), end_date: opts.renewalSoon ? d(25) : d(120),
    monthly_rent: 5_200, deposit: 5_200, payment_method: 'check',
    requires_approval: true, renewal_alert_days: [60, 30], contact_name: null,
    contact_phone: null, created_at: d(-300),
  }]
  f.recurring_items = [{
    id: 'r1', owner_id: OWNER, contract_id: 'ct1', direction: 'income', amount: 5_200,
    category: 'שכר דירה', day_of_month: 5, start_date: d(-300), end_date: d(120),
    payee: 'דנה לוי', execution_type: 'requires_approval', payment_method: 'check',
    renewal_alert_days: [60, 30],
  }]
  f.insurance_policies = [{
    id: 'i1', owner_id: OWNER, property_id: P, type: 'מבנה', company: 'הראל',
    monthly_premium: 95, start_date: d(-300), end_date: d(65),
  }]
  if (opts.rentPaid) {
    f.transactions = [{
      id: 'x1', owner_id: OWNER, direction: 'income', amount: 5_200, date: monthDay(5),
      category: 'שכר דירה', description: 'דנה לוי', payment_method: 'check',
      recurring_item_id: 'r1',
    }]
  }
  f.tasks = opts.tasks ?? []
  return f
}

const task = (id: string, title: string, due: string | null, category = 'כללי') => ({
  id, owner_id: OWNER, property_id: P, title, due_date: due, due_time: null, category,
  status: 'open', source: 'manual', is_recurring: false, recurring_item_id: null,
  transaction_id: null, recurrence_days: null,
})

async function shoot(page: import('@playwright/test').Page, fixture: Fixture, state: string, theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, fixture)
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
  await saveShot(page, 'home', state, theme)
}

test('leased — rent still pending, nothing else', async ({ page }) => {
  await shoot(page, leased(), 'leased-rent-pending')
})

test('leased — rent in, all clear', async ({ page }) => {
  await shoot(page, leased({ rentPaid: true }), 'leased-all-clear')
})

test('leased — a busy day: rent, two tasks, a renewal', async ({ page }) => {
  await shoot(page, leased({
    renewalSoon: true,
    tasks: [
      task('k1', 'לתאם בדיקת דוד שמש', d(0), 'תיקונים ותחזוקה'),
      task('k2', 'לשלם ארנונה', d(-2)),
      task('k3', 'לחדש ביטוח מבנה', d(40)),
    ],
  }), 'leased-busy')
})

test('leased — dark', async ({ page }) => {
  await shoot(page, leased({ rentPaid: true }), 'leased-all-clear', 'dark')
})

test('keys held, no tenant yet', async ({ page }) => {
  await shoot(page, base(-60), 'vacant')
})
