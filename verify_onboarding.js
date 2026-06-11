const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const ss = (name) => page.screenshot({ path: `/tmp/pw-screenshots/${name}.png`, fullPage: false });

  // ── Step 0: Load app
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  await ss('00_loaded');
  console.log('00: app loaded');

  // ── Step 1: Navigate to Settings and reset
  // Look for settings nav link
  const settingsLink = page.locator('a[href*="settings"], nav a').filter({ hasText: /הגדרות|settings/i }).first();
  if (await settingsLink.count()) {
    await settingsLink.click();
    await page.waitForTimeout(800);
    await ss('01_settings');
    console.log('01: settings page');

    const resetBtn = page.locator('button').filter({ hasText: /איפוס כל הנתונים/i });
    if (await resetBtn.count()) {
      await resetBtn.click();
      await page.waitForTimeout(400);
      // Confirm dialog
      const confirmBtn = page.locator('button').filter({ hasText: /מחק הכל/i });
      if (await confirmBtn.count()) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
        await ss('02_after_reset');
        console.log('02: data reset done');
      } else {
        console.log('02: no confirm button found');
        await ss('02_no_confirm');
      }
    } else {
      console.log('01: reset button not found on settings');
      await ss('01_settings_detail');
    }
  } else {
    console.log('01: settings link not found - checking current state');
    await ss('01_no_settings');
  }

  // ── Step 2: Should now see onboarding welcome
  await page.waitForTimeout(1000);
  await ss('03_onboarding_welcome');
  const welcomeTitle = await page.locator('h1, h2').first().textContent().catch(() => '');
  console.log('03: page title =', welcomeTitle);

  // Click "התחל"
  const startBtn = page.locator('button').filter({ hasText: /התחל/i });
  if (await startBtn.count()) {
    await startBtn.click();
    await page.waitForTimeout(500);
    await ss('04_purchase_step');
    console.log('04: purchase step');
  } else {
    console.log('03: no start button, current content:');
    const body = await page.locator('body').textContent();
    console.log(body?.slice(0, 300));
  }

  // ── Step 3: Purchase — click "מלא דוגמה"
  const fillPurchaseBtn = page.locator('button').filter({ hasText: /מלא דוגמה/i });
  if (await fillPurchaseBtn.count()) {
    await fillPurchaseBtn.click();
    await page.waitForTimeout(400);
    await ss('05_purchase_filled');
    console.log('05: purchase test data filled');
  } else {
    console.log('05: fill button not found');
    await ss('05_no_fill_btn');
  }

  // Click "הבא"
  const nextBtn1 = page.locator('button[type="submit"]').filter({ hasText: /הבא/i });
  if (await nextBtn1.count()) {
    await nextBtn1.click();
    await page.waitForTimeout(500);
    await ss('06_rental_step');
    console.log('06: rental step');
  }

  // ── Step 4: Rental — click "מלא דוגמה"
  const fillRentalBtn = page.locator('button').filter({ hasText: /מלא דוגמה/i });
  if (await fillRentalBtn.count()) {
    await fillRentalBtn.click();
    await page.waitForTimeout(400);
    await ss('07_rental_filled');
    console.log('07: rental test data filled');
  }

  // Click "הבא"
  const nextBtn2 = page.locator('button[type="submit"]').filter({ hasText: /הבא/i });
  if (await nextBtn2.count()) {
    await nextBtn2.click();
    await page.waitForTimeout(500);
    await ss('08_recurring_step');
    console.log('08: recurring step');
  }

  // ── Step 5: Recurring — click first item to enable it
  const firstItem = page.locator('.onboarding-recurring-item').first();
  if (await firstItem.count()) {
    await firstItem.click();
    await page.waitForTimeout(200);
    // Fill amount
    const amtInput = firstItem.locator('input[type="number"]');
    await amtInput.fill('1800');
    await page.waitForTimeout(200);
    await ss('09_recurring_filled');
    console.log('09: recurring item enabled');
  }

  // Click "סיום"
  const finishBtn = page.locator('button[type="submit"]').filter({ hasText: /סיום/i });
  if (await finishBtn.count()) {
    await finishBtn.click();
    await page.waitForTimeout(3000);
    await ss('10_after_finish');
    const doneTitle = await page.locator('h2').first().textContent().catch(() => '');
    console.log('10: after finish, title =', doneTitle);
  }

  // ── Step 6: Click "למסך הראשי"
  const homeBtn = page.locator('button').filter({ hasText: /למסך הראשי/i });
  if (await homeBtn.count()) {
    await homeBtn.click();
    await page.waitForTimeout(1000);
    await ss('11_dashboard');
    console.log('11: dashboard');
  }

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
