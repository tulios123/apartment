import { CircleNotch } from '@phosphor-icons/react'

/**
 * The one busy indicator. Anything that saves, uploads or otherwise makes the user
 * wait shows this, so "the app is thinking" always looks the same (owner, 28.07).
 *
 * It exists because `.spin` used to be defined only inside `.hs` (home-screen.css),
 * while the sheets that used it portal to <body> — so their "spinner" was a static
 * icon that never turned. The animation now lives globally in index.css.
 */
export function Spinner({ size = 16 }: { size?: number }) {
  return <CircleNotch className="spin" size={size} weight="bold" aria-hidden />
}

/** Button content that swaps to a turning spinner while busy. */
export function BusyLabel({ busy, busyText, children }: { busy: boolean; busyText: string; children: React.ReactNode }) {
  return busy ? <><Spinner /> {busyText}</> : <>{children}</>
}
