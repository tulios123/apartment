import { NavLink, Outlet } from 'react-router-dom'
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

  return (
    <div className="app-layout">
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
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
