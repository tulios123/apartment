import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  House,
  Wallet,
  TrendUp,
  FolderOpen,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useMonthlyGeneration } from '../../hooks/useMonthlyGeneration'
import { useAuth } from '../../contexts/AuthContext'

type NavItem = { to: string; label: string; icon: Icon; end?: boolean }

// 4-Pillar Model: Home (operations) · Ledger (cashflow) · Wealth (investment) · Property Admin (archive)
const navItems: NavItem[] = [
  { to: '/', label: 'ראשי', icon: House, end: true },
  { to: '/finances', label: 'תזרים', icon: Wallet },
  { to: '/wealth', label: 'הון', icon: TrendUp },
  { to: '/property', label: 'ניהול', icon: FolderOpen },
]

export default function Layout() {
  useMonthlyGeneration()
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef<HTMLElement>(null)

  // A notification tap, when the app is already open, postMessages from the
  // service worker — route in-app (SPA) instead of triggering a full reload.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string') navigate(e.data.url)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

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
        <Outlet />
      </main>

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
