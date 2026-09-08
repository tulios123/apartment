import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { stubSupabase, type Fixture } from './lib/stub'
import { setTheme } from './lib/helpers'
import { base, leased } from './lib/fixtures'

/**
 * Design checks — the invariants the eye is worst at.
 *
 * A screenshot catches what looks wrong; it does not catch a 38px tap target, a row that
 * overflows by 6px, or a label at 10px, and it certainly does not catch them across four
 * screens × two themes × two stages. These are the rules the project already committed to
 * (docs/audit/UX_FOUNDATIONS.md: the 44pt touch floor, RTL as logical direction, no
 * horizontal scroll on a phone) turned into assertions that fail on their own.
 *
 * Two hard failures — horizontal overflow and RTL direction — because both are always
 * bugs. Everything else is COLLECTED and written to docs/audit/design-checks.md, so a
 * borderline 42px button is a line in a report the owner can judge, not a red build.
 *
 * HOW TO RUN — same two traps as every spec here (see the header of e2e/lib/stub.ts):
 *   node node_modules/@playwright/test/cli.js test e2e/design-checks.spec.ts --project=pixel7
 */
test.use({
  launchOptions: {
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
  },
})

const TOUCH_FLOOR = 44
const MIN_FONT = 11
const REPORT = path.resolve('docs/audit/design-checks.md')

type Finding = { rule: string; where: string; detail: string }
const findings: Finding[] = []

/** Every visible interactive element, measured. Runs in the page — cheap and exact. */
async function audit(page: Page) {
  return page.evaluate(({ touchFloor, minFont }) => {
    const out = {
      dir: document.documentElement.getAttribute('dir') ?? getComputedStyle(document.documentElement).direction,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      scanned: 0,
      small: [] as { label: string; w: number; h: number }[],
      tiny: [] as { label: string; px: number }[],
      contrast: [] as { label: string; ratio: number; need: number; fg: string; bg: string }[],
      physical: [] as string[],
    }

    // Text alone is not enough to act on a finding — the same words appear in three
    // places — so every label carries the element it came from.
    const label = (el: Element) => {
      const t = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)
      const aria = el.getAttribute('aria-label') ?? ''
      const cls = (el.getAttribute('class') ?? '').split(' ').filter(Boolean).slice(0, 2).join('.')
      const what = `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`
      return `${t || aria || '—'} · ${what}`
    }
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
    }

    // Measure the REAL hit area, not the box: a 24px icon whose padding extends the target
    // to 44 passes, and two buttons crowded side by side fail even though each box looks
    // big enough. Probe up/down/start/end at 21px from the centre — cardinal, not corners,
    // because a 44px CIRCLE has no corners and is still a legal target.
    //
    // elementFromPoint reads VIEWPORT coordinates, so anything below the fold answers
    // nonsense. Scroll the page in steps and measure only what is fully on screen —
    // getting this wrong is what made the first run flag five perfectly good rows.
    const measured = new Map<string, { label: string; w: number; h: number; ok: boolean }>()
    const step = Math.round(window.innerHeight * 0.8)
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      for (const el of document.querySelectorAll('button, a[href], input, select, [role="button"], [tabindex="0"]')) {
        // Dev-only chrome (the notes button) never reaches the family's app — flagging it
        // would be crying wolf about a tool that ships to nobody.
        if (!visible(el) || el.closest('[data-dev-only]')) continue
        const r = el.getBoundingClientRect()
        const reach = touchFloor / 2 - 1
        if (r.top - reach < 0 || r.bottom + reach > window.innerHeight) continue // not fully on screen
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        // Painted, not merely laid out: a collapsed accordion keeps full-size boxes for
        // its rows while clipping them to nothing, and measuring those produced two
        // confident findings about buttons nobody can see.
        const atCentre = document.elementFromPoint(cx, cy)
        if (!atCentre || !(atCentre === el || el.contains(atCentre) || atCentre.contains(el))) continue

        let blocker = ''
        const hits = [[0, -reach], [0, reach], [-reach, 0], [reach, 0]]
          .every(([dx, dy]) => {
            const hit = document.elementFromPoint(cx + dx, cy + dy)
            const ok = !!hit && (hit === el || el.contains(hit) || hit.contains(el))
            if (!ok && !blocker) blocker = hit ? label(hit) : 'ריק'
            return ok
          })
        // A pass ANYWHERE clears the element: at one scroll offset a sticky header or the
        // bottom nav can cover an edge, and that is the scroll position's fault, not the
        // button's. Only something that never once measures 44px is a real finding.
        const key = label(el) + Math.round(r.width) + 'x' + Math.round(r.height)
        const prev = measured.get(key)
        measured.set(key, {
          label: `${label(el)}${hits ? '' : ` ← ${blocker}`}`, w: Math.round(r.width), h: Math.round(r.height),
          ok: (prev?.ok ?? false) || hits,
        })
      }
    }
    window.scrollTo(0, 0)
    out.scanned = measured.size
    for (const m of measured.values()) if (!m.ok) out.small.push({ label: m.label, w: m.w, h: m.h })

    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue
      const direct = Array.from(el.childNodes).some(n => n.nodeType === 3 && (n.textContent ?? '').trim().length > 1)
      if (!direct || el.closest('[data-dev-only]')) continue
      const px = parseFloat(getComputedStyle(el).fontSize)
      if (px && px < minFont) out.tiny.push({ label: label(el), px: Math.round(px * 10) / 10 })
    }

    // ── Contrast (WCAG AA) ───────────────────────────────────────────────────────
    // Dark mode is where this bites: a muted grey chosen against white keeps its token
    // name in the dark palette and quietly stops being readable. No human rereads every
    // label in both themes; this does.
    const parse = (c: string): [number, number, number, number] | null => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(',').map(v => parseFloat(v))
      return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]
    }
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    /** The colour actually painted behind an element, or null when an image/gradient is. */
    const behind = (el: Element): [number, number, number] | null => {
      let node: Element | null = el
      let acc: [number, number, number, number] | null = null
      while (node) {
        const st = getComputedStyle(node)
        if (st.backgroundImage && st.backgroundImage !== 'none') return null // gradient/photo — not measurable
        const c = parse(st.backgroundColor)
        if (c && c[3] > 0) {
          acc = acc == null ? c : [
            acc[0] * acc[3] + c[0] * (1 - acc[3]),
            acc[1] * acc[3] + c[1] * (1 - acc[3]),
            acc[2] * acc[3] + c[2] * (1 - acc[3]),
            acc[3] + c[3] * (1 - acc[3]),
          ]
          if (acc[3] >= 0.99) return [acc[0], acc[1], acc[2]]
        }
        node = node.parentElement
      }
      return acc ? [acc[0], acc[1], acc[2]] : null
    }

    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('[data-dev-only]')) continue
      const text = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent ?? '').join('').trim()
      if (text.length < 2) continue
      const st = getComputedStyle(el)
      const fg = parse(st.color)
      const bg = behind(el)
      if (!fg || !bg || fg[3] < 0.99) continue // translucent text or an unmeasurable ground
      const px = parseFloat(st.fontSize)
      const bold = Number(st.fontWeight) >= 700
      const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5
      const l1 = lum(fg as unknown as number[])
      const l2 = lum(bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      // No tolerance: the project's own foundations note says you cannot round up —
      // "#777 at 4.47:1 fails" (docs/audit/UX_FOUNDATIONS.md).
      if (ratio < need) {
        out.contrast.push({ label: label(el), ratio: Math.round(ratio * 100) / 100, need, fg: st.color, bg: `rgb(${bg.map(Math.round).join(', ')})` })
      }
    }

    // RTL is a project rule, not a preference: physical left/right in an INLINE style is
    // how a layout silently mirrors wrong. (Stylesheets are audited by eye; inline styles
    // are the ones written in a hurry.)
    for (const el of document.querySelectorAll('[style]')) {
      if (el.closest('[data-dev-only]')) continue
      const s = el.getAttribute('style') ?? ''
      if (/(^|;)\s*(left|right|margin-left|margin-right|padding-left|padding-right|text-align:\s*(left|right))/.test(s)) {
        out.physical.push(`${label(el)} — ${s.slice(0, 60)}`)
      }
    }
    return out
  }, { touchFloor: TOUCH_FLOOR, minFont: MIN_FONT })
}

