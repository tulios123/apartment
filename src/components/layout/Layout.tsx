import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { List, X } from '@phosphor-icons/react'
import { useMonthlyGeneration } from '../../hooks/useMonthlyGeneration'
import { useAuth } from '../../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'ראשי', end: true },
  { to: '/property', label: 'הנכס' },
  { to: '/finances', label: 'כספים' },
  { to: '/tasks', label: 'משימות' },
  { to: '/documents', label: 'מסמכים' },
  { to: '/settings', label: 'הגדרות' },
]

export default function Layout() {
  useMonthlyGeneration()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  function close() { setOpen(false) }

  return (
    <div className="app-layout">
      {/* Desktop sidebar */}
      <nav className="sidebar">
        <div className="sidebar-title">ניהול דירה</div>
        {navItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <div className="sidebar-user">{user?.email}</div>
          <button className="btn-signout" onClick={signOut}>יציאה</button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setOpen(true)} aria-label="פתח תפריט">
          <List size={22} weight="bold" />
        </button>
        <span className="mobile-header-title">ניהול דירה</span>
      </header>

      {/* Drawer overlay */}
      {open && <div className="drawer-overlay" onClick={close} />}

      {/* Mobile drawer */}
      <nav className={`drawer${open ? ' drawer-open' : ''}`} aria-hidden={!open}>
        <div className="drawer-header">
          <span className="drawer-title">ניהול דירה</span>
          <button className="btn-icon" onClick={close} aria-label="סגור"><X size={20} /></button>
        </div>
        {navItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={close}
          >
            {label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <div className="sidebar-user">{user?.email}</div>
          <button className="btn-signout" onClick={() => { close(); signOut() }}>יציאה</button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
