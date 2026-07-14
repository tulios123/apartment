// Centralized manager/admin gate. The manager account (dev@test.local) is the only
// identity that may see manager-only surfaces (feedback inbox/bubble, "מילוי דוגמה"
// quick-fill, dev tools). Family members must never see these — so gate on the email
// strictly, not on import.meta.env.DEV, so a non-manager sees the same UI in dev too.
export const MANAGER_EMAIL = 'dev@test.local'

/** True only for the signed-in manager account. */
export function isManager(email: string | null | undefined): boolean {
  return email === MANAGER_EMAIL
}

// The feedback inbox + auto-fix pipeline are run from the owner's REAL account (not
// the dev/test manager). Kept separate from MANAGER_EMAIL so dev-tools / "מילוי דוגמה"
// stay on the test account while the feedback world belongs to the owner. Mirrors the
// feedback admin email in the RLS policies (migration 038).
export const FEEDBACK_ADMIN_EMAIL = 'itai.shubi@gmail.com'

// Extra admin emails via a build-time, comma-separated list. The staging build sets
// VITE_FEEDBACK_ADMIN_EMAILS to the staging TEST account, because that's the identity the
// owner is logged in as on staging — so it must see the console + the promote area. The
// edge functions mirror this at runtime via the FEEDBACK_ADMIN_EMAILS secret. Production
// defaults to just the owner.
const EXTRA_ADMINS = ((import.meta.env.VITE_FEEDBACK_ADMIN_EMAILS as string | undefined) || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
// tuliosking@gmail.com is the owner's dedicated MANAGEMENT account — a real Google account
// (so it logs into the installed iOS PWA reliably, unlike a magic-link account). It's a
// permanent admin on EVERY build (prod + staging), not a per-build test identity, so it's
// baked in here rather than passed via the build env. The RLS policies + edge functions
// mirror this (migration 045 / the FEEDBACK_ADMIN_EMAILS secret).
const ADMIN_SET = new Set<string>([
  FEEDBACK_ADMIN_EMAIL.toLowerCase(),
  'tuliosking@gmail.com',
  ...EXTRA_ADMINS,
])

/** True for the owner, plus any extra admin (e.g. the staging test account). */
export function isFeedbackAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_SET.has(email.toLowerCase())
}