async function check(page: Page, fixture: Fixture, route: string, where: string, theme: 'light' | 'dark' = 'light') {
  await setTheme(page, theme)
  await stubSupabase(page, fixture)
  await page.goto(route)
  await page.locator('.bottom-nav').waitFor({ state: 'visible', timeout: 30_000 })
  await page.locator('.splash-overlay').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(800)

  const r = await audit(page)

  // ── Hard: always a bug ────────────────────────────────────────────────────────
  expect(r.dir, `${where}: the document must be RTL`).toBe('rtl')
  expect(r.overflow, `${where}: the page scrolls sideways by ${r.overflow}px`).toBeLessThanOrEqual(1)
  // A transparent body borrows the host's colour and breaks dark mode outright.
  expect(r.bodyBg, `${where}: body has no background of its own`).not.toBe('rgba(0, 0, 0, 0)')

  // ── Collected: judgement, not a build break ───────────────────────────────────
  const seen = new Set<string>()
  for (const s of r.small) {
    const key = `${s.label}|${s.w}x${s.h}`
    if (seen.has(key)) continue
    seen.add(key)
    findings.push({ rule: `מטרת-מגע < ${TOUCH_FLOOR}px`, where, detail: `${s.label} — ${s.w}×${s.h}` })
  }
  for (const t of r.tiny) findings.push({ rule: `טקסט < ${MIN_FONT}px`, where, detail: `${t.label} — ${t.px}px` })
  for (const c of r.contrast) findings.push({ rule: 'ניגודיות מתחת ל-AA', where, detail: `${c.label} — ${c.ratio}:1 (נדרש ${c.need}) · ${c.fg} על ${c.bg}` })
  for (const p of r.physical) findings.push({ rule: 'left/right פיזי ב-style', where, detail: p })
}

