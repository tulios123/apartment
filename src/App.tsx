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
import LiabilitiesHub from './pages/liabilities/LiabilitiesHub'
import Settings from './pages/Settings'
import SandboxContainer from './ux-sandbox/SandboxContainer'
import MinimalView from './ux-sandbox/variants/minimal/MinimalView'
import BentoView from './ux-sandbox/variants/bento/BentoView'
import EditorialView from './ux-sandbox/variants/editorial/EditorialView'

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

  // Isolated UX sandbox — bypasses auth/onboarding gates so it loads standalone.
  const sandboxPath = window.location.pathname
  if (sandboxPath.startsWith('/ux-sandbox')) {
    if (sandboxPath === '/ux-sandbox/minimal') return <MinimalView />
    if (sandboxPath === '/ux-sandbox/bento') return <BentoView />
    if (sandboxPath === '/ux-sandbox/editorial') return <EditorialView />
    return <SandboxContainer />
  }

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
          <Route path="property" element={<PropertyHub />} />
          <Route path="property/mortgage" element={<Navigate to="/liabilities/mortgage" replace />} />
          <Route path="property/:section" element={<PropertyHub />} />
          <Route path="liabilities" element={<LiabilitiesHub />} />
          <Route path="liabilities/:section" element={<LiabilitiesHub />} />
          <Route path="mortgage" element={<Navigate to="/liabilities/mortgage" replace />} />
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
