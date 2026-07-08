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

/** True only for the signed-in feedback admin (the owner's real account). */
export function isFeedbackAdmin(email: string | null | undefined): boolean {
  return email === FEEDBACK_ADMIN_EMAIL
}
