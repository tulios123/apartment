import { test, expect, type Page } from '@playwright/test'
import { stubSupabase } from './lib/stub'
import { saveShot, setTheme } from './lib/helpers'
import { account } from './lib/personas'

/**
 * Does the floating pair actually sit on top of content?
 *
 * Every full-page screenshot in this run showed the docs/feedback circles lying across the
 * amounts column, and three times that was waved off as an artifact of how fullPage
 * renders fixed elements. This settles it the only way it can be settled: real viewport
 * geometry, at real scroll positions, asking the page itself what is under those circles.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

test('הכפתורים הצפים — מה באמת מתחתיהם', async ({ page }) => {
  await setTheme(page, 'light')
  await stubSupabase(page, account(217, 60))
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__c')) return
    sessionStorage.setItem('__c', '1')
    for (const k of Object.keys(localStorage)) if (k.startsWith('purchase_plan:')) localStorage.removeItem(k)
  })
  await page.goto('/')
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'לבנות את הלוח' }).click()
  await page.locator('.pln-setup').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'בניית הלוח' }).click()
  await page.locator('.pmap').waitFor({ state: 'visible' })
  await page.waitForTimeout(600)

  const report: string[] = []
  for (const y of [0, 400, 800, 1200, 1600]) {
    await page.evaluate(s => window.scrollTo(0, s), y)
    await page.waitForTimeout(350)
    const hits = await page.evaluate(() => {
      // Every fixed circle on screen, and what the browser says is beneath its centre.
      const out: { fab: string; under: string; text: string }[] = []
      for (const el of Array.from(document.querySelectorAll('button, a'))) {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        const round = parseFloat(cs.borderRadius) >= r.width / 2 - 2
        if (cs.position !== 'fixed' || !round || r.width < 30 || r.width > 90) continue
        // Peek underneath: hide it, ask what is there, put it back.
        const vis = (el as HTMLElement).style.visibility
        ;(el as HTMLElement).style.visibility = 'hidden'
        const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        ;(el as HTMLElement).style.visibility = vis
        if (!under) continue
        out.push({
          fab: el.className || el.tagName,
          under: `${under.tagName.toLowerCase()}.${(under.className || '').toString().split(' ')[0]}`,
          text: (under.textContent || '').trim().slice(0, 40),
        })
      }
      return out
    })
    for (const h of hits) report.push(`scroll ${y}: ${h.fab} → ${h.under} "${h.text}"`)
    await saveShot(page, 'fab', `scroll-${y}`, 'light')
  }
  console.log('\n=== מה יושב מתחת לכפתורים הצפים ===\n' + report.join('\n') + '\n')
  expect(report.length).toBeGreaterThan(0)
})
