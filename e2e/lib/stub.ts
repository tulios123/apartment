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
    // PostgREST filters are in the query string; the fixtures are small and per-screen,
    // so serve the table whole and let the app filter. Only `in.(...)` on title is
    // honoured, because the checklist's once-only check depends on it.
    const rows = fixture[table] ?? []
    const url = new URL(route.request().url())
    const titleFilter = url.searchParams.get('title')
    if (titleFilter?.startsWith('in.')) {
      const wanted = new Set(titleFilter.slice(3).replace(/^\(|\)$/g, '').split(',')
        .map((v) => v.replace(/^"|"$/g, '')))
      return json(route, rows.filter((r) => wanted.has((r as { title?: string }).title ?? '')))
    }
    return json(route, rows)
  })

  // Fonts and any other third party: fail fast rather than hang the page for 30s.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort())
}