test.afterAll(async () => {
  // One element that appears on nine screens is ONE thing to fix, not nine findings.
  // Group by (rule, detail) and list where it shows up — otherwise the shared shell
  // (bottom nav, floating buttons) buries everything specific under its own repetitions.
  const grouped = new Map<string, { rule: string; detail: string; where: string[] }>()
  for (const f of findings) {
    const key = `${f.rule} ${f.detail}`
    const g = grouped.get(key) ?? { rule: f.rule, detail: f.detail, where: [] }
    if (!g.where.includes(f.where)) g.where.push(f.where)
    grouped.set(key, g)
  }
  const byRule = new Map<string, typeof grouped extends Map<string, infer V> ? V[] : never>()
  for (const g of grouped.values()) byRule.set(g.rule, [...(byRule.get(g.rule) ?? []), g])

  const lines = [
    '# בדיקות עיצוב — פלט אוטומטי',
    '',
    `נוצר על-ידי \`e2e/design-checks.spec.ts\` · ${new Date().toLocaleDateString('he-IL')} · מכשיר: Pixel 7 (412px)`,
    '',
    'הקובץ נכתב מחדש בכל הרצה — לא לערוך ביד:',
    '`node node_modules/@playwright/test/cli.js test e2e/design-checks.spec.ts --project=pixel7`',
    '',
    '**מה נבדק.** *כשל קשה* (מפיל את הריצה, לא מגיע לכאן): גלישה אופקית, כיוון RTL,',
    'רקע שקוף ל-body. *ממצא לשיפוט*: מטרת-מגע קטנה מ-44px — נמדדת כשטח-מגע אמיתי',
    '(מגששים 21px מהמרכז לארבעה כיוונים), כך שריפוד סופר וצפיפות בין כפתורים נתפסת;',
    'וטקסט מתחת ל-11px. שני הספים הם מוסכמה של הפרויקט, לא חוק — 10.5px בתווית ניווט',
    'הוא בגבול המקובל, וההכרעה שלך.',
    '',
    '*ניגודיות* נמדדת מול הצבע שבאמת מצויר מאחור (שכבות שקופות מורכבות עד לאטום);',
    'טקסט מעל תמונה או מעבר-צבע מדולג — שם אין מספר אחד למדוד מולו.',
    '',
    'לא נבדק (עדיין): מצבי פוקוס, ומסכים שמאחורי אינטראקציה (מודאלים, טפסים) —',
    'אלה דורשים תסריט לחיצות ולא רק טעינה.',
    '',
    grouped.size === 0 ? '**אין ממצאים.**' : `**${grouped.size} ממצאים ייחודיים** (${findings.length} מופעים על פני ${new Set(findings.map(f => f.where)).size} מסכים).`,
    '',
  ]
  for (const [rule, items] of byRule) {
    items.sort((a, b) => b.where.length - a.where.length)
    lines.push(`## ${rule} · ${items.length}`, '')
    for (const i of items) {
      const scope = i.where.length > 3 ? `${i.where.length} מסכים` : i.where.join(' · ')
      lines.push(`- ${i.detail}  \n  <sub>${scope}</sub>`)
    }
    lines.push('')
  }
  fs.mkdirSync(path.dirname(REPORT), { recursive: true })
  fs.writeFileSync(REPORT, lines.join('\n'))
})

test('בית · מושכרת · בהיר', async ({ page }) => {
  await check(page, leased({ rentPaid: true }), '/', 'בית · מושכרת · בהיר')
})
test('בית · מושכרת · כהה', async ({ page }) => {
  await check(page, leased({ rentPaid: true }), '/', 'בית · מושכרת · כהה', 'dark')
})
test('בית · טרם מסירה', async ({ page }) => {
  await check(page, base(213), '/', 'בית · טרם מסירה')
})
test('תזרים · טרם מסירה', async ({ page }) => {
  await check(page, base(213), '/finances', 'תזרים · טרם מסירה')
})
test('תזרים · מושכרת', async ({ page }) => {
  await check(page, leased({ rentPaid: true }), '/finances', 'תזרים · מושכרת')
})
test('הון · טרם מסירה', async ({ page }) => {
  await check(page, base(213), '/wealth', 'הון · טרם מסירה')
})
test('הון · מושכרת · כהה', async ({ page }) => {
  await check(page, leased({ rentPaid: true }), '/wealth', 'הון · מושכרת · כהה', 'dark')
})
test('הנכס · טרם מסירה', async ({ page }) => {
  await check(page, base(213), '/property', 'הנכס · טרם מסירה')
})
test('הנכס · מושכרת', async ({ page }) => {
  await check(page, leased({ rentPaid: true }), '/property', 'הנכס · מושכרת')
})
// The staging-only process drawing is held to the same bar — a preview nobody can tap
// is not a preview.
test('תצוגת התהליך', async ({ page }) => {
  await check(page, base(213), '/preview/process', 'תצוגת התהליך')
})
