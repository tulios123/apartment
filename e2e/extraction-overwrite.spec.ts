import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * Omer's sequence, exactly: type it, then upload.
 *
 * He filled the signing and handover dates by hand, then uploaded the purchase contract,
 * and both were silently replaced by whatever the extraction read. He did not find out
 * from the wizard — he found out later, from a date that looked wrong on another screen.
 * Those two dates anchor every statutory deadline in the payment plan and decide the
 * app's entire stage, so a silent overwrite there is not one field.
 *
 * In dev the extraction is mocked (DEV_MOCK.contract), which is what makes this walkable
 * offline: the mock returns a full set of values, so every hand-typed field is a genuine
 * collision.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const empty: Fixture = {
  owners: [{ id: OWNER, name: 'עומר' }],
  properties: [], mortgages: [], mortgage_tracks: [], investment_costs: [],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}

async function purchaseStep(page: Page) {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('onboarding_draft') || k.startsWith('apt_extract_')) localStorage.removeItem(k)
    }
  })
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
  for (let i = 0; i < 2; i++) {            // welcome → documents → purchase
    await page.locator('.btn-onboard-primary').last().click()
    await page.waitForTimeout(650)
  }
}

/** Any file will do — in dev the extraction never reads it. */
async function uploadContract(page: Page) {
  await page.locator('.onboarding-ai-fill input[type="file"]').first().setInputFiles({
    name: 'הסכם מכר חתום.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 stub'),
  })
  await page.waitForTimeout(2500)
}

test('חילוץ לא דורס מה שהוקלד ביד', async ({ page }) => {
  await purchaseStep(page)

  // What he typed. Every one of these collides with the mock, which returns
  // "ישראל ישראלי (דמו)" / הרצל 10 / תל אביב / 2,500,000.
  await page.getByLabel('שם הרוכש').fill('עומר שובי')
  await page.getByLabel('רחוב').fill('פסח חברוני 122')
  await page.getByLabel('עיר').fill('ירושלים')
  await page.getByLabel('מחיר רכישה (₪)').fill('2180000')
  await page.waitForTimeout(300)
  await saveShot(page, 'overwrite', '01-typed-by-hand', 'light')

  await uploadContract(page)
  await saveShot(page, 'overwrite', '02-after-upload', 'light')

  // The whole point: his values survive.
  await expect(page.getByLabel('שם הרוכש')).toHaveValue('עומר שובי')
  await expect(page.getByLabel('רחוב')).toHaveValue('פסח חברוני 122')
  await expect(page.getByLabel('עיר')).toHaveValue('ירושלים')
  await expect(page.getByLabel('מחיר רכישה (₪)')).toHaveValue('2,180,000')

  // And the disagreement is named rather than swallowed.
  await expect(
    page.getByText(/שמרנו את מה שמילאת/),
    'a kept value must be announced — silently keeping is still a silent decision',
  ).toBeVisible()
})

test('חילוץ כן ממלא שדות ריקים', async ({ page }) => {
  await purchaseStep(page)

  // Only the price, by hand. Everything else is blank and should be filled for him —
  // the feature still has to work; it just may not overwrite.
  await page.getByLabel('מחיר רכישה (₪)').fill('2180000')
  await uploadContract(page)
  await saveShot(page, 'overwrite', '03-blanks-filled', 'light')

  await expect(page.getByLabel('מחיר רכישה (₪)')).toHaveValue('2,180,000')
  await expect(page.getByLabel('שם הרוכש'), 'a blank field is still filled from the document').not.toHaveValue('')
  await expect(page.getByLabel('עיר')).not.toHaveValue('')
})
