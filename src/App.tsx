import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import FinancesHub from './pages/finances/FinancesHub'
import Finances from './pages/Finances'
import RecurringItems from './pages/RecurringItems'
import Tasks from './pages/Tasks'
import Documents from './pages/Documents'
import PropertyHub from './pages/property/PropertyHub'
import Overview from './pages/property/Overview'
import Details from './pages/property/Details'
import Rental from './pages/property/Rental'
import Insurance from './pages/property/Insurance'
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
          <Route path="finances" element={<FinancesHub />}>
            <Route index element={<Finances />} />
            <Route path="recurring" element={<RecurringItems />} />
          </Route>
          <Route path="recurring" element={<Navigate to="/finances/recurring" replace />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="documents" element={<Documents />} />
          <Route path="property" element={<PropertyHub />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="details" element={<Details />} />
            <Route path="mortgage" element={<Mortgage />} />
            <Route path="rental" element={<Rental />} />
            <Route path="insurance" element={<Insurance />} />
            <Route path="investment" element={<Investment />} />
          </Route>
          <Route path="mortgage" element={<Navigate to="/property/mortgage" replace />} />
          <Route path="investment" element={<Navigate to="/property/investment" replace />} />
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
