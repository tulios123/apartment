import { test, expect, type Page } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { owner } from './lib/owner'

/**
 * The things an owner actually does — and that nobody has ever photographed.
 *
 * Every walk so far has READ the app: open it, look, judge. But the owner's weekly life is
 * two gestures — log an expense, tick a task — and both live behind a sheet that no spec
 * has ever opened. A screen you only ever read is a screen half-tested: the numpad, the
 * category guess, the discard guard and the task follow-up are all first-minute surfaces
 * for a family member, and all of them are unseen.
 *
 * The fixture is the let flat from PASS 2 (rent 4,000 against a ~4,600 mortgage), so an
 * expense lands in a month that already has real and forecast money in it.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

async function home(page: Page, theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, owner())
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__da')) return
    sessionStorage.setItem('__da', '1')
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('onboarding_draft') || k.startsWith('purchase_plan:')) localStorage.removeItem(k)
    }
  })
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(900)
}

async function noGarbage(page: Page, where: string) {
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  for (const bad of ['NaN', 'Infinity', 'undefined', 'null', '[object']) {
    expect(text, `${where}: "${bad}" reached the screen`).not.toContain(bad)
  }
}

/** Tap digits on the sheet's own numpad — there is no text input to fill. */
async function keyIn(page: Page, digits: string) {
  for (const ch of digits) {
    await page.locator('.numpad .numkey', { hasText: new RegExp(`^${ch}$`) }).first().click()
    await page.waitForTimeout(90)
  }
}

test('יומיומי · רישום הוצאה של ₪350', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: /הוצאה/ }).first().click()
  await page.waitForTimeout(700)
  await saveShot(page, 'daily', '01-expense-step1', 'light')

  await keyIn(page, '350')
  await page.waitForTimeout(300)
  await saveShot(page, 'daily', '02-expense-amount', 'light')

  // Step 2 — context, category, date. The category is guessed from the description, so
  // type something a real person would type and see what it guesses.
  await page.locator('.cap-save').first().click()
  await page.waitForTimeout(700)
  await saveShot(page, 'daily', '03-expense-step2-empty', 'light')

  // By placeholder, and asserted — an `if (await count())` here silently skipped the most
  // interesting moment in this flow on the first run.
  const desc = page.getByPlaceholder('על מה? (למשל: תיקון ברז)')
  await expect(desc, 'the description box is where the category guess comes from').toBeVisible()
  await desc.fill('תיקון נזילה במטבח')
  await page.waitForTimeout(900)
  await saveShot(page, 'daily', '04-expense-guessed-category', 'light')

  // The guess is the feature: "תיקון" should move the category off אחר by itself.
  const chosen = await page.locator('.cap-chip.on, .cap-chip.active, [class*="chip"][class*="on"]').first()
    .textContent().catch(() => null)
  console.log(`\n=== קטגוריה שנבחרה אוטומטית: ${chosen ?? '(לא זוהתה)'} ===\n`)
  await noGarbage(page, 'expense sheet')
})

test('יומיומי · שמירה על מה שהוקלד — שומר-הנטישה', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: /הוצאה/ }).first().click()
  await page.waitForTimeout(600)
  await keyIn(page, '350')
  await page.waitForTimeout(250)

  // Half-typed, then a tap outside. Losing it silently is the worst possible outcome for
  // someone standing in a hardware shop; a confirm is the promise the project made.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await saveShot(page, 'daily', '10-discard-guard', 'light')
})

test('יומיומי · סימון משימה כבוצעה, ומה שקורה אחריה', async ({ page }) => {
  await home(page)
  await page.goto('/property/tasks')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(1200)
  await saveShot(page, 'daily', '20-tasks-before', 'light')

  // The open one is a maintenance task — completing it should offer to log the money.
  const tick = page.getByRole('button', { name: 'סימון כהושלם' }).first()
  await expect(tick, 'the open task should be tickable').toBeVisible()
  await tick.click()
  await page.waitForTimeout(1100)
  await saveShot(page, 'daily', '21-task-done-followup', 'light')
  await noGarbage(page, 'tasks after complete')
})

test('יומיומי · הוספת משימה', async ({ page }) => {
  await home(page)
  await page.getByRole('button', { name: /משימה/ }).first().click()
  await page.waitForTimeout(800)
  await saveShot(page, 'daily', '30-task-sheet', 'light')
  await noGarbage(page, 'task sheet')
})

test('יומיומי · כהה', async ({ page }) => {
  await home(page, 'dark')
  await page.getByRole('button', { name: /הוצאה/ }).first().click()
  await page.waitForTimeout(700)
  await keyIn(page, '350')
  await page.waitForTimeout(300)
  await saveShot(page, 'daily', '02-expense-amount', 'dark')
})
