import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * "יש אופציה למורן לדלג על האונבורדינג ולהגיע ישר לדירה?" — owner, 29.09.
 *
 * The question is not about the invitation card, which works: it replaces the wizard and
 * she can accept from it. It is about the boot AFTER accepting, when she owns no apartment
 * of her own and belongs to somebody else's.
 *
 * The boot probe asks "does this account have a property?" against `ownerId`, and ownerId
 * falls back to `user.id` until the household membership has been read — which happens
 * after `loading` clears. So the very first probe runs as HER, finds nothing, and routes
 * her to the wizard; the membership arrives a moment later and nothing asks again.
 *
 * ── Why this spec routes `properties` itself ──
 * The shared stub deliberately drops `owner_id` filters (see the NON_FILTER note in
 * lib/stub): a per-screen fixture is one user's data by construction, and honouring it
 * would send half the walks to onboarding. That is the right default, and it is exactly
 * what makes this bug invisible here — the probe finds the flat whoever it asks as. So
 * this one spec puts the filter back, for this one table. Without it the test passes
 * against the broken code, which is worse than having no test at all.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

/** Omer's household. Moran (the signed-in account, OWNER) belongs to it and owns nothing. */
const OMER = '00000000-0000-0000-0000-0000000000dd'

const base = {
  mortgages: [], mortgage_tracks: [], investment_costs: [], contracts: [], loans: [],
  insurance_policies: [], transactions: [], recurring_items: [], tasks: [],
  documents: [], push_subscriptions: [], household_invites: [],
}

async function boot(page: Page, fixture: Fixture) {
  await setTheme(page, 'light')
  await stubSupabase(page, fixture)
  // Registered after the shared stub, so it wins: Playwright runs the most recently
  // added matching route first.
  await page.route('**/rest/v1/properties**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const url = new URL(route.request().url())
    const raw = url.searchParams.get('owner_id')
    const wanted = raw?.startsWith('eq.') ? raw.slice(3).replace(/^"|"$/g, '') : null
    const rows = (fixture.properties ?? []) as Record<string, unknown>[]
    const out = wanted ? rows.filter(r => String(r.owner_id) === wanted) : rows
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(out),
    })
  })
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('onboarding_draft')) localStorage.removeItem(k)
    sessionStorage.clear()
  })
  await page.goto('/')
}

test('הצטרפה לדירה של מישהו אחר ⇒ נכנסת לדירה, לא לאשף', async ({ page }) => {
  await boot(page, {
    ...base,
    owners: [
      { id: OMER, name: 'עומר', email: 'omer@example.com' },
      { id: OWNER, name: 'מורן', email: 'view@test.local' },
    ],
    // She is a member of Omer's household and of nothing else. This is precisely the
    // state the app is in one reload after she accepts an invitation.
    household_members: [
      { household_id: OMER, user_id: OMER, role: 'member' },
      { household_id: OMER, user_id: OWNER, role: 'member' },
    ],
    properties: [{
      id: 'p-omer', owner_id: OMER, address: 'פסח חברוני 122', street: 'פסח חברוני 122',
      city: 'ירושלים', purchase_price: 2180000, purchase_date: '2025-01-01',
      key_delivery_date: '2025-01-01', rooms: 4,
    }],
  })

  // The whole question, in one assertion: she arrives in the apartment.
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await expect(page.locator('.onboarding-wrap'), 'not sent to build an apartment she already has')
    .toHaveCount(0)
  await expect(page.locator('.invofr'), 'and not offered an invitation she already accepted')
    .toHaveCount(0)
})

test('יש לה גם דירה ריקה משלה ⇒ נפתחת זו שיש בה דירה', async ({ page }) => {
  await boot(page, {
    ...base,
    owners: [
      { id: OMER, name: 'עומר', email: 'omer@example.com' },
      { id: OWNER, name: 'מורן', email: 'view@test.local' },
    ],
    // Signing up creates a household of your own, so after joining Omer's she belongs to
    // two: hers, which is empty, and his. Nothing is stored — a second device, or private
    // mode — so the default decides, and "prefer my own" would put her in front of the
    // wizard for an apartment she never wanted.
    household_members: [
      { household_id: OWNER, user_id: OWNER, role: 'member' },
      { household_id: OMER, user_id: OMER, role: 'member' },
      { household_id: OMER, user_id: OWNER, role: 'member' },
    ],
    properties: [{
      id: 'p-omer', owner_id: OMER, address: 'פסח חברוני 122', street: 'פסח חברוני 122',
      city: 'ירושלים', purchase_price: 2180000, purchase_date: '2025-01-01',
      key_delivery_date: '2025-01-01', rooms: 4,
    }],
  })

  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await expect(page.locator('.onboarding-wrap')).toHaveCount(0)
  // …and the chip proves it opened the right one, not merely that it opened something.
  await expect(page.locator('.hs-ctx-chip')).toContainText('פסח חברוני 122')
})

test('לא הצטרפה לשום דירה ⇒ האשף, כמו תמיד', async ({ page }) => {
  await boot(page, {
    ...base,
    owners: [{ id: OWNER, name: 'מורן', email: 'view@test.local' }],
    household_members: [{ household_id: OWNER, user_id: OWNER, role: 'member' }],
    properties: [],
  })
  // The other half: the fix must not let someone with genuinely no apartment past the
  // wizard, which is the one thing a "just wait for households" change could break.
  await page.locator('.onboarding-wrap').waitFor({ state: 'visible', timeout: 30_000 })
  await expect(page.locator('.bottom-nav')).toHaveCount(0)
})

test('קריאת החברויות נופלת ברשת ⇒ האפליקציה עדיין נפתחת', async ({ page }) => {
  // The fix makes the boot probe WAIT for the memberships, which is a new way to be
  // trapped on the splash for ever: supabase-js rejects (rather than returning `{ error }`)
  // on a network-level failure, and a rejection that escaped would mean the flag is never
  // set. The same shape as AUD-011, which cost an infinite splash once already.
  await setTheme(page, 'light')
  await stubSupabase(page, {
    ...base,
    owners: [{ id: OWNER, name: 'מורן', email: 'view@test.local' }],
    household_members: [{ household_id: OWNER, user_id: OWNER, role: 'member' }],
    properties: [{
      id: 'p-mine', owner_id: OWNER, address: 'הרצל 10', street: 'הרצל 10', city: 'תל אביב',
      purchase_price: 900000, purchase_date: '2025-01-01', key_delivery_date: '2025-01-01', rooms: 3,
    }],
  })
  // Registered last, so it wins: the memberships read fails at the network level.
  await page.route('**/rest/v1/household_members**', (route) => route.abort('failed'))
  await page.goto('/')

  // Falls back to the own-household case and carries on, rather than holding the splash.
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 25_000 })
  await expect(page.locator('.splash-overlay')).toHaveCount(0)
})
