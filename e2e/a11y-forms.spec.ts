import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { stubSupabase, type Fixture } from './lib/stub'
import { setTheme } from './lib/helpers'
import { OWNER } from './lib/fixtures'

/**
 * The forms nobody measures — because they only exist after a tap.
 *
 * `design-checks` loads twelve screens and checks every field has a name, and it reports
 * almost nothing. That is not because the app is clean: it is because the wizard's real
 * forms — mortgage tracks, loans, costs, lease, policy — are behind an "add" button the
 * check never presses. Every family member walks through all of them.
 *
 * A field with no accessible name is announced by a screen reader as an unlabelled edit
 * box, and its visible label does not focus it when tapped. A placeholder is deliberately
 * NOT counted as a name here: it vanishes the moment you type, which is exactly when you
 * most need to know which box you are in.
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const empty: Fixture = {
  owners: [{ id: OWNER, name: 'בדיקה' }],
  properties: [], mortgages: [], mortgage_tracks: [], investment_costs: [],
  contracts: [], loans: [], insurance_policies: [], transactions: [],
  recurring_items: [], tasks: [], documents: [], push_subscriptions: [],
}

/** Controls on screen right now with no accessible name, by the rules above. */
async function nameless(page: Page) {
  return page.evaluate(() => {
    const out: { tag: string; type: string; near: string }[] = []
    for (const el of Array.from(document.querySelectorAll('input, select, textarea'))) {
      const e = el as HTMLInputElement
      if (e.type === 'hidden' || !e.offsetParent) continue
      if (e.getAttribute('aria-label')?.trim()) continue
      if (e.getAttribute('aria-labelledby')?.trim()) continue
      if (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) continue
      if (e.closest('label')) continue
      if (e.getAttribute('title')?.trim()) continue
      // Nameless. Record the nearest visible text so a human can find it.
      const near = (e.closest('.form-row, .form-group, div')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 45)
      out.push({ tag: e.tagName.toLowerCase(), type: e.type || '', near })
    }
    return out
  })
}

async function wizard(page: Page) {
  await setTheme(page, 'light')
  await stubSupabase(page, empty)
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('onboarding_draft')) localStorage.removeItem(k)
  })
  await page.goto('/')
  await page.locator('.onboarding-welcome, .onboarding-wrap').first().waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(700)
}

const next = async (page: Page) => {
  await page.locator('.btn-onboard-primary').last().click()
  await page.waitForTimeout(650)
}

test('שמות נגישים — הטפסים שמאחורי הקשה', async ({ page }) => {
  await wizard(page)
  const report: string[] = []
  let total = 0

  const scan = async (where: string) => {
    const rows = await nameless(page)
    total += rows.length
    report.push(`\n## ${where} — ${rows.length}`)
    for (const r of rows) report.push(`- \`${r.tag}[${r.type}]\` · ליד: "${r.near}"`)
  }

  await next(page)                                   // → documents
  await next(page)                                   // → purchase
  await scan('אשף · פרטי רכישה')

  await next(page)                                   // → mortgage
  await page.getByRole('button', { name: '+ הוסף מסלול' }).click()
  await page.waitForTimeout(500)
  await scan('אשף · משכנתא · טופס מסלול')

  await next(page)                                   // → loans
  const addLoan = page.getByRole('button', { name: /הוסף/ }).first()
  if (await addLoan.count()) { await addLoan.click(); await page.waitForTimeout(500) }
  await scan('אשף · הלוואות · טופס הלוואה')

  await next(page)                                   // → investment
  await scan('אשף · עלויות רכישה')

  await next(page)                                   // → rental
  await scan('אשף · שכירות')

  await next(page)                                   // → insurance
  await scan('אשף · ביטוח')

  const file = path.resolve('docs/audit/a11y-forms.md')
  fs.writeFileSync(file, [
    '# שמות נגישים — הטפסים שמאחורי הקשה',
    '',
    `נוצר על-ידי \`e2e/a11y-forms.spec.ts\` · ${new Date().toLocaleDateString('he-IL')}`,
    '',
    'שדה בלי שם נגיש מוכרז בקורא-מסך כ"תיבת עריכה" בלי שם, והקשה על התווית שלידו',
    'לא ממקדת אותו. **טקסט-רמז (placeholder) לא נחשב שם** — הוא נעלם ברגע שמקלידים,',
    'בדיוק כשהכי צריך לדעת באיזו תיבה אתה.',
    '',
    `**סה״כ ${total} שדות בלי שם.**`,
    ...report,
  ].join('\n'))
  console.log(`\n=== ${total} שדות בלי שם נגיש · ${file} ===\n`)

  // A guard, not a report. This started at 22 and the fix was mechanical (useId + htmlFor,
  // or aria-label where a control sits apart from its label); without an assertion the
  // next form added would quietly put it back. If a new control genuinely cannot take a
  // visible label, give it an aria-label — that counts here.
  expect(total, `${total} controls in the wizard have no accessible name — see ${file}`).toBe(0)
})
