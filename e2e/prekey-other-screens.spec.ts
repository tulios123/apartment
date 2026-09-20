import { test } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'

// The other three pillars, seen by a buyer who has not taken delivery. The pre-key work
// so far only ever touched the home; the owner asked what תזרים / הון / הנכס do in this
// stage (08.09) and nobody had looked.
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

const preKey: Fixture = {
  owners: [{ id: OWNER, name: 'איתי בדיקה' }],
  properties: [{
    id: P, owner_id: OWNER, address: 'הרצל 45, תל אביב', purchase_price: 1_850_000,
    purchase_date: d(-60), key_delivery_date: d(213), property_size_sqm: 68, floor: 4,
    rooms: 3, estimated_value: 1_850_000, buyer_name: 'איתי בדיקה', notes: null,
    block_parcel: null, created_at: d(-60),
  }],
  mortgages: [{ id: 'm1', property_id: P, lender: 'בנק לאומי', payment_day: null }],
  mortgage_tracks: [
    { id: 't1', mortgage_id: 'm1', owner_id: OWNER, label: 'פריים', track_type: 'prime',
      principal: 600_000, annual_rate: 5.5, prime_rate: 6, margin: -0.5,
      term_months: 240, grace_months: 0, start_date: d(213) },
    { id: 't2', mortgage_id: 'm1', owner_id: OWNER, label: 'קל״צ', track_type: 'fixed_unlinked',
      principal: 550_000, annual_rate: 4.2, prime_rate: null, margin: null,
      term_months: 300, grace_months: 0, start_date: d(213) },
  ],
  investment_costs: [
    { id: 'c1', owner_id: OWNER, category: 'self_equity', amount: 700_000, label: null },
    { id: 'c2', owner_id: OWNER, category: 'lawyer', amount: 12_000, label: null },
    { id: 'c3', owner_id: OWNER, category: 'brokerage', amount: 39_000, label: null },
  ],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}

async function shoot(page: import('@playwright/test').Page, route: string, name: string) {
  await setTheme(page, 'light')
  await stubSupabase(page, preKey)
  await page.goto(route)
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await saveShot(page, name, 'prekey', 'light')
}

test('תזרים before handover', async ({ page }) => {
  await shoot(page, '/finances', 'finances')
})

test('הון before handover', async ({ page }) => {
  await shoot(page, '/wealth', 'wealth')
})

test('הנכס before handover', async ({ page }) => {
  await shoot(page, '/property', 'property')
})
