import { supabase } from './supabase'

// Seamless fix-preview login. The per-fix Cloudflare preview lives on its own origin
// (claude-fix-<n>.<sub>.pages.dev), so the owner's session doesn't carry over and they'd
// otherwise have to log in again. Instead the admin console mints a one-time magic-link
// token (the preview-auth edge fn) and hands it to the preview in the URL *fragment*
// (#fbauth=…) — a fragment is never sent to any server, so the token stays client-side.
// Here (on the preview) we redeem it into a real session and scrub it from the address bar.

// The per-fix preview branch deploys carry a claude-fix- host prefix.
export function isPreviewHost(): boolean {
  try { return window.location.hostname.startsWith('claude-fix-') } catch { return false }
}

// Redeem a #fbauth=<token_hash> handoff if present. Returns true iff a session was set.
// Safe to call unconditionally (no-op without a token) and never throws — a failed redeem
// just falls through to the normal logged-out preview (the owner can log in manually).
export async function redeemPreviewAuth(): Promise<boolean> {
  try {
    const hash = window.location.hash || ''
    const m = hash.match(/[#&]fbauth=([^&]+)/)
    if (!m) return false
    const tokenHash = decodeURIComponent(m[1])

    // Scrub the token from the URL right away — before the app UI resolves — so it isn't
    // left in the address bar / history where it could be re-shared.
    const clean = window.location.pathname + window.location.search
    try { window.history.replaceState(null, '', clean) } catch { /* ignore */ }

    // A generateLink({type:'magiclink'}) token verifies as 'email' in supabase-js v2; older
    // shapes want 'magiclink'. Try 'email' first, fall back to 'magiclink'.
    let { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
    if (error) {
      const retry = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
      error = retry.error
    }
    if (error) { console.error('preview auth redeem failed:', error.message); return false }

    try { sessionStorage.setItem('fb_preview', '1') } catch { /* ignore */ }
    return true
  } catch (e) {
    console.error('preview auth redeem error:', e)
    return false
  }
}

// Are we inside a fix preview? True on the preview host, or once a handoff was redeemed
// (so the banner persists across in-app navigation on the preview origin).
export function inPreviewMode(): boolean {
  if (isPreviewHost()) return true
  try { return sessionStorage.getItem('fb_preview') === '1' } catch { return false }
}
