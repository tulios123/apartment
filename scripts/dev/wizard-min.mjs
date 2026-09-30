// Path A — the skipper: fill only what the wizard refuses to pass without, then take
// the earliest exit offered, and look at the home screen that produces.
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
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-apartment/c6dcf340-f4bd-586e-8cd1-0aacec5664e5/scratchpad/walk/wizard-min'
fs.mkdirSync(OUT, { recursive: true })
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
const browser = await chromium.launch({ executablePath: chromiumPath(), ...(PROXY ? { proxy: { server: PROXY, bypass: 'localhost,127.0.0.1' } } : {}) })
const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage()
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)))

let n = 0
async function capture(name) {
  n++
  const slug = `${String(n).padStart(2, '0')}-${name}`
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(OUT, `${slug}.png`), fullPage: true })
  const text = await page.evaluate(() => document.body.innerText.replace(/\n{3,}/g, '\n\n'))
  const buttons = await page.evaluate(() => [...new Set([...document.querySelectorAll('button,[role="button"]')]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(e => (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)).filter(Boolean))])
  fs.writeFileSync(path.join(OUT, `${slug}.txt`), `SCREEN ${name}\n${'='.repeat(70)}\n${text}\n\n--- BUTTONS ---\n${buttons.join('\n')}\n`)
  console.log(`✓ ${slug}`)
  return { text, buttons }
}

await page.addInitScript(() => { try { Object.keys(localStorage).filter(k => k.startsWith('onboarding_draft')).forEach(k => localStorage.removeItem(k)) } catch { /* */ } })
const t0 = Date.now()
await page.goto('http://localhost:5173')
await page.waitForTimeout(4000)

await page.getByRole('button', { name: 'מתחילים' }).click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'המשך' }).click()   // past documents
await page.waitForTimeout(900)
await capture('purchase-empty')

await page.getByLabel(/מחיר רכישה/).fill('2100000')
await page.waitForTimeout(400)
await capture('purchase-price-only')
await page.getByRole('button', { name: 'המשך' }).click()
await page.waitForTimeout(1200)

// From here take the earliest exit the wizard offers on each screen.
for (let i = 0; i < 8; i++) {
  const r = await capture(`step-${i}`)
  if (/הכול מוכן|רגע לפני שמירה/.test(r.text)) break
  const finish = page.getByRole('button', { name: /^(סיימו עכשיו|סיום)$/ }).first()
  if (await finish.count()) {
    console.log('   → exit offered:', (await finish.innerText()).trim())
    await finish.click()
    await page.waitForTimeout(1500)
    await capture(`step-${i}-after-exit`)
    break
  }
  const next = page.getByRole('button', { name: 'המשך' }).first()
  if (!(await next.count())) break
  await next.click()
  await page.waitForTimeout(1200)
}

// Whatever screen we are on now, drive it to the end.
for (let i = 0; i < 4; i++) {
  const cta = page.getByRole('button', { name: /^(הכול נכון · שמרו|סיום|שמירה וסיום|כניסה לאפליקציה|בואו נתחיל|המשך)$/ }).first()
  if (!(await cta.count())) break
  const label = (await cta.innerText()).trim()
  await cta.click().catch(() => {})
  await page.waitForTimeout(2500)
  await capture(`finish-${label.replace(/\s+/g, '-')}`)
  if (await page.locator('.bottom-nav').count()) break
}

const secs = Math.round((Date.now() - t0) / 1000)
console.log(`\nwall clock, fully automated, zero typing hesitation: ${secs}s`)
await page.goto('http://localhost:5173/')
await page.waitForTimeout(3500)
await capture('home-after-minimum')
await browser.close()
