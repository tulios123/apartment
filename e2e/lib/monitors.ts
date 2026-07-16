import type { Page, Request } from '@playwright/test'

// Dev-server / infra noise that is not app code — filtered, list disclosed in evidence.
const CONSOLE_FILTER = [
  /\[vite\]/i,
  /React DevTools/i,
  /Download the React DevTools/i,
  /\[HMR\]/i,
  /service worker/i, // SW registration is skipped/no-op on dev; logs are infra noise
]

export interface ConsoleHit { level: string; text: string; url: string }

// Console monitor: any console.error/warn (or uncaught page error) during a test = finding.
export function attachConsoleMonitor(page: Page) {
  const hits: ConsoleHit[] = []
  page.on('console', (msg) => {
    const level = msg.type()
    if (level !== 'error' && level !== 'warning') return
    const text = msg.text()
    if (CONSOLE_FILTER.some((re) => re.test(text))) return
    hits.push({ level, text: text.slice(0, 400), url: page.url() })
  })
  page.on('pageerror', (err) => {
    hits.push({ level: 'pageerror', text: String(err).slice(0, 400), url: page.url() })
  })
  return hits
}

export interface NetworkReport {
  duplicates: { url: string; count: number }[]
  pending: string[]
  failed: { url: string; status: number | string }[]
}

// Network logger: duplicate fetches per navigation window, never-resolving requests,
// failed (4xx/5xx/error) requests. Call report() at the end of a scenario.
export function attachNetworkMonitor(page: Page) {
  const counts = new Map<string, number>()
  const pending = new Map<Request, string>()
  const failed: { url: string; status: number | string }[] = []

  const key = (req: Request) => {
    const u = new URL(req.url())
    if (!/supabase|localhost:54|functions/.test(u.host + u.pathname)) return null
    return `${req.method()} ${u.host}${u.pathname}?${u.searchParams.toString().slice(0, 120)}`
  }

  page.on('request', (req) => {
    const k = key(req)
    if (!k) return
    pending.set(req, k)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  })
  page.on('requestfinished', (req) => { pending.delete(req) })
  page.on('requestfailed', (req) => {
    const k = pending.get(req)
    pending.delete(req)
    if (k && !/net::ERR_ABORTED/.test(req.failure()?.errorText ?? '')) failed.push({ url: k, status: req.failure()?.errorText ?? 'failed' })
  })
  page.on('response', (res) => {
    const req = res.request()
    const k = key(req)
    if (k && res.status() >= 400) failed.push({ url: k, status: res.status() })
  })

  return {
    resetWindow() { counts.clear() },
    report(): NetworkReport {
      return {
        duplicates: [...counts.entries()].filter(([, c]) => c > 1).map(([url, count]) => ({ url, count })),
        pending: [...pending.values()],
        failed,
      }
    },
  }
}
