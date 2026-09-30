// Walk the onboarding wizard as a first-time user, capturing what each screen says,
// what it asks for, and what it costs to get past it.
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
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-apartment/c6dcf340-f4bd-586e-8cd1-0aacec5664e5/scratchpad/walk/wizard'
fs.mkdirSync(OUT, { recursive: true })

const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
const browser = await chromium.launch({ executablePath: chromiumPath(), ...(PROXY ? { proxy: { server: PROXY, bypass: 'localhost,127.0.0.1' } } : {}) })
const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage()
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)))

await page.addInitScript(() => {
  try { Object.keys(localStorage).filter(k => k.startsWith('onboarding_draft')).forEach(k => localStorage.removeItem(k)) } catch { /* */ }
})
await page.goto('http://localhost:5173')
await page.waitForTimeout(4000)

let n = 0
async function capture(name) {
  n++
  const slug = `${String(n).padStart(2, '0')}-${name}`
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(OUT, `${slug}.png`), fullPage: true })
  const text = await page.evaluate(() => document.body.innerText.replace(/\n{3,}/g, '\n\n'))
  const fields = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('input, select, textarea, [role="combobox"]').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width === 0) return
      const id = el.id
      const lab = (id && document.querySelector(`label[for="${id}"]`)?.innerText) || el.getAttribute('aria-label') || el.placeholder || el.name || '?'
      out.push(`${lab.trim().replace(/\s+/g, ' ')} | ${el.tagName.toLowerCase()}${el.type ? ':' + el.type : ''} | required=${el.required} | value="${(el.value || '').slice(0, 30)}"`)
    })
    return out
  })
  const buttons = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('button, [role="button"]').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const l = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)
      if (l) out.push(`${l} [${Math.round(r.width)}×${Math.round(r.height)}]`)
    })
    return [...new Set(out)]
  })
  const h = await page.evaluate(() => document.body.scrollHeight)
  fs.writeFileSync(path.join(OUT, `${slug}.txt`),
    `SCREEN ${name}   (page height ${h}px on a 915px viewport = ${(h / 915).toFixed(1)} screens)\n${'='.repeat(70)}\n${text}\n\n--- FIELDS (${fields.length}) ---\n${fields.join('\n')}\n\n--- BUTTONS ---\n${buttons.join('\n')}\n`)
  console.log(`✓ ${slug}  · ${fields.length} fields · ${(h / 915).toFixed(1)} screens tall`)
  return { text, fields, buttons }
}

// Screen 1: whatever greets a brand-new account
await capture('as-landed')

// Step forward through the wizard, filling nothing, to learn what it takes to pass.
for (let i = 0; i < 12; i++) {
  const next = page.getByRole('button', { name: /^(מתחילים|המשך|בואו נתחיל|התחלה|סיום|סיימו עכשיו|דלגו)$/ }).first()
  if (!(await next.count())) break
  const label = (await next.innerText()).trim()
  await next.click().catch(() => {})
  await page.waitForTimeout(1200)
  const r = await capture(`after-${label.replace(/\s+/g, '-')}`)
  if (/הכול מוכן|רגע לפני שמירה/.test(r.text)) break
}

await browser.close()
