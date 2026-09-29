import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * "באיזו דירה אני, ובאילו תנאים" — on Home (owner, 29.09).
 *
 * The rule being tested is as much about what is NOT shown: almost everybody has one
 * apartment and full access, and for them this strip must not exist at all. A context
 * control that appears for everyone is clutter that teaches the app is more complicated
 * than it is.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const FLAT2 = '00000000-0000-0000-0000-0000000000cc'

const base = {
  mortgages: [], mortgage_tracks: [], investment_costs: [], contracts: [], loans: [],
  insurance_policies: [], transactions: [], recurring_items: [], tasks: [],
  documents: [], push_subscriptions: [], household_invites: [],
}

const flat = (id: string, address: string) => ({
  id: `p-${id}`, owner_id: id, address, street: address, city: 'ירושלים',
  purchase_price: 2180000, purchase_date: '2025-01-01', key_delivery_date: '2025-01-01', rooms: 4,
})

async function home(page: Page, fixture: Fixture) {
  await setTheme(page, 'light')
  await stubSupabase(page, fixture)
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {})
  await page.waitForTimeout(600)
}

test('דירה אחת וגישה מלאה ⇒ אין רצועה בכלל', async ({ page }) => {
  await home(page, {
    ...base,
    owners: [{ id: OWNER, name: 'עומר', email: 'omer@example.com' }],
    household_members: [{ household_id: OWNER, user_id: OWNER, role: 'member' }],
    properties: [flat(OWNER, 'פסח חברוני 122')],
  })
  // The case that covers almost everybody, almost always.
  await expect(page.locator('.hs-ctx')).toHaveCount(0)
})

test('שתי דירות ⇒ רואים באיזו אני, ואפשר לעבור', async ({ page }) => {
  await home(page, {
    ...base,
    owners: [
      { id: OWNER, name: 'עומר', email: 'omer@example.com' },
      { id: FLAT2, name: 'הדירה השנייה', email: null },
    ],
    household_members: [
      { household_id: OWNER, user_id: OWNER, role: 'member' },
      { household_id: FLAT2, user_id: OWNER, role: 'member' },
    ],
    properties: [flat(OWNER, 'פסח חברוני 122'), flat(FLAT2, 'הרצל 10')],
  })

  const chip = page.locator('.hs-ctx-chip')
  await expect(chip).toContainText('פסח חברוני 122')
  await saveShot(page, 'home-ctx', '01-two-flats', 'light')

  // It must stay small — the point of putting it on Home was that it is context, not news.
  const box = (await chip.boundingBox())!
  expect(box.height, 'a chip, not a banner').toBeLessThan(40)
  expect(box.width, 'and not the full width of the screen').toBeLessThan(page.viewportSize()!.width * 0.75)

  await chip.click()
  await page.waitForTimeout(350)
  await expect(page.locator('.hs-switch-dlg')).toBeVisible()
  await saveShot(page, 'home-ctx', '02-switch-dialog', 'light')

  // The dialog's own styling first shipped inside home-screen.css, which is scoped to
  // `.hs` — and a Modal renders through a portal on <body>, outside it. Nothing failed:
  // the build was clean and the rows were all there, with the title clipped against the
  // card edge. So the guard is containment, which is what was actually broken.
  const card = (await page.locator('.modal.is-dialog').boundingBox())!
  const heading = (await page.locator('.hs-switch-dlg h2').boundingBox())!
  expect(heading.x, 'the title starts inside the card').toBeGreaterThanOrEqual(card.x)
  expect(heading.x + heading.width, 'and ends inside it').toBeLessThanOrEqual(card.x + card.width)
  const row = (await page.locator('.hh-switch-row').first().boundingBox())!
  expect(row.x, 'the rows are not flush to the card edge').toBeGreaterThan(card.x + 6)

  await page.locator('.hh-switch-row').filter({ hasText: 'הרצל 10' }).click()
  await page.waitForTimeout(900)
  // Switching is the whole point of the control: the chip must now name the other one.
  await expect(page.locator('.hs-ctx-chip')).toContainText('הרצל 10')
})

test('צופה בלבד ⇒ מסומן, וקטן', async ({ page }) => {
  await home(page, {
    ...base,
    owners: [{ id: OWNER, name: 'עומר', email: 'omer@example.com' }],
    household_members: [{ household_id: OWNER, user_id: OWNER, role: 'viewer' }],
    properties: [flat(OWNER, 'פסח חברוני 122')],
  })

  const pill = page.locator('.hs-ctx-view')
  await expect(pill).toContainText('צפייה בלבד')
  await saveShot(page, 'home-ctx', '03-viewer', 'light')

  // "פשוט וברור אבל לא גדול" — asserted as size, because that was the requirement.
  const box = (await pill.boundingBox())!
  expect(box.height).toBeLessThan(30)
  expect(box.width).toBeLessThan(140)

  // With one apartment there is nothing to switch between, so no switcher beside it.
  await expect(page.locator('.hs-ctx-chip')).toHaveCount(0)
})
