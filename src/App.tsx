import { useState, useEffect, useCallback, useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AppReadyContext } from './contexts/AppReadyContext'
import { supabase } from './lib/supabase'
import Layout from './components/layout/Layout'
import { Splash } from './components/ui/Splash'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import HomeScreen from './pages/dashboard/HomeScreen'
import FinancesV2 from './pages/finances/FinancesV2'
import WealthHub from './pages/wealth/WealthHub'
import PropertyAdminHub from './pages/property/PropertyAdminHub'
import FinancesHub from './pages/finances/FinancesHub'
import Settings from './pages/Settings'
import DevNotes from './components/DevNotes'

function AppRoutes() {
  const { user, loading } = useAuth()
  const [hasProperty, setHasProperty] = useState<boolean | null>(null)
  // Keep the splash up until the first screen's data has loaded (markReady), so the
  // user goes straight from splash to a fully-populated app — no skeleton flash.
  const [appReady, setAppReady] = useState(false)
  const markReady = useCallback(() => setAppReady(true), [])
  const readyValue = useMemo(() => ({ markReady }), [markReady])

  useEffect(() => {
    if (!user) { setHasProperty(null); return }
    supabase
      .from('properties')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .then(({ data }) => setHasProperty((data?.length ?? 0) > 0))
  }, [user])

  // Safety ceiling: never trap the user behind the splash if no screen signals ready
  // (e.g. a query error, or a first route that isn't Home).
  useEffect(() => {
    if (appReady || loading || !user || !hasProperty) return
    const t = setTimeout(() => setAppReady(true), 5000)
    return () => clearTimeout(t)
  }, [appReady, loading, user, hasProperty])

  if (loading || (user && hasProperty === null)) return <Splash />
  if (!user) return <Login />
  if (!hasProperty) return <Onboarding onComplete={() => setHasProperty(true)} />

  return (
    <AppReadyContext.Provider value={readyValue}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomeScreen />} />
          <Route path="finances" element={<FinancesHub />}>
            <Route index element={<FinancesV2 />} />
            <Route path="recurring" element={<Navigate to="/finances" replace />} />
          </Route>
          <Route path="recurring" element={<Navigate to="/finances" replace />} />

          {/* Wealth (Investment) pillar */}
          <Route path="wealth" element={<WealthHub />} />
          <Route path="wealth/:section" element={<WealthHub />} />

          {/* Property Admin pillar */}
          <Route path="property" element={<PropertyAdminHub />} />
          <Route path="property/:section" element={<PropertyAdminHub />} />

          {/* Legacy deep-link redirects → new pillars */}
          <Route path="property/mortgage" element={<Navigate to="/wealth/liabilities" replace />} />
          <Route path="property/costs" element={<Navigate to="/wealth" replace />} />
          <Route path="property/investment" element={<Navigate to="/wealth" replace />} />
          <Route path="liabilities" element={<Navigate to="/wealth/liabilities" replace />} />
          <Route path="liabilities/:section" element={<Navigate to="/wealth/liabilities" replace />} />
          <Route path="mortgage" element={<Navigate to="/wealth/liabilities" replace />} />
          <Route path="investment" element={<Navigate to="/wealth" replace />} />
          <Route path="tasks" element={<Navigate to="/property/tasks" replace />} />
          <Route path="documents" element={<Navigate to="/property/documents" replace />} />

          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
    {!appReady && <div className="splash-overlay"><Splash /></div>}
    </AppReadyContext.Provider>
  )
}

// Notes overlay: in local dev, and for the dev@test.local manager account on the
// live app (so notes can be taken/copied across screens while reviewing in prod).
function DevNotesGate() {
  const { user } = useAuth()
  if (!(import.meta.env.DEV || user?.email === 'dev@test.local')) return null
  return <DevNotes />
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <DevNotesGate />
    </AuthProvider>
  )
}
