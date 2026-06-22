// Tiny haptic helper. navigator.vibrate is a progressive enhancement: it fires on
// Android/Chrome but is a no-op on iOS Safari (which exposes no web vibration API),
// so callers should treat it as a bonus, never a guaranteed cue.
export const tap = (ms = 8) => {
  try { navigator.vibrate?.(ms) } catch { /* unsupported — ignore */ }
}
