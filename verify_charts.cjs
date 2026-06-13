const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 393, height: 852 });

  const results = {};

  // Helper: navigate and wait for app to fully load (past auth/loading screen)
  async function navigate(url) {
    await page.goto(url, { waitUntil: 'networkidle' });
    // Wait until loading spinner ("טוען...") is gone and nav links appear
    await page.waitForFunction(
      () => !document.body.innerText.includes('טוען') && document.querySelectorAll('.nav-link').length > 0,
      { timeout: 10000 }
    ).catch(() => {});
  }

  // Helper: measure nav-link height
  async function measureNavLinkHeight() {
    const heights = await page.evaluate(() => {
      const links = document.querySelectorAll('.nav-link');
      return Array.from(links).map(el => el.getBoundingClientRect().height);
    });
    return heights;
  }

  // 1. Screenshot /finances
  console.log('Navigating to /finances...');
  await navigate('http://localhost:5173/finances');
  await page.screenshot({ path: '/tmp/verify_finance.png', fullPage: false });
  console.log('Screenshot saved: /tmp/verify_finance.png');

  // Measure nav-link heights on /finances
  results.navHeightsFinances = await measureNavLinkHeight();

  // Check scrollWidth on /finances
  results.scrollWidthFinances = await page.evaluate(() => document.body.scrollWidth);

  // 2. Screenshot /property/mortgage
  console.log('Navigating to /property/mortgage...');
  await navigate('http://localhost:5173/property/mortgage');
  await page.screenshot({ path: '/tmp/verify_mortgage.png', fullPage: false });
  console.log('Screenshot saved: /tmp/verify_mortgage.png');

  // Measure nav-link heights on /property/mortgage
  results.navHeightsMortgage = await measureNavLinkHeight();

  // Check scrollWidth on /property/mortgage
  results.scrollWidthMortgage = await page.evaluate(() => document.body.scrollWidth);

  // 3. Check scrollWidth on /
  console.log('Navigating to /...');
  await navigate('http://localhost:5173/');
  results.scrollWidthHome = await page.evaluate(() => document.body.scrollWidth);

  // Measure nav-link heights on home
  results.navHeightsHome = await measureNavLinkHeight();

  await browser.close();

  // Report
  console.log('\n===== VERIFICATION REPORT =====\n');

  // Nav-link heights
  const allNavHeights = [
    ...results.navHeightsHome,
    ...results.navHeightsFinances,
    ...results.navHeightsMortgage,
  ];
  const minNavHeight = allNavHeights.length > 0 ? Math.min(...allNavHeights) : null;
  const maxNavHeight = allNavHeights.length > 0 ? Math.max(...allNavHeights) : null;

  console.log('NAV-LINK BOUNDING BOX HEIGHTS:');
  console.log(`  Home page:          ${JSON.stringify(results.navHeightsHome)}`);
  console.log(`  Finances page:      ${JSON.stringify(results.navHeightsFinances)}`);
  console.log(`  Mortgage page:      ${JSON.stringify(results.navHeightsMortgage)}`);
  console.log(`  Min height across all pages: ${minNavHeight}px`);
  console.log(`  All >= 44px? ${minNavHeight !== null && minNavHeight >= 44 ? 'YES ✓' : 'NO ✗ (min=' + minNavHeight + ')'}`);

  console.log('\nSCROLL WIDTH (should be 393):');
  console.log(`  /                   scrollWidth = ${results.scrollWidthHome} → ${results.scrollWidthHome === 393 ? 'OK ✓' : 'OVERFLOW ✗'}`);
  console.log(`  /finances           scrollWidth = ${results.scrollWidthFinances} → ${results.scrollWidthFinances === 393 ? 'OK ✓' : 'OVERFLOW ✗'}`);
  console.log(`  /property/mortgage  scrollWidth = ${results.scrollWidthMortgage} → ${results.scrollWidthMortgage === 393 ? 'OK ✓' : 'OVERFLOW ✗'}`);

  const allScrollOk =
    results.scrollWidthHome === 393 &&
    results.scrollWidthFinances === 393 &&
    results.scrollWidthMortgage === 393;
  console.log(`  All pages no overflow? ${allScrollOk ? 'YES ✓' : 'NO ✗'}`);

  console.log('\nSCREENSHOTS:');
  console.log('  /tmp/verify_finance.png');
  console.log('  /tmp/verify_mortgage.png');

  console.log('\n===== END REPORT =====\n');
})();
