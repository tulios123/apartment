// When a capture sheet is dismissed (scrim-tap / Esc / swipe-down / X), decide
// whether to ask before throwing the draft away — the Google Tasks behaviour the
// owner asked for (#28). We only interrupt when there's actually unsaved content
// and the form is idle; an empty draft, or one mid-save/just-saved, closes silently.
export function shouldConfirmDiscard(hasData: boolean, state: 'idle' | 'saving' | 'done'): boolean {
  return hasData && state === 'idle'
}
