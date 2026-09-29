import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * Exactly what happened to Omer (owner, 29.09: "עומר אומר שהוא לא רואה את זה").
 *
 * It was not a stale cache and not his mistake. A person with no apartment of their own
 * is routed straight into the nine-step wizard, and the wizard has no way out to
 * Settings — which was the only place an invitation was shown. He was being asked to
 * build an apartment while the one he had been invited to sat behind a door he could
 * not open.
 *
 * The first test below fails on the old build. That is the point of it.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const base = {
  mortgages: [], mortgage_tracks: [], investment_costs: [], contracts: [], loans: [],
  insurance_policies: [], transactions: [], recurring_items: [], tasks: [],
  documents: [], push_subscriptions: [],
}

const ITAI = '00000000-0000-0000-0000-0000000000dd'

/** The signed-in account's own email in the harness. */
const ME = 'view@test.local'

function inviteRow(role: 'member' | 'viewer' = 'member') {
  return {
    id: 'i1', household_id: ITAI, email: ME, role,
    household_label: 'פסח חברוני 122, ירושלים', invited_by_label: 'איתי',
    created_at: '2026-09-29T08:00:00Z', accepted_at: null,
  }
}

const flat = {
  id: 'p1', owner_id: OWNER, address: 'הרצל 10', street: 'הרצל 10', city: 'תל אביב',
  purchase_price: 900000, purchase_date: '2025-01-01', key_delivery_date: '2025-01-01', rooms: 3,
}

async function open(page: Page, fx: Fixture) {
  await setTheme(page, 'light')
  await stubSupabase(page, fx)
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('onboarding_draft')) localStorage.removeItem(k)
    sessionStorage.clear()
  })
  await page.goto('/')
}

test('אין דירה + יש הזמנה ⇒ ההזמנה, לא האשף', async ({ page }) => {
  await open(page, {
    ...base,
    owners: [{ id: OWNER, name: 'עומר', email: 'omer@example.com' }],
    household_members: [{ household_id: OWNER, user_id: OWNER, role: 'member' }],
    household_invites: [inviteRow()],
    properties: [],
  })

  await page.locator('.invofr').waitFor({ state: 'visible', timeout: 30_000 })
  // The wizard must NOT be what he meets. This is the whole bug.
  await expect(page.locator('.onboarding-welcome')).toHaveCount(0)
  await expect(page.getByText('איתי שיתף/ה איתך דירה')).toBeVisible()
  await expect(page.getByText('פסח חברוני 122, ירושלים'), 'and it says which apartment').toBeVisible()
  await saveShot(page, 'invite', '01-instead-of-wizard', 'light')

  // …and there is still a way past it to set up his own.
  await page.getByRole('button', { name: /להקים דירה משלי/ }).click()
  await page.waitForTimeout(900)
  await expect(page.locator('.onboarding-welcome, .onboarding-wrap').first()).toBeVisible()
  await expect(page.locator('.invofr')).toHaveCount(0)
})

test('ההזמנה אומרת באילו תנאים', async ({ page }) => {
  await open(page, {
    ...base,
    owners: [{ id: OWNER, name: 'עומר', email: 'omer@example.com' }],
    household_members: [{ household_id: OWNER, user_id: OWNER, role: 'member' }],
    household_invites: [inviteRow('viewer')],
    properties: [],
  })
  await page.locator('.invofr').waitFor({ state: 'visible', timeout: 30_000 })
  await expect(page.locator('.invofr-role')).toContainText('צופה בלבד')
  await saveShot(page, 'invite', '02-viewer', 'light')
})

test('יש דירה + יש הזמנה ⇒ קופץ בכניסה, ולא חוסם', async ({ page }) => {
  await open(page, {
    ...base,
    owners: [{ id: OWNER, name: 'עומר', email: 'omer@example.com' }],
    household_members: [{ household_id: OWNER, user_id: OWNER, role: 'member' }],
    household_invites: [inviteRow()],
    properties: [flat],
  })

  await page.locator('.invofr').waitFor({ state: 'visible', timeout: 30_000 })
  await saveShot(page, 'invite', '03-on-entry', 'light')

  // "לא עכשיו" leaves him in his own apartment rather than nowhere.
  await page.getByRole('button', { name: 'לא עכשיו' }).click()
  await page.waitForTimeout(700)
  await expect(page.locator('.invofr')).toHaveCount(0)
  await expect(page.locator('.bottom-nav')).toBeVisible()
})

test('אין הזמנה ⇒ שום דבר לא השתנה', async ({ page }) => {
  await open(page, {
    ...base,
    owners: [{ id: OWNER, name: 'עומר', email: 'omer@example.com' }],
    household_members: [{ household_id: OWNER, user_id: OWNER, role: 'member' }],
    household_invites: [],
    properties: [],
  })
  // Without this the gate could "pass" by swallowing the wizard for everyone.
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await expect(page.locator('.invofr')).toHaveCount(0)
})
