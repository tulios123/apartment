import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Finances from './pages/Finances'
import RecurringItems from './pages/RecurringItems'
import Tasks from './pages/Tasks'
import Documents from './pages/Documents'
import Property from './pages/Property'
import Investment from './pages/Investment'
import Mortgage from './pages/Mortgage'
import Settings from './pages/Settings'

function AppRoutes() {
  const { user, loading } = useAuth()
  const [hasProperty, setHasProperty] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) { setHasProperty(null); return }
    supabase
      .from('properties')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .then(({ data }) => setHasProperty((data?.length ?? 0) > 0))
  }, [user])

  if (loading || (user && hasProperty === null)) return <div className="app-loading">טוען...</div>
  if (!user) return <Login />
  if (!hasProperty) return <Onboarding onComplete={() => setHasProperty(true)} />

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
          <Route path="investment" element={<Investment />} />
          <Route path="mortgage" element={<Mortgage />} />
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
