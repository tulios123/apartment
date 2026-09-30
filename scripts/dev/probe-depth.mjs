// Depth probe: the things a person reaches for in month 2 and beyond — the year view,
// next month, the mortgage detail, the yields explainer, the expense sheet.
import { chromium, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
function chromiumPath() {
  const root = '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  const dir = readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().pop()
  return dir ? `${root}/${dir}/chrome-linux/chrome` : undefined
}
const OUT = '/tmp/claude-0/-home-user-apartment/c6dcf340-f4bd-586e-8cd1-0aacec5664e5/scratchpad/walk/depth'
fs.mkdirSync(OUT, { recursive: true })
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
const browser = await chromium.launch({ executablePath: chromiumPath(), ...(PROXY ? { proxy: { server: PROXY, bypass: 'localhost,127.0.0.1' } } : {}) })
const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage()
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)))

async function shot(name) {
  await page.waitForTimeout(1600)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
  const t = await page.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\n{3,}/g, '\n\n'))
  fs.writeFileSync(path.join(OUT, `${name}.txt`), t)
  console.log(`\n--- ${name} ---\n${t.slice(0, 1600)}`)
}
async function go(route) {
  await page.goto('http://localhost:5173' + route)
  await page.locator('.bottom-nav').waitFor({ timeout: 30000 }).catch(() => {})
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  await page.locator('.skeleton, .skeleton-card, .skeleton-list').first().waitFor({ state: 'detached', timeout: 12000 }).catch(() => {})
}

await go('/finances')
await page.getByRole('button', { name: 'שנה', exact: true }).click().catch(() => {})
await shot('01-finances-year')

await go('/finances')
await page.getByRole('button', { name: 'חודש הבא' }).click().catch(() => {})
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'חודש הבא' }).click().catch(() => {})
await shot('02-finances-two-months-ahead')

await go('/wealth')
await page.getByRole('button', { name: /משכנתא ראשית/ }).click().catch(() => {})
await shot('03-mortgage-detail')

await go('/wealth')
await page.getByRole('button', { name: /מה ההבדל בין התשואות/ }).click().catch(() => {})
await shot('04-yields-explainer')

await go('/')
await page.getByRole('button', { name: /^הוצאה$/ }).click().catch(() => {})
await shot('05-add-expense-sheet')

await go('/property')
await page.getByRole('button', { name: /^ביטוח$/ }).click().catch(() => {})
await shot('06-insurance-tab')

await go('/property')
await page.getByRole('button', { name: /^תחזוקה$/ }).click().catch(() => {})
await shot('07-maintenance-tab')

await browser.close()
