import { House } from '@phosphor-icons/react'

// Branded full-screen loader shown while auth/property resolve on cold start —
// replaces the bare "טוען..." text so the first paint already feels like the product.
export function Splash({ caption = 'טוען את הנכס שלך…' }: { caption?: string }) {
  return (
    <div className="splash">
      <div className="splash-badge"><House size={44} weight="duotone" color="var(--accent)" /></div>
      <div className="splash-title">Apartment</div>
      <div className="splash-bar"><span className="splash-bar-fill" /></div>
      <div className="splash-caption">{caption}</div>
    </div>
  )
}
