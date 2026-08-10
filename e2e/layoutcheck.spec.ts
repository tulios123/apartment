import { test, expect } from '@playwright/test'
import { gotoAuthed, saveShot, type Theme } from './lib/helpers'
import { layoutIntegrity } from './lib/layout'

// AUD-002 verification: the fixed bottom-nav must not overlap content CTAs on the
// authed hubs (the full walk left a dataset). Reports remaining violations per screen.
for (const [route, name] of [['/', 'home'], ['/finances', 'finances'], ['/wealth', 'wealth'], ['/property', 'property']] as const) {
  for (const theme of ['light', 'dark'] as Theme[]) {
    test(`layout-integrity ${name} (${theme})`, async ({ page }) => {
      await gotoAuthed(page, route, { theme })
      await page.waitForTimeout(1000)
      // Scroll the content to the bottom: a translucent fixed nav naturally overlaps
      // whatever mid-page row sits at the fold while scrolling — only content that
      // can't clear the nav at MAX scroll (insufficient bottom padding) is a real bug.
      await page.evaluate(() => {
        const sc = document.querySelector('.main-content') as HTMLElement | null
        if (sc) sc.scrollTop = sc.scrollHeight
      })
      await page.waitForTimeout(400)
      const violations = await layoutIntegrity(page)
      const navOverlaps = violations.filter((v) => v.type === 'overlap' && /bottom-nav/.test(v.detail))
      console.log(`${name} ${theme}: ${violations.length} total, ${navOverlaps.length} nav-overlap`)
      if (navOverlaps.length) console.log('  nav-overlaps:', JSON.stringify(navOverlaps))
      await saveShot(page, name, 'layout', theme)
      expect(navOverlaps, `nav must not overlap content on ${name}/${theme}`).toHaveLength(0)
    })
  }
}
