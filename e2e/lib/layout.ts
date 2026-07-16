import type { Page } from '@playwright/test'

export interface LayoutViolation {
  type: 'overflow-x' | 'overlap' | 'small-target' | 'clipped-text'
  detail: string
  rect?: { x: number; y: number; w: number; h: number }
}

// Programmatic layout-integrity pass (runs on every visited state, both themes,
// at 402 and 320): horizontal viewport overflow, overlapping interactive elements,
// touch targets under 44pt, clipped text without ellipsis.
export async function layoutIntegrity(page: Page): Promise<LayoutViolation[]> {
  return page.evaluate(() => {
    const out: {
      type: 'overflow-x' | 'overlap' | 'small-target' | 'clipped-text'
      detail: string
      rect?: { x: number; y: number; w: number; h: number }
    }[] = []

    const describe = (el: Element) => {
      const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : ''
      const cls = typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
      const text = (el.textContent ?? '').trim().slice(0, 30)
      return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`
    }
    const rectOf = (r: DOMRect) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })

    // 1. Horizontal overflow of the page itself
    const docEl = document.documentElement
    if (docEl.scrollWidth > window.innerWidth + 1) {
      const offenders: string[] = []
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
          const style = getComputedStyle(el)
          if (style.position !== 'fixed' && offenders.length < 5) offenders.push(describe(el))
        }
      })
      out.push({ type: 'overflow-x', detail: `scrollWidth ${docEl.scrollWidth} > viewport ${window.innerWidth}; offenders: ${offenders.join(' | ') || 'none isolated'}` })
    }

    // Collect visible interactive elements
    const interactive = Array.from(document.querySelectorAll<HTMLElement>(
      'a[href], button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter((el) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' &&
        s.opacity !== '0' && r.bottom > 0 && r.top < window.innerHeight
    })

    // 2. Touch targets under 44×44 CSS px (hit area incl. padding). Inline text
    // links inside paragraphs are exempt per WCAG.
    for (const el of interactive) {
      const r = el.getBoundingClientRect()
      const inProse = !!el.closest('p, li')
      if (!inProse && el.tagName !== 'INPUT' && (r.width < 44 || r.height < 44)) {
        // allow if a parent label/button provides the hit area
        const parent = el.parentElement?.closest('button, a[href], [role="button"], label')
        const pr = parent?.getBoundingClientRect()
        if (!(pr && pr.width >= 44 && pr.height >= 44)) {
          out.push({ type: 'small-target', detail: `${describe(el)} — ${Math.round(r.width)}×${Math.round(r.height)}`, rect: rectOf(r) })
        }
      }
    }

    // 3. Overlapping interactive elements (distinct controls whose boxes intersect
    // materially — >30% of the smaller box)
    for (let i = 0; i < interactive.length; i++) {
      for (let j = i + 1; j < interactive.length; j++) {
        const a = interactive[i], b = interactive[j]
        if (a.contains(b) || b.contains(a)) continue
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
        const ix = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left))
        const iy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top))
        const inter = ix * iy
        const smaller = Math.min(ra.width * ra.height, rb.width * rb.height)
        if (smaller > 0 && inter / smaller > 0.3) {
          out.push({ type: 'overlap', detail: `${describe(a)} ⊗ ${describe(b)} (${Math.round((inter / smaller) * 100)}%)`, rect: rectOf(ra) })
        }
      }
    }

    // 4. Clipped text without ellipsis
    document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
      if (el.children.length > 0) return
      const t = (el.textContent ?? '').trim()
      if (!t) return
      if (el.scrollWidth > el.clientWidth + 2) {
        const s = getComputedStyle(el)
        if ((s.overflow === 'hidden' || s.overflowX === 'hidden') && s.textOverflow !== 'ellipsis') {
          out.push({ type: 'clipped-text', detail: `${describe(el)} — scrollW ${el.scrollWidth} > clientW ${el.clientWidth}`, rect: rectOf(el.getBoundingClientRect()) })
        }
      }
    })

    return out
  })
}
