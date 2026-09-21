import { test, expect, type Page } from '@playwright/test'
import { stubSupabase, type Fixture } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * Omer's notes 1 and 12, which turned out to be one thing.
 *
 * Note 1: "הייתי מוסיף (?) ליד כל מסמך ולהציג דוגמה שלו" — the documents step is the first
 * moment the app asks for something from the real world, and the names alone assume you can
 * already tell an אישור משכנתא from a מסמך הלוואה.
 *
 * Note 12: "הוספתי ביטוח אבל הוא לא זיהה אותו". Nothing is extracted from an insurance
 * policy — nor from a tabu extract — but the card said "1 קובץ הועלה" and stopped, which is
 * exactly what the reading cards say on their way to a green tick. A stated limit is not a
 * failure; a silence that looks like success is. That is the part fixable without touching
 * the extraction, and it is asserted here.
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

async function documentsStep(page: Page) {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('onboarding_draft')) localStorage.removeItem(k)
  })
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
  await page.locator('.btn-onboard-primary').last().click()
  await page.waitForTimeout(900)
  await page.locator('.onboarding-doc-cards').waitFor({ state: 'visible' })
}

test('הסבר קצר לכל סוג מסמך', async ({ page }) => {
  await documentsStep(page)
  await expect(page.locator('.onboarding-doc-example')).toHaveCount(0)

  await page.getByRole('button', { name: /מה כל מסמך/ }).click()
  await page.waitForTimeout(300)
  // One explanation per card, not one shared paragraph.
  const cards = await page.locator('.onboarding-doc-card').count()
  await expect(page.locator('.onboarding-doc-example')).toHaveCount(cards)
  await saveShot(page, 'docs', 'explanations', 'light')

  await page.getByRole('button', { name: /הסתר את ההסברים/ }).click()
  await page.waitForTimeout(250)
  await expect(page.locator('.onboarding-doc-example')).toHaveCount(0)
})

test('מה שלא נקרא אוטומטית — אומר את זה', async ({ page }) => {
  await documentsStep(page)

  // The two that are filed as-is say so; the ones that extract do not claim to be filed.
  const statusOf = (title: string) => page.evaluate((t) => {
    const card = Array.from(document.querySelectorAll('.onboarding-doc-card'))
      .find(c => c.querySelector('.onboarding-doc-card-title')?.textContent?.trim() === t)
    return card?.querySelector('.onboarding-doc-card-status')?.textContent ?? ''
  }, title)

  // Before anything is uploaded.
  expect(await statusOf('פוליסת ביטוח')).toContain('לתיק בלבד')
  expect(await statusOf('נסח טאבו')).toContain('לתיק בלבד')
  expect(await statusOf('חוזה רכישה'), 'this one IS read — it must not claim otherwise').not.toContain('לתיק בלבד')
  expect(await statusOf('אישור משכנתא')).not.toContain('לתיק בלבד')

  // And after — the moment that actually misled him, when he had uploaded the policy and
  // was waiting for it to be recognised. "1 קובץ הועלה" alone looked exactly like success.
  const card = page.locator('.onboarding-doc-card-wrap').filter({ hasText: 'פוליסת ביטוח' })
  await card.locator('input[type="file"]').setInputFiles({
    name: 'פוליסה.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 stub'),
  })
  await page.waitForTimeout(800)
  expect(await statusOf('פוליסת ביטוח'), 'after the upload it must not read as a success')
    .toContain('לא נקרא אוטומטית')
})
