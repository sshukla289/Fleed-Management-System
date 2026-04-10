import { useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ROLE_LABELS, hasAnyRole, normalizeRole } from '../security/permissions'
import type { AppRole } from '../types'

const groups = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: '01', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'] },
      { label: 'Analytics', path: '/analytics/reports', icon: 'AR', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'] },
      { label: 'Notifications', path: '/notifications', icon: 'NT', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER'] },
      { label: 'Audit logs', path: '/audit-logs', icon: 'AU', roles: ['ADMIN', 'FLEET_MANAGER'] },
    ],
  },
  {
    title: 'Fleet control',
    items: [
      { label: 'Vehicles', path: '/vehicles', icon: '02', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'] },
      { label: 'Trips', path: '/trips', icon: '05', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER'] },
      { label: 'Alerts', path: '/alerts', icon: 'AL', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER'] },
      { label: 'Drivers', path: '/drivers', icon: '03', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER'] },
      { label: 'Maintenance', path: '/maintenance', icon: 'MT', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER'] },
      { label: 'Routes', path: '/routes', icon: '04', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER'] },
    ],
  },
  {
    title: 'Account',
    items: [{ label: 'Profile', path: '/profile', icon: 'PR', roles: ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER_PLANNER', 'MAINTENANCE_MANAGER', 'DRIVER'] }],
  },
] as const satisfies Array<{
  title: string
  items: Array<{
    label: string
    path: string
    icon: string
    roles: readonly AppRole[]
  }>
}>

export function Sidebar() {
  const { logout, session } = useAuth()
  const navigate = useNavigate()
  const role = session?.profile.role
  const normalizedRole = normalizeRole(role)
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAnyRole(role, item.roles)),
    }))
    .filter((group) => group.items.length > 0)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark">F</div>
        <div>
          <strong>Fleet Control</strong>
          <p>Operations workspace</p>
        </div>
      </div>

      <div className="sidebar__nav">
        {visibleGroups.map((group) => (
          <div key={group.title} className="sidebar__section">
            <h2 className="sidebar__title">{group.title}</h2>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
                to={item.path}
              >
                <span className="sidebar__icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar__footer">
        <div className="sidebar__profile">
          <span className="sidebar__avatar">
            {session?.profile.name
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('') ?? 'FM'}
          </span>
          <div>
            <strong>{session?.profile.name ?? 'Fleet User'}</strong>
            <p>{(normalizedRole && ROLE_LABELS[normalizedRole]) ?? session?.profile.role ?? 'Role unavailable'}</p>
          </div>
        </div>
        <button className="sidebar__logout" type="button" onClick={() => void handleLogout()}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
