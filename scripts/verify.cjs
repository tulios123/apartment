/**
 * UI verification script — runs headless against localhost:5173
 * Requires: VITE_DEV_BYPASS_AUTH=true in .env.local
 * Usage:    node scripts/verify.cjs [--reset]
 */
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const RESET = process.argv.includes('--reset')
const SS_DIR = path.join(__dirname, '../.verify-screenshots')
fs.mkdirSync(SS_DIR, { recursive: true })

let stepIdx = 0
async function step(page, label) {
  const file = path.join(SS_DIR, `${String(stepIdx++).padStart(2, '0')}_${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`  ${stepIdx - 1}. ${label}`)
  return file
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(15000)

  console.log('\n── Connecting to http://localhost:5173 ──')
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(2500)
  await step(page, 'loaded')

  // ── Optionally reset data ──
  if (RESET) {
    console.log('\n── Resetting data ──')
    await page.goto('http://localhost:5173/settings')
    // Wait for settings content to load (auth takes a moment)
    await page.waitForSelector('.settings-section', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(500)
    await step(page, 'settings')

    const resetBtn = page.locator('button').filter({ hasText: /איפוס כל הנתונים/i })
    if (await resetBtn.count()) {
      await resetBtn.click()
      await page.waitForTimeout(400)
      await step(page, 'reset_confirm_dialog')
      await page.locator('button').filter({ hasText: /מחק הכל/i }).click()
      await page.waitForTimeout(3000)
      await step(page, 'after_reset')
      console.log('  ✓ Data reset')
    } else {
      console.log('  ⚠ Reset button not found on /settings')
    }
  }

  // ── Onboarding: Welcome ──
  console.log('\n── Onboarding ──')
  await page.waitForTimeout(1000)
  const heading = await page.locator('h1,h2').first().textContent().catch(() => '')
  console.log(`  heading: "${heading}"`)
  await step(page, 'welcome')

  const startBtn = page.locator('button').filter({ hasText: /התחל/i })
  if (!(await startBtn.count())) {
    console.log('  ✗ No welcome screen — already has data or wrong state')
    await browser.close()
    process.exit(1)
  }
  await startBtn.click()
  await page.waitForTimeout(500)
  await step(page, 'purchase_step')

  // ── Onboarding: Purchase ──
  console.log('\n── Purchase step ──')
  await page.locator('button').filter({ hasText: /מלא דוגמה/i }).first().click()
  await page.waitForTimeout(400)
  await step(page, 'purchase_filled')

  // Verify key fields filled
  const buyerVal = await page.locator('input[placeholder*="שם מלא"]').inputValue().catch(() => '')
  const priceVal = await page.locator('input[inputmode="numeric"]').inputValue().catch(() => '')
  console.log(`  buyer: "${buyerVal}"  price: "${priceVal}"`)
  if (!buyerVal) { console.log('  ⚠ buyer name not filled'); }

  await page.locator('button[type="submit"]').filter({ hasText: /הבא/i }).click()
  await page.waitForTimeout(500)
  await step(page, 'rental_step')

  // ── Onboarding: Rental ──
  console.log('\n── Rental step ──')
  await page.locator('button').filter({ hasText: /מלא דוגמה/i }).first().click()
  await page.waitForTimeout(400)
  await step(page, 'rental_filled')
  const companyVal = await page.locator('input[placeholder*="שם החברה"]').inputValue().catch(() => '')
  console.log(`  company: "${companyVal}"`)
  await page.locator('button[type="submit"]').filter({ hasText: /הבא/i }).click()
  await page.waitForTimeout(500)
  await step(page, 'mortgage_step')

  // ── Onboarding: Mortgage ──
  console.log('\n── Mortgage step ──')
  await page.locator('button').filter({ hasText: /מלא דוגמה/i }).first().click()
  await page.waitForTimeout(400)
  await step(page, 'mortgage_filled')
  const mortgageVal = await page.locator('input[placeholder="0"][type="number"]').first().inputValue().catch(() => '')
  console.log(`  mortgage amount: "${mortgageVal}"`)
  await page.locator('button[type="submit"]').filter({ hasText: /הבא/i }).click()
  await page.waitForTimeout(500)
  await step(page, 'insurance_step')

  // ── Onboarding: Insurance ──
  console.log('\n── Insurance step ──')
  await page.locator('button').filter({ hasText: /מלא דוגמה/i }).first().click()
  await page.waitForTimeout(400)
  await step(page, 'insurance_filled')
  const insuranceVal = await page.locator('input[placeholder="0"][type="number"]').first().inputValue().catch(() => '')
  console.log(`  insurance amount: "${insuranceVal}"`)
  await page.locator('button[type="submit"]').filter({ hasText: /הבא/i }).click()
  await page.waitForTimeout(500)
  await step(page, 'recurring_step')

  // ── Onboarding: Recurring ──
  console.log('\n── Recurring step ──')
  const items = page.locator('.onboarding-recurring-item')
  const itemCount = await items.count()
  console.log(`  items: ${itemCount}`)
  if (itemCount > 0) {
    await items.first().click()
    await page.waitForTimeout(200)
    await items.first().locator('input[type="number"]').fill('800')
    await page.waitForTimeout(200)
  }
  await step(page, 'recurring_filled')

  await page.locator('button[type="submit"]').filter({ hasText: /סיום/i }).click()
  await page.waitForTimeout(5000)
  await step(page, 'done_screen')

  const doneH = await page.locator('h2').first().textContent().catch(() => '')
  console.log(`  done heading: "${doneH}"`)
  const pass = doneH.includes('מוכן') || doneH.includes('הכל')
  console.log(pass ? '  ✓ Onboarding complete' : '  ✗ Unexpected done screen')

  // ── Go to dashboard ──
  const homeBtn = page.locator('button').filter({ hasText: /למסך הראשי/i })
  if (await homeBtn.count()) {
    await homeBtn.click()
    await page.waitForTimeout(1500)
    await step(page, 'dashboard')
    const dashHeading = await page.locator('h1').first().textContent().catch(() => '')
    console.log(`  dashboard heading: "${dashHeading}"`)
  }

  await browser.close()
  console.log(`\n── Screenshots saved to ${SS_DIR} ──`)
  console.log(pass ? '\nRESULT: PASS ✓' : '\nRESULT: FAIL ✗')
  process.exit(pass ? 0 : 1)
})().catch(e => {
  console.error('\nSCRIPT ERROR:', e.message)
  process.exit(1)
})
