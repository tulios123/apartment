import { test, expect, type Page } from '@playwright/test'
import { resetAccount, saveShot, setTheme, clearOnboardingDraft } from './lib/helpers'
import { layoutIntegrity } from './lib/layout'
import { attachConsoleMonitor } from './lib/monitors'
// Node-side DB assertions, RLS-scoped to the test account. Runs in a child process
// (scripts/audit/count-rows.mjs) because importing the supabase ESM graph inside
// Playwright's TS loader crashes it ("Unexpected module status 3").
import { execFileSync } from 'node:child_process'
function dbRows(...tables: string[]): Record<string, any[]> {
  const stdout = execFileSync('node', ['scripts/audit/count-rows.mjs', ...tables], { encoding: 'utf8' })
  const last = stdout.trim().split('\n').pop() ?? '{}'
  return JSON.parse(last)
}

async function startWizard(page: Page) {
  await clearOnboardingDraft(page)
  await page.goto('/')
  // Self-cleaning: a previous failed test may have left the account with data —
  // if we land in the app instead of onboarding, reset first.
  const shell = page.locator('.onboarding-wrap, .bottom-nav')
  await shell.first().waitFor({ state: 'visible', timeout: 30_000 })
  if (await page.locator('.bottom-nav').isVisible()) await resetAccount(page)
  await page.locator('.onboarding-wrap').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByRole('button', { name: 'מתחילים' }).click()
  await expect(page.getByRole('heading', { name: 'המסמכים שלך' })).toBeVisible()
  await page.getByRole('button', { name: /^המשך/ }).click()
  await expect(page.getByRole('heading', { name: 'פרטי רכישה' })).toBeVisible()
}

async function fillPurchaseMinimal(page: Page) {
  await page.getByPlaceholder('שם מלא').fill('ישראל ישראלי [E2E]')
  await page.getByPlaceholder('רחוב ומספר').fill('הרצל 10')
  await page.getByPlaceholder('עיר').fill('תל אביב')
  await page.locator('.onboarding-field:has-text("מחיר רכישה") input').fill('2500000')
  await page.getByRole('button', { name: 'המשך', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'משכנתא' })).toBeVisible()
}

// ── AUD-001 (baseline R1/R2): the finish-early path must apply the SAME completeness
// gate as the step's own המשך. Today it doesn't — an open track/loan form with only a
// principal is folded into the save with fabricated rate/term (tracks: 5%/360mo,
// useOnboardingState normTrack) or 0% rate (loans). This test asserts the CORRECT
// behavior and is EXPECTED TO FAIL before the fix (evidence: fails-before/passes-after).
test('finish-early with an incomplete open track/loan form must not silently write fabricated values', async ({ page }) => {
  test.setTimeout(240_000)
  await startWizard(page)
  await fillPurchaseMinimal(page)

  // The track form is auto-open on entry. Type ONLY a principal — leave term blank,
  // so the track is incomplete per the step gate (rate defaults to 5, term required).
  await page.locator('.onboarding-field:has-text("קרן") input').first().fill('600000')

  // Baseline sanity: the step's own המשך correctly raises the completeness dialog
  await page.getByRole('button', { name: 'המשך', exact: true }).click()
  await expect(page.getByText('חסרים פרטים במסלול')).toBeVisible()
  await saveShot(page, 'onboarding-mortgage', 'incomplete-dialog-on-advance', 'light')
  await page.getByRole('button', { name: 'חזרה להשלמה' }).click()

  // The bug: סיימו עכשיו with the same incomplete form must raise the same dialog
  await page.getByRole('button', { name: /סיימו עכשיו/ }).click()
  await expect(page.getByText('חסרים פרטים במסלול')).toBeVisible({ timeout: 5_000 })
  await saveShot(page, 'onboarding-mortgage', 'incomplete-dialog-on-finish-early', 'light')
  await page.getByRole('button', { name: 'המשך בלי לשמור' }).click()

  // Finishing continues (property gets created), but NO fabricated track may be written
  await expect(page.getByRole('heading', { name: 'הכול מוכן!' })).toBeVisible({ timeout: 30_000 })
  const rows = dbRows('mortgage_tracks')
  expect(rows.mortgage_tracks, 'no fabricated track may be written').toHaveLength(0)

  await page.getByRole('button', { name: /כניסה לאפליקציה/ }).click()
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
  await resetAccount(page)
})

// ── Untouched auto-open mortgage form must NOT block finishing (skips silently, no fabrication).
test('finish-early with an untouched mortgage form skips it silently (no dialog, no track)', async ({ page }) => {
  test.setTimeout(240_000)
  await startWizard(page)
  await fillPurchaseMinimal(page)
  // Mortgage form is auto-open but untouched — tap סיימו עכשיו straight away.
  await page.getByRole('button', { name: /סיימו עכשיו/ }).click()
  // No completeness dialog — finishing proceeds directly.
  await expect(page.getByRole('heading', { name: 'הכול מוכן!' })).toBeVisible({ timeout: 30_000 })
  const rows = dbRows('mortgage_tracks')
  expect(rows.mortgage_tracks, 'untouched form must not fabricate a track').toHaveLength(0)
  await page.getByRole('button', { name: /כניסה לאפליקציה/ }).click()
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
  await resetAccount(page)
})

