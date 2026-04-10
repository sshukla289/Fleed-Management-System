import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'
import { useAuth } from './context/useAuth'
import { hasAnyRole } from './security/permissions'
import { Dashboard } from './pages/Dashboard'
import { AnalyticsReports } from './pages/AnalyticsReports'
import { AuditLogs } from './pages/AuditLogs'
import { AlertsCenter } from './pages/AlertsCenter'
import { DriverList } from './pages/DriverList'
import { Login } from './pages/Login'
import { MaintenanceAlerts } from './pages/MaintenanceAlerts'
import { Profile } from './pages/Profile'
import { RoutePlanner } from './pages/RoutePlanner'
import { Trips } from './pages/Trips'
import { Notifications } from './pages/Notifications'
import { VehicleDetail } from './pages/VehicleDetail'
import { VehicleList } from './pages/VehicleList'
import type { AppRole } from './types'
import './App.css'

function ProtectedLayout() {
  const { isAuthenticated, isLoadingSession } = useAuth()

  if (isLoadingSession) {
    return <div className="page-shell">Loading session...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AppLayout />
}

function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-shell__body">
        <Sidebar />
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function defaultPathForRole(role: string | undefined): string {
  if (hasAnyRole(role, ['DRIVER'])) {
    return '/trips'
  }

  if (hasAnyRole(role, ['MAINTENANCE_MANAGER'])) {
    return '/maintenance'
  }

  if (hasAnyRole(role, ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER'])) {
    return '/dashboard'
  }

  return '/profile'
}

function RoleRoute({ allowedRoles }: { allowedRoles: AppRole[] }) {
  const { session } = useAuth()

  if (!hasAnyRole(session?.profile.role, allowedRoles)) {
    return <Navigate to={defaultPathForRole(session?.profile.role)} replace />
  }

  return <Outlet />
}

function App() {
  const { isAuthenticated, isLoadingSession, session } = useAuth()
  const defaultPath = defaultPathForRole(session?.profile.role)

  if (isLoadingSession) {
    return <div className="page-shell">Loading session...</div>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={defaultPath} replace /> : <Login />}
      />
      <Route element={<ProtectedLayout />}>
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? defaultPath : '/login'} replace />}
        />
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER']} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics/reports" element={<AnalyticsReports />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'FLEET_MANAGER']} />}>
          <Route path="/audit-logs" element={<AuditLogs />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER']} />}>
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/alerts" element={<AlertsCenter />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER']} />}>
          <Route path="/vehicles" element={<VehicleList />} />
          <Route path="/vehicles/:id" element={<VehicleDetail />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER']} />}>
          <Route path="/drivers" element={<DriverList />} />
          <Route path="/routes" element={<RoutePlanner />} />
        </Route>
        <Route element={<RoleRoute allowedRoles={['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER']} />}>
          <Route path="/maintenance" element={<MaintenanceAlerts />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
