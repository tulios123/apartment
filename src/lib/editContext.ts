// Tracks which edit surface (modal / bottom sheet) is currently open — or was just
// open — so the feedback button can record "written inside עריכת חוזה", not merely
// "on the Property screen". The shared Modal and BottomSheet register their title
// here automatically, so every editor is covered without opting in one by one.

const stack: string[] = []
let lastClosed: string | null = null

/**
 * A modal/sheet registers its title while open. Returns the un-register cleanup —
 * call it on close/unmount. On close the label lingers as `lastClosed` so a note
 * written immediately after dismissing an editor still captures it (cleared on nav).
 */
export function pushEditContext(label: string | undefined | null): () => void {
  if (!label) return () => {}
  stack.push(label)
  return () => {
    const i = stack.lastIndexOf(label)
    if (i >= 0) stack.splice(i, 1)
    lastClosed = label
  }
}

/** The edit surface currently open, or the one just closed (until the next navigation). */
export function currentEditContext(): string | null {
  return stack.length ? stack[stack.length - 1] : lastClosed
}

/** Clear the lingering "last closed" edit — call on route change so it doesn't bleed. */
export function clearEditContext(): void {
  lastClosed = null
}