// ── Finish-early mid-way (legit partial data): hubs must render sanely.
test('finish-early at investment step → all hubs render sanely with partial data', async ({ page }) => {
  test.setTimeout(240_000)
  const consoleHits = attachConsoleMonitor(page)
  await startWizard(page)
  await fillPurchaseMinimal(page)

  // Complete track in the auto-open form, properly saved
  await page.locator('.onboarding-field:has-text("קרן") input').first().fill('600000')
  await page.locator('.onboarding-field:has-text("ריבית שנתית") input').first().fill('5')
  await page.locator('.onboarding-field:has-text("תקופה (חודשים)") input').first().fill('360')
  await page.getByRole('button', { name: 'שמור מסלול' }).click()
  await page.getByRole('button', { name: 'המשך', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'הלוואות' })).toBeVisible()
  await page.getByRole('button', { name: 'המשך', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'הון עצמי ועלויות' })).toBeVisible()

  await page.getByRole('button', { name: /סיימו עכשיו/ }).click()
  await expect(page.getByRole('heading', { name: 'הכול מוכן!' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /כניסה לאפליקציה/ }).click()
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })

  // Every hub with partial data: renders, no NaN, no layout break, archive evidence
  for (const [route, name] of [['/', 'home'], ['/finances', 'finances'], ['/wealth', 'wealth'], ['/property', 'property']] as const) {
    await page.goto(route)
    await page.locator('.bottom-nav').waitFor({ state: 'visible' })
    await page.waitForTimeout(1200)
    await expect(page.locator('.error-boundary')).toHaveCount(0)
    const body = await page.locator('body').innerText()
    expect(body).not.toContain('NaN')
    const violations = await layoutIntegrity(page)
    console.log(`partial-data ${name} violations:`, JSON.stringify(violations))
    await saveShot(page, name, 'partial-data', 'light')
  }
  console.log('partial-data console hits:', JSON.stringify(consoleHits))
  await resetAccount(page)
})

