import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * שיתוף הדירה — the feature Omer asked for by name: Moran on the same apartment, and a
 * person with more than one apartment switching between them (owner, 25.09).
 *
 * The rules that matter are in the database and are proved by scripts/rls/verify.sh
 * against a real Postgres — that is where isolation, the three-person cap and "only the
 * invited address may accept" are asserted, because RLS cannot be tested here at all:
 * this harness stubs REST wholesale and never evaluates a policy.
 *
 * What is left for this spec is the part the database cannot check: that the screen tells
 * the truth about who is on the apartment and how many places are left, and that the
 * switcher appears exactly when there is a choice to make.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const MORAN = '00000000-0000-0000-0000-0000000000bb'
const FLAT2 = '00000000-0000-0000-0000-0000000000cc'

const base = {
  mortgages: [], mortgage_tracks: [], investment_costs: [], contracts: [], loans: [],
  insurance_policies: [], transactions: [], recurring_items: [], tasks: [],
  documents: [], push_subscriptions: [],
}

const flat = (id: string, address: string) => ({
  id: `p-${id}`, owner_id: id, address, street: address, city: 'ירושלים',
  purchase_price: 2180000, purchase_date: '2025-01-01', key_delivery_date: '2025-01-01', rooms: 4,
})

async function settings(page: Page, fixture: Fixture) {
  await setTheme(page, 'light')
  await stubSupabase(page, fixture)
  await page.goto('/settings')
  await page.locator('.settings-sections').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(1000)
}

test('הדירה המשותפת — מי עליה, וכמה מקום נשאר', async ({ page }) => {
  await settings(page, {
    ...base,
    owners: [
      { id: OWNER, name: 'עומר', email: 'omer@example.com' },
      { id: MORAN, name: 'מורן', email: 'moran@example.com' },
    ],
    household_members: [
      { household_id: OWNER, user_id: OWNER },
      { household_id: OWNER, user_id: MORAN },
    ],
    household_invites: [
      { id: 'inv1', household_id: OWNER, email: 'aba@example.com', created_at: '2026-09-25T08:00:00Z', accepted_at: null },
    ],
    properties: [flat(OWNER, 'פסח חברוני 122')],
  })

  const members = page.locator('.hh-member')
  await expect(members).toHaveCount(3)           // two people + one invitation
  await expect(members.nth(0)).toContainText('עומר')
  await expect(members.nth(0), 'the signed-in person is marked').toContainText('את/ה')
  await expect(members.nth(1)).toContainText('מורן')
  await expect(members.nth(2)).toContainText('ממתין/ה לאישור')

  // Two members plus one invitation is three places taken, so the form is gone and the
  // copy says so — "עוד 2 אנשים" here would simply be untrue.
  await expect(page.locator('.hh-invite')).toHaveCount(0)
  await expect(page.getByText(/כל המקומות תפוסים/)).toBeVisible()
  await saveShot(page, 'sharing', '01-shared', 'light')
})

test('דירה אחת — אין בורר, ויש מקום לשניים', async ({ page }) => {
  await settings(page, {
    ...base,
    owners: [{ id: OWNER, name: 'עומר', email: 'omer@example.com' }],
    household_members: [{ household_id: OWNER, user_id: OWNER }],
    household_invites: [],
    properties: [flat(OWNER, 'פסח חברוני 122')],
  })

  // Nothing to choose between, so no control that implies there is.
  await expect(page.locator('.hh-switch')).toHaveCount(0)
  await expect(page.getByText(/אפשר לשתף את הדירה עם עוד 2 אנשים/)).toBeVisible()
  await expect(page.locator('.hh-invite input')).toBeVisible()
  // And nothing to leave: leaving an apartment that is yours alone would hide it from you
  // with nobody left to let you back in.
  await expect(page.getByRole('button', { name: /יציאה מהדירה המשותפת/ })).toHaveCount(0)
})

test('שתי דירות — הבורר מופיע ומסמן את הפעילה', async ({ page }) => {
  await settings(page, {
    ...base,
    owners: [
      { id: OWNER, name: 'עומר', email: 'omer@example.com' },
      { id: FLAT2, name: 'הדירה השנייה', email: null },
    ],
    household_members: [
      { household_id: OWNER, user_id: OWNER },
      { household_id: FLAT2, user_id: OWNER },
    ],
    household_invites: [],
    properties: [flat(OWNER, 'פסח חברוני 122'), flat(FLAT2, 'הרצל 10')],
  })

  const rows = page.locator('.hh-switch-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({ hasText: 'פסח חברוני 122' })).toHaveClass(/is-active/)
  await saveShot(page, 'sharing', '02-two-apartments', 'light')

  // Switching moves the mark — and the app is now reading the other apartment.
  await rows.filter({ hasText: 'הרצל 10' }).click()
  await page.waitForTimeout(600)
  await expect(page.locator('.hh-switch-row').filter({ hasText: 'הרצל 10' })).toHaveClass(/is-active/)
  await expect(page.locator('.hh-switch-row').filter({ hasText: 'פסח חברוני 122' })).not.toHaveClass(/is-active/)
})

test('הזמנה שממתינה לי — מוצעת, ומסבירה מה יקרה', async ({ page }) => {
  await settings(page, {
    ...base,
    owners: [
      { id: OWNER, name: 'עומר', email: 'omer@example.com' },
      { id: FLAT2, name: 'הדירה של אבא', email: null },
    ],
    household_members: [{ household_id: OWNER, user_id: OWNER }],
    // RLS is what limits this row to the addressee in production; here it is simply present.
    household_invites: [
      { id: 'inv9', household_id: FLAT2, email: 'view@test.local', created_at: '2026-09-25T08:00:00Z', accepted_at: null },
    ],
    properties: [flat(OWNER, 'פסח חברוני 122'), flat(FLAT2, 'הרצל 10')],
  })

  const card = page.locator('.hh-invite-in')
  await expect(card).toBeVisible()
  await expect(card).toContainText('הרצל 10')
  await expect(card, 'it says what joining will get you').toContainText('לעבור בין הדירות')
  await expect(card.getByRole('button', { name: /הצטרפות/ })).toBeVisible()
  await saveShot(page, 'sharing', '03-invited', 'light')
})
