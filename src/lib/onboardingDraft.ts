// Persist in-progress onboarding so an interruption (reload, iOS tab discard,
// OAuth round-trip back to Safari, crash) doesn't wipe everything the user typed
// (audit C2). Only the serializable wizard state is stored — File objects can't be
// serialized, so files stay re-pick-only (the AI-extraction cache makes the second
// read free). Keyed per user; cleared on a successful finish.

const PREFIX = 'onboarding_draft:'
// Bump when the snapshot shape changes so a stale draft is ignored, not mis-applied.
const VERSION = 1

export function loadOnboardingDraft<T>(userId: string | undefined): Partial<T> | null {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(PREFIX + userId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number } & Partial<T>
    if (parsed?.v !== VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function saveOnboardingDraft<T extends object>(userId: string | undefined, draft: T): void {
  if (!userId) return
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify({ v: VERSION, ...draft }))
  } catch {
    // Quota / private mode — persistence is best-effort, never block the wizard.
  }
}

export function clearOnboardingDraft(userId: string | undefined): void {
  if (!userId) return
  try {
    localStorage.removeItem(PREFIX + userId)
  } catch {
    // ignore
  }
}
