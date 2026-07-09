import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { User, CaretDown, Gear, ShieldCheck, FileText, PersonArmsSpread, SignOut } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import './user-menu.css'

// Avatar button in the top bar that opens an account/legal dropdown (mirrors the
// reference layout the owner liked). Portals to <body> to escape the bar's stacking
// context; scrim-tap / Esc / any item click closes it; focus returns to the avatar.
export default function UserMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => { setOpen(false); btnRef.current?.focus() }
  // Google sign-in gives us a profile photo (clearest "this is you"); email/manager
  // accounts fall back to a generic person icon. Either way a caret marks it as a menu.
  const photo = user?.user_metadata?.avatar_url as string | undefined

  return (
    <>
      <button
        ref={btnRef}
        className="usermenu-avatar"
        onClick={() => setOpen(true)}
        aria-label="חשבון ותפריט"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="usermenu-avatar-circle">
          {photo ? <img src={photo} alt="" className="usermenu-photo" /> : <User size={18} weight="fill" />}
        </span>
        <CaretDown size={12} weight="bold" className="usermenu-caret" />
      </button>

      {open && createPortal(
        <div className="usermenu-overlay" role="presentation" onClick={close}>
          <div className="usermenu-panel" role="menu" aria-label="תפריט חשבון" onClick={(e) => e.stopPropagation()}>
            <div className="usermenu-email">{user?.email}</div>
            <div className="usermenu-sep" />
            <Link to="/settings" className="usermenu-item" role="menuitem" onClick={close}>
              <Gear size={20} /><span>הגדרות</span>
            </Link>
            {/* language toggle would go here when English is added */}
            <div className="usermenu-sep" />
            <Link to="/legal/privacy" className="usermenu-item usermenu-item--quiet" role="menuitem" onClick={close}>
              <ShieldCheck size={18} /><span>מדיניות פרטיות</span>
            </Link>
            <Link to="/legal/terms" className="usermenu-item usermenu-item--quiet" role="menuitem" onClick={close}>
              <FileText size={18} /><span>תנאי שימוש</span>
            </Link>
            <Link to="/legal/accessibility" className="usermenu-item usermenu-item--quiet" role="menuitem" onClick={close}>
              <PersonArmsSpread size={18} /><span>נגישות</span>
            </Link>
            <div className="usermenu-sep" />
            <button className="usermenu-item usermenu-signout" role="menuitem" onClick={() => { setOpen(false); signOut() }}>
              <SignOut size={20} /><span>יציאה</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
