import { supabase } from './supabase'

// Seamless fix-preview login. The per-fix Cloudflare preview lives on its own origin
// (claude-fix-<n>.<sub>.pages.dev), so the owner's session doesn't carry over and they'd
// otherwise have to log in again. Instead the admin console (where the owner is already
// logged in) hands its OWN session to the preview in the URL *fragment* (#fbsess — never
// sent to any server), and here we adopt it with setSession. This is the same shape Supabase
// itself uses for implicit-flow OAuth redirects (access+refresh token in the fragment), and
// it's deterministic — no token-type guessing, no server round-trip — so it "just works"
// cross-origin. We scrub the fragment from the URL before the app UI resolves.

// The staging workspace lives on a fixed `staging.` host; older per-fix deploys used a
// claude-fix- prefix. Either counts as "not the real production app".
export function isPreviewHost(): boolean {
  try {
    const h = window.location.hostname
    return h.startsWith('staging.') || h.startsWith('claude-fix-')
  } catch { return false }
}

// Redeem a #fbsess handoff if present. Returns true iff a session was adopted. Safe to call
// unconditionally (no-op without the marker) and never throws — a failed adopt just falls
// through to the normal login screen (the owner can still sign in manually).
export async function redeemPreviewAuth(): Promise<boolean> {
  try {
    const hash = window.location.hash || ''
    if (!/[#&]fbsess=1/.test(hash)) return false
    const at = hash.match(/[#&]at=([^&]+)/)
    const rt = hash.match(/[#&]rt=([^&]+)/)

    // Scrub the tokens from the URL right away — before the app UI resolves — so they aren't
    // left in the address bar / history. replaceState swaps the current entry, so the
    // token-bearing URL never becomes a navigable history record.
    const clean = window.location.pathname + window.location.search
    try { window.history.replaceState(null, '', clean) } catch { /* ignore */ }

    if (!at || !rt) return false
    const { error } = await supabase.auth.setSession({
      access_token: decodeURIComponent(at[1]),
      refresh_token: decodeURIComponent(rt[1]),
    })
    if (error) { console.error('preview session adopt failed:', error.message); return false }

    try { sessionStorage.setItem('fb_preview', '1') } catch { /* ignore */ }
    return true
  } catch (e) {
    console.error('preview auth redeem error:', e)
    return false
  }
}

// Are we inside a fix preview? True on the preview host, or once a handoff was adopted (so
// the banner persists across in-app navigation on the preview origin).
export function inPreviewMode(): boolean {
  if (isPreviewHost()) return true
  try { return sessionStorage.getItem('fb_preview') === '1' } catch { return false }
}
