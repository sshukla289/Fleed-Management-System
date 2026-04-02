import { NavLink } from 'react-router-dom'

const navigation = [
  { label: 'Dashboard', path: '/dashboard', icon: '01' },
  { label: 'Vehicles', path: '/vehicles', icon: '02' },
  { label: 'Drivers', path: '/drivers', icon: '03' },
  { label: 'Maintenance', path: '/maintenance', icon: '04' },
  { label: 'Routes', path: '/routes', icon: '05' },
]

const secondaryNavigation = [
  { label: 'Profile', path: '/profile', icon: 'PR' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__section">
        <h2 className="sidebar__title">Navigation</h2>
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            className={({ isActive }) =>
              `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
            }
            to={item.path}
          >
            <span className="badge">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="sidebar__section">
        <h2 className="sidebar__title">Account</h2>
        {secondaryNavigation.map((item) => (
          <NavLink
            key={item.path}
            className={({ isActive }) =>
              `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
            }
            to={item.path}
          >
            <span className="badge">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </aside>
  )
}
