// A tiny registry so any edit surface (Modal / BottomSheet header) can open the ONE
// global feedback sheet — which lives in FeedbackButton and renders elevated above the
// modal/sheet overlay. FeedbackButton registers its opener on mount and clears it on
// unmount, so `openFeedback()` from a dialog header opens feedback already scoped to the
// exact edit context (lib/editContext supplies the label automatically).
let opener: (() => void) | null = null

export function registerFeedbackOpener(fn: (() => void) | null) { opener = fn }

export function openFeedback() { opener?.() }