// ── Full 9-step walk, back-chevron at each step, values preserved; creates the base dataset.
test('full onboarding walk with back at each step → complete base dataset', async ({ page }) => {
  test.setTimeout(240_000)
  await setTheme(page, 'light')
  await startWizard(page)

  // purchase (full, incl. back-test to documents and forward again)
  await page.getByPlaceholder('שם מלא').fill('ישראל ישראלי [E2E]')
  await page.getByPlaceholder('רחוב ומספר').fill('הרצל 10')
  await page.getByPlaceholder('עיר').fill('אשקלון')
  await page.locator('.onboarding-field:has-text("שטח") input').fill('90')
  await page.locator('.onboarding-field:has-text("קומה") input').fill('3')
  await page.locator('.onboarding-field:has-text("מספר חדרים") input').fill('4')
  await page.locator('.onboarding-field:has-text("מחיר רכישה") input').fill('1090000')
  await saveShot(page, 'onboarding-purchase', 'filled', 'light')
  await page.getByRole('button', { name: 'חזור' }).click()
  await expect(page.getByRole('heading', { name: 'המסמכים שלך' })).toBeVisible()
  await page.getByRole('button', { name: /^המשך/ }).click()
  await expect(page.getByPlaceholder('שם מלא')).toHaveValue('ישראל ישראלי [E2E]') // draft preserved
  await page.getByRole('button', { name: 'המשך', exact: true }).click()

  // mortgage: full track in the auto-open form + back-test
  await expect(page.getByRole('heading', { name: 'משכנתא' })).toBeVisible()
  await page.locator('.onboarding-field:has-text("קרן") input').first().fill('875975')
  await page.locator('.onboarding-field:has-text("ריבית שנתית") input').first().fill('4.8')
  await page.locator('.onboarding-field:has-text("תקופה (חודשים)") input').first().fill('300')
  await page.getByRole('button', { name: 'שמור מסלול' }).click()
  await saveShot(page, 'onboarding-mortgage', 'track-saved', 'light')
  await page.getByRole('button', { name: 'חזור' }).click()
  await expect(page.getByRole('heading', { name: 'פרטי רכישה' })).toBeVisible()
  await page.getByRole('button', { name: 'המשך', exact: true }).click()
  await expect(page.getByText('875,975').first()).toBeVisible() // track preserved
  await page.getByRole('button', { name: 'המשך', exact: true }).click()

  // loans: one monthly loan in the auto-open form + back-test
  await expect(page.getByRole('heading', { name: 'הלוואות' })).toBeVisible()
  await page.getByPlaceholder('הלוואה משלימה').fill('הלוואה משלימה [E2E]')
  await page.locator('.onboarding-field:has-text("סכום ההלוואה") input').fill('120000')
  await page.locator('.onboarding-field:has-text("ריבית שנתית") input').first().fill('6')
  await page.locator('.onboarding-field:has-text("תקופה (חודשים)") input').first().fill('60')
  await page.getByRole('button', { name: 'שמור הלוואה' }).click()
  await page.getByRole('button', { name: 'חזור' }).click()
  await expect(page.getByRole('heading', { name: 'משכנתא' })).toBeVisible()
  await page.getByRole('button', { name: 'המשך', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'הלוואות' })).toBeVisible()
  await page.getByRole('button', { name: 'המשך', exact: true }).click()

  // investment: defaults + back-test
  await expect(page.getByRole('heading', { name: 'הון עצמי ועלויות' })).toBeVisible()
  await saveShot(page, 'onboarding-investment', 'defaults', 'light')
  await page.getByRole('button', { name: 'חזור' }).click()
  await expect(page.getByRole('heading', { name: 'הלוואות' })).toBeVisible()
  await page.getByRole('button', { name: 'המשך', exact: true }).click()
  await page.getByRole('button', { name: 'המשך', exact: true }).click()

  // rental: full contract (start date via calendar; end auto-fills +1y) + back-test
  await expect(page.getByRole('heading', { name: 'פרטי השכירות' })).toBeVisible()
  await page.getByPlaceholder('שם החברה או השוכר').fill('שוכר לדוגמה [E2E]')
  await page.getByRole('button', { name: 'תאריך התחלה' }).click()
  await page.locator('button.calpop-day').filter({ hasText: /^15$/ }).first().click()
  // Close the calendar popover if it stays open after picking a day
  const calClose = page.locator('.calpop-close-btn')
  if (await calClose.isVisible().catch(() => false)) await calClose.click()
  await page.locator('.onboarding-field:has-text("שכר דירה חודשי") input').fill('4300')
  await page.getByRole('button', { name: 'העברה בנקאית' }).click()
  await page.locator('.onboarding-field:has-text("יום תשלום") input').fill('1')
  await saveShot(page, 'onboarding-rental', 'filled', 'light')
  await page.getByRole('button', { name: 'חזור' }).click()
  await expect(page.getByRole('heading', { name: 'הון עצמי ועלויות' })).toBeVisible()
  await page.getByRole('button', { name: 'המשך', exact: true }).click()
  await expect(page.getByPlaceholder('שם החברה או השוכר')).toHaveValue('שוכר לדוגמה [E2E]')
  await page.getByRole('button', { name: 'המשך', exact: true }).click()

  // insurance: one policy in the auto-open form, then finish
  await expect(page.getByRole('heading', { name: 'ביטוחים' })).toBeVisible()
  await page.locator('.onboarding-field:has-text("חברת ביטוח") input').fill('הראל [E2E]')
  await page.locator('.onboarding-field:has-text("פרמיה") input').fill('74')
  await page.getByRole('button', { name: 'שמור פוליסה' }).click()
  await page.getByRole('button', { name: 'חזור' }).click()
  await expect(page.getByRole('heading', { name: 'פרטי השכירות' })).toBeVisible()
  await page.getByRole('button', { name: 'המשך', exact: true }).click()
  await saveShot(page, 'onboarding-insurance', 'policy-saved', 'light')
  await page.getByRole('button', { name: /סיום/ }).click()

  await expect(page.getByRole('heading', { name: 'הכול מוכן!' })).toBeVisible({ timeout: 30_000 })
  await saveShot(page, 'onboarding-done', 'summary', 'light')
  await page.getByRole('button', { name: /כניסה לאפליקציה/ }).click()
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })

  // DB: exactly one of each entity, no duplicates from the back/forward dance
  const rows = dbRows('properties', 'contracts', 'mortgage_tracks', 'loans', 'insurance_policies')
  for (const [table, expected] of [['properties', 1], ['contracts', 1], ['mortgage_tracks', 1], ['loans', 1], ['insurance_policies', 1]] as const) {
    expect(rows[table], `${table} rows`).toHaveLength(expected)
  }

  // Empty states before seed: finances empty month(-ish), tasks empty, documents empty
  await page.goto('/property/tasks')
  await page.waitForTimeout(1000)
  await saveShot(page, 'tasks', 'empty', 'light')
  await page.goto('/property/documents')
  await page.waitForTimeout(1000)
  await saveShot(page, 'documents', 'empty', 'light')
  await page.goto('/finances')
  await page.waitForTimeout(1200)
  await saveShot(page, 'finances', 'fresh-account', 'light')
  await page.goto('/')
  await page.waitForTimeout(1200)
  await saveShot(page, 'home', 'fresh-account', 'light')
})
