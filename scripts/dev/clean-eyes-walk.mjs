// Clean-eyes walk harness. Drives the LOCAL dev server (dev-bypass auto-login) as a
// real user would: load a data state, then visit each screen, screenshot it, and dump
// what it actually says so the run can be read as text rather than only as pictures.
import { chromium, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { existsSync, readdirSync } from 'node:fs'

function chromiumPath() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH
  const root = '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  const dir = readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().pop()
  if (!dir) return undefined
  const exe = `${root}/${dir}/chrome-linux/chrome`
  return existsSync(exe) ? exe : undefined
}

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=')
  return [k, v.join('=') || true]
}))

const TAG = args.tag || 'run'
const SCENARIO = args.scenario || null            // label text in the account menu
const ROUTES = (args.routes || '/,/finances,/wealth,/wealth/liabilities,/property,/property/tasks,/property/documents,/settings').split(',')
const OUT = path.resolve(args.out || `/tmp/claude-0/-home-user-apartment/c6dcf340-f4bd-586e-8cd1-0aacec5664e5/scratchpad/walk/${TAG}`)
const BASE = 'http://localhost:5173'

fs.mkdirSync(OUT, { recursive: true })

const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
const browser = await chromium.launch({
  executablePath: chromiumPath(),
  ...(PROXY ? { proxy: { server: PROXY, bypass: 'localhost,127.0.0.1' } } : {}),
})
const ctx = await browser.newContext({ ...devices['Pixel 7'] })
const page = await ctx.newPage()

const consoleHits = []
page.on('console', m => {
  if (m.type() === 'error' || m.type() === 'warning') consoleHits.push({ type: m.type(), text: m.text().slice(0, 300) })
})
page.on('pageerror', e => consoleHits.push({ type: 'pageerror', text: String(e).slice(0, 300) }))

async function settle() {
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {})
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  // Hubs paint a skeleton first; screenshotting through it captures grey bars, not a screen.
  await page.locator('.skeleton, .skeleton-card, .skeleton-list, .dash-hero-skeleton')
    .first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

await page.goto(BASE)
await settle()

// ── Load the data state through the app's own scenario loader ──────────────────
if (SCENARIO) {
  await page.locator('.usermenu-avatar').click()
  await page.locator('.usermenu-panel').waitFor({ state: 'visible', timeout: 5000 })
  await page.getByRole('menuitem', { name: SCENARIO, exact: true }).click()
  // confirm dialog
  const confirm = page.getByRole('button', { name: 'מחק וטען' }).first()
  await confirm.waitFor({ state: 'visible', timeout: 8000 })
  await confirm.click()
  // applyScenario wipes then inserts ~8 rows, then reloads the page itself.
  await page.waitForURL(u => u.pathname === '/', { timeout: 40_000 })
  await page.waitForTimeout(3000)
  await page.goto(BASE)
  await settle()
  const seeded = await page.evaluate(() => document.body.innerText)
  if (!/הרצל 45|דנה לוי|חשבון בדיקות/.test(seeded)) {
    console.warn('⚠ scenario may not have applied — no seeded marker on the first screen')
  }
}

// ── Walk ───────────────────────────────────────────────────────────────────────
const report = []
for (const route of ROUTES) {
  const slug = route.replace(/^\//, '').replace(/\//g, '-') || 'home'
  await page.goto(BASE + route)
  await settle()
  const shot = path.join(OUT, `${slug}.png`)
  await page.screenshot({ path: shot, fullPage: true })
  const text = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body
    return main.innerText.replace(/\n{3,}/g, '\n\n')
  })
  // every tappable thing, so "what can I even do here" is answerable from the dump
  const actions = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('button, a[href], [role="button"], [role="tab"]').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const label = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60)
      if (label) out.push(`${label} [${Math.round(r.width)}×${Math.round(r.height)}]`)
    })
    return [...new Set(out)]
  })
  fs.writeFileSync(path.join(OUT, `${slug}.txt`),
    `ROUTE ${route}\n${'='.repeat(60)}\n${text}\n\n--- ACTIONS ---\n${actions.join('\n')}\n`)
  report.push({ route, chars: text.length, actions: actions.length })
  console.log(`✓ ${route}  (${text.length} chars, ${actions.length} actions)`)
}

fs.writeFileSync(path.join(OUT, '_console.json'), JSON.stringify(consoleHits, null, 2))
console.log(`\nconsole hits: ${consoleHits.length}`)
for (const h of consoleHits.slice(0, 15)) console.log(`  [${h.type}] ${h.text.slice(0, 160)}`)

await browser.close()
