// Retention probe: what is left on the home screen once the one thing it asks for
// is done? A landlord's month has one approval in it; this is day 2 of 30.
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
const OUT = '/tmp/claude-0/-home-user-apartment/c6dcf340-f4bd-586e-8cd1-0aacec5664e5/scratchpad/walk/probe30'
fs.mkdirSync(OUT, { recursive: true })
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
const browser = await chromium.launch({ executablePath: chromiumPath(), ...(PROXY ? { proxy: { server: PROXY, bypass: 'localhost,127.0.0.1' } } : {}) })
const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage()

async function shot(name) {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
  const t = await page.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\n{3,}/g, '\n\n'))
  fs.writeFileSync(path.join(OUT, `${name}.txt`), t)
  console.log(`--- ${name} ---\n${t}\n`)
}

await page.goto('http://localhost:5173')
await page.locator('.bottom-nav').waitFor({ timeout: 30000 })
await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
await shot('01-before-approval')

const approve = page.getByRole('button', { name: /כן, אשר/ }).first()
if (await approve.count()) {
  await approve.click()
  await page.waitForTimeout(4000)
  await shot('02-after-approval')
} else {
  console.log('(no approval card on screen)')
}

await page.goto('http://localhost:5173/')
await page.waitForTimeout(4000)
await shot('03-next-visit')
await browser.close()
