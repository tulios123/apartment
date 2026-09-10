import type { Page, Route } from '@playwright/test'

/**
 * Render the app with canned data, no network.
 *
 * The cloud sandbox cannot open a TLS tunnel to Supabase through the agent proxy, which
 * left the pre-key screens unviewable — so they were built and shipped without anyone
 * ever looking at them. That was a choice, not a constraint: intercepting the API and
 * serving fixtures takes minutes and makes every screen inspectable offline, at any
 * stage, without touching real data.
 *
 * Fixtures are keyed by table so a spec can describe an account ("a buyer seven months
 * from handover") instead of assembling rows.
 *
 * HOW TO RUN (neither part is obvious, both were found the hard way):
 *
 *   node node_modules/@playwright/test/cli.js test e2e/home-states.spec.ts --project=pixel7
 *
 *  1. Use @playwright/test's OWN cli.js. `npx playwright` resolves a different, newer
 *     playwright in node_modules and fails with "test() was not expected to be called
 *     here" — the classic two-versions error.
 *  2. Each spec must set launchOptions with `executablePath` (the image ships Chromium
 *     1194, this repo's Playwright wants 1228) and `proxy: { server: HTTPS_PROXY }` —
 *     without the proxy the browser cannot reach anything and the app hangs at login.
 *     WebKit is not installed here; --project=pixel7 (Chromium) is the one that runs.
 *
 * Screenshots land in docs/audit/evidence/ via saveShot().
 */
export type Fixture = Record<string, unknown[]>

const USER = {
  id: '00000000-0000-0000-0000-0000000000aa',
  email: 'view@test.local',
  user_metadata: { full_name: 'איתי בדיקה' },
  app_metadata: { provider: 'email' },
  aud: 'authenticated',
  role: 'authenticated',
}

const SESSION = {
  access_token: 'stub', refresh_token: 'stub', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: USER,
}

/** Table name out of a PostgREST URL: /rest/v1/<table>?select=... */
function tableOf(url: string): string {
  const m = url.match(/\/rest\/v1\/([^?/]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export async function stubSupabase(page: Page, fixture: Fixture) {
  const json = (route: Route, body: unknown, status = 200) => {
    // A head+count query reads the row count from content-range, not the body. Getting
    // this wrong makes "does this already exist?" checks answer no, which quietly turns
    // a screenshot into fiction.
    const n = Array.isArray(body) ? body.length : 1
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, n - 1)}/${n}` },
      body: JSON.stringify(body),
    })
  }

  await page.route('**/auth/v1/**', (route) => {
    const url = route.request().url()
    if (url.includes('/token')) return json(route, SESSION)
    if (url.includes('/user')) return json(route, USER)
    if (url.includes('/logout')) return json(route, {})
    return json(route, SESSION)
  })

  await page.route('**/rest/v1/**', (route) => {
    const method = route.request().method()
    const table = tableOf(route.request().url())
    // Writes echo back what was sent, so optimistic UI settles instead of rolling back.
    if (method !== 'GET') {
      let sent: unknown = {}
      try { sent = JSON.parse(route.request().postData() || '{}') } catch { /* empty body */ }
      const rows = Array.isArray(sent) ? sent : [sent]
      return json(route, rows.map((r, i) => ({ id: `new-${table}-${i}`, ...(r as object) })))
    }
    // PostgREST filters live in the query string, and this used to serve the table whole
    // and "let the app filter". That is false for anything the app filters SERVER-side:
    // useTransactions asks for one month with .gte('date',…).lte('date',…), so a fixture
    // with several months of history had every month's rows land in the current month.
    // A stage-C walk then read ₪16,000 of rent against ₪4,000 expected and a month that
    // was ₪10,000 in the black for a flat that loses money — a Critical finding that was
    // never in the app at all. The filters are honoured now.
    const rows = fixture[table] ?? []
    const url = new URL(route.request().url())
    const NON_FILTER = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])
    const unwrap = (v: string) => v.replace(/^"|"$/g, '')

    const filtered = rows.filter((row) => {
      const r = row as Record<string, unknown>
      for (const [col, raw] of url.searchParams.entries()) {
        if (NON_FILTER.has(col)) continue
        const dot = raw.indexOf('.')
        if (dot < 0) continue
        const op = raw.slice(0, dot)
        const val = raw.slice(dot + 1)
        const cell = r[col]
        switch (op) {
          case 'eq':  if (String(cell) !== unwrap(val)) return false; break
          case 'neq': if (String(cell) === unwrap(val)) return false; break
          case 'gt':  if (!(String(cell) > unwrap(val))) return false; break
          case 'gte': if (!(String(cell) >= unwrap(val))) return false; break
          case 'lt':  if (!(String(cell) < unwrap(val))) return false; break
          case 'lte': if (!(String(cell) <= unwrap(val))) return false; break
          case 'in': {
            const wanted = new Set(val.replace(/^\(|\)$/g, '').split(',').map(unwrap))
            if (!wanted.has(String(cell))) return false
            break
          }
          case 'is':
            if (val === 'null' && cell != null) return false
            if (val === 'not.null' && cell == null) return false
            break
          // `or=(…)`, `not.…`, text search and the rest are left alone rather than
          // guessed at — an unknown operator must not silently drop rows.
          default: break
        }
      }
      return true
    })
    return json(route, filtered)
  })

  // Fonts and any other third party: fail fast rather than hang the page for 30s.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort())
}
