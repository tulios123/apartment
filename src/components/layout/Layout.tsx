import { NavLink, Outlet } from 'react-router-dom'
import {
  House,
  Buildings,
  Wallet,
  ListChecks,
  FileText,
  GearSix,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useMonthlyGeneration } from '../../hooks/useMonthlyGeneration'
import { useAuth } from '../../contexts/AuthContext'

type NavItem = { to: string; label: string; icon: Icon; end?: boolean }

const navItems: NavItem[] = [
  { to: '/', label: 'ראשי', icon: House, end: true },
  { to: '/property', label: 'הנכס', icon: Buildings },
  { to: '/finances', label: 'כספים', icon: Wallet },
  { to: '/tasks', label: 'משימות', icon: ListChecks },
  { to: '/documents', label: 'מסמכים', icon: FileText },
  { to: '/settings', label: 'הגדרות', icon: GearSix },
]

export default function Layout() {
  useMonthlyGeneration()
  const { user, signOut } = useAuth()

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

      <main className="main-content">
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
