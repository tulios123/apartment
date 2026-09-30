import { chromium, devices } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'
function chromiumPath() {
  const root = '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  const dir = readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().pop()
  return dir ? `${root}/${dir}/chrome-linux/chrome` : undefined
}
const SCEN = process.argv[2] || 'מושכרת'
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
const browser = await chromium.launch({ executablePath: chromiumPath(), ...(PROXY ? { proxy: { server: PROXY, bypass: 'localhost,127.0.0.1' } } : {}) })
const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage()
page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 250)) })
page.on('response', async r => {
  if (r.url().includes('/rest/v1/') && r.status() >= 400) {
    console.log('HTTP', r.status(), r.request().method(), r.url().split('/rest/v1/')[1].slice(0, 90))
    console.log('   body:', (await r.text().catch(() => '')).slice(0, 300))
  }
})
await page.goto('http://localhost:5173')
await page.locator('.bottom-nav').waitFor({ timeout: 30000 }).catch(() => {})
await page.waitForTimeout(2500)
await page.locator('.usermenu-avatar').click()
await page.locator('.usermenu-panel').waitFor({ timeout: 5000 })
await page.getByRole('menuitem', { name: SCEN, exact: true }).click()
await page.getByRole('button', { name: 'מחק וטען' }).click()
await page.waitForTimeout(12000)
const alert = await page.locator('[role="alert"]').allInnerTexts().catch(() => [])
console.log('ALERTS:', alert)
console.log('URL:', page.url())
await browser.close()
