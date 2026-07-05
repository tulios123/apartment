import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
import { ensurePushFresh } from '../../lib/push'
import FeedbackButton from '../FeedbackButton'
import { ErrorBoundary } from '../ErrorBoundary'

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

  // Lock the body to the viewport while inside the app shell (mobile), so iOS
  // Safari can't scroll the body and toggle its toolbars. Removed on unmount so
  // Onboarding/Login keep normal body scrolling.
  useEffect(() => {
    document.body.classList.add('app-locked')
    return () => document.body.classList.remove('app-locked')
  }, [])

  // .main-content is a persistent scroll container on mobile, so reset it to the
  // top on each route change (otherwise a new screen inherits the previous scroll).
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app-layout">
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
