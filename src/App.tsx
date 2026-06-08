import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Finances from './pages/Finances'
import RecurringItems from './pages/RecurringItems'
import Tasks from './pages/Tasks'
import Documents from './pages/Documents'
import Property from './pages/Property'
import Settings from './pages/Settings'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <div className="app-loading">טוען...</div>
  if (!user) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="finances" element={<Finances />} />
          <Route path="recurring" element={<RecurringItems />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="documents" element={<Documents />} />
          <Route path="property" element={<Property />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
