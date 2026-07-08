import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import {
  House,
  Wallet,
  TrendUp,
  Buildings,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useMonthlyGeneration } from '../../hooks/useMonthlyGeneration'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeNotifTarget } from '../../lib/notifNav'
import { ensurePushFresh, isIOS } from '../../lib/push'
import { clearEditContext } from '../../lib/editContext'
import FeedbackButton from '../FeedbackButton'
import UserMenu from './UserMenu'
import { ErrorBoundary } from '../ErrorBoundary'
import './topbar.css'

type NavItem = { to: string; label: string; icon: Icon; end?: boolean }

// 4-Pillar Model: Home (operations) · Ledger (cashflow) · Wealth (investment) · Property Admin (archive)
const navItems: NavItem[] = [
  { to: '/', label: 'ראשי', icon: House, end: true },
  { to: '/finances', label: 'תזרים', icon: Wallet },
  { to: '/wealth', label: 'הון', icon: TrendUp },
  { to: '/property', label: 'ניהול', icon: Buildings },
]

export default function Layout() {
  useMonthlyGeneration()
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)

  // A notification tap routes in-app (SPA) via the root-level bridge, which also
  // replays a target buffered before the Router mounted (EDGE-08).
  useEffect(() => subscribeNotifTarget((url) => navigate(url)), [navigate])

  // EDGE-11: if the browser rotated/expired the push endpoint, the stored
  // subscription is dead and pushes silently stop. When the app opens and
  // permission is still granted, transparently re-subscribe so delivery resumes.
  useEffect(() => {
    if (user) ensurePushFresh(user.id)
  }, [user])

  // Lock the body to the viewport while inside the app shell — iOS ONLY. This
  // workaround exists purely because iOS Safari scrolls the body and toggles its
  // toolbars on scroll. Android Chrome handles toolbar collapse fine with normal
  // document scroll, and a position:fixed body + inner scroller there causes janky /
  // stuck scrolling — so on Android (and everything non-iOS) we skip the lock and let
  // the document scroll naturally. Removed on unmount so Onboarding/Login are unaffected.
  useEffect(() => {
    if (!isIOS()) return
    document.body.classList.add('app-locked')
    return () => document.body.classList.remove('app-locked')
  }, [])

  // Reset scroll to the top on each route change (otherwise a new screen inherits the
  // previous scroll). On iOS the scroller is the inner .main-content; on Android it's
  // the document — reset both so it works on either path.
  // Also drop any lingering "last edit" so feedback context doesn't bleed across screens.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
    window.scrollTo(0, 0)
    clearEditContext()
  }, [pathname])

  return (
    <div className="app-layout">
      {/* Mobile top bar — app title (start/right) + account & legal menu (end/left) */}
      <header className="app-topbar">
        <span className="app-topbar-title">ניהול דירה</span>
        <UserMenu />
      </header>

      {/* Desktop sidebar */}
      <nav className="sidebar">
        <div className="sidebar-title">ניהול דירה</div>
        {navItems.map(({ to, label, icon: Ico, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {({ isActive }) => (
              <>
                <Ico size={18} weight={isActive ? 'fill' : 'regular'} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <div className="sidebar-user">{user?.email}</div>
          <button className="btn-signout" onClick={signOut}>יציאה</button>
          <div className="sidebar-legal">
            <Link to="/legal/privacy">פרטיות</Link>
            <Link to="/legal/terms">תנאים</Link>
            <Link to="/legal/accessibility">נגישות</Link>
          </div>
        </div>
      </nav>

      <main className="main-content" ref={mainRef}>
        {/* Per-route boundary: a crash in one screen keeps the shell + nav intact
            and resets when the user navigates to another tab (keyed on pathname). */}
        <ErrorBoundary variant="inline" boundary={pathname} key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <FeedbackButton />

      {/* Mobile bottom tab bar */}
      <nav className="bottom-nav" aria-label="ניווט ראשי">
        {navItems.map(({ to, label, icon: Ico, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'bottom-nav-link active' : 'bottom-nav-link')}
          >
            {({ isActive }) => (
              <>
                <Ico size={23} weight={isActive ? 'fill' : 'regular'} />
                <span className="bottom-nav-label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
