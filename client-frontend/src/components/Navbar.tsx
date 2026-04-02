import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { fetchDrivers, fetchRoutePlans, fetchVehicles } from '../services/apiService'
import type { Driver, RoutePlan, Vehicle } from '../types'

interface SearchResult {
  id: string
  label: string
  meta: string
  path: string
}

export function Navbar() {
  const { logout, session } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [routes, setRoutes] = useState<RoutePlan[]>([])
  const [isSearchReady, setIsSearchReady] = useState(false)

  useEffect(() => {
    async function loadSearchData() {
      const [vehicleData, driverData, routeData] = await Promise.all([
        fetchVehicles(),
        fetchDrivers(),
        fetchRoutePlans(),
      ])

      setVehicles(vehicleData)
      setDrivers(driverData)
      setRoutes(routeData)
      setIsSearchReady(true)
    }

    void loadSearchData()
  }, [])

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) {
      return []
    }

    const vehicleResults: SearchResult[] = vehicles
      .filter(
        (vehicle) =>
          vehicle.id.toLowerCase().includes(term) ||
          vehicle.name.toLowerCase().includes(term) ||
          vehicle.location.toLowerCase().includes(term),
      )
      .map((vehicle) => ({
        id: `vehicle-${vehicle.id}`,
        label: vehicle.name,
        meta: `${vehicle.id} · ${vehicle.location}`,
        path: `/vehicles/${vehicle.id}`,
      }))

    const driverResults: SearchResult[] = drivers
      .filter(
        (driver) =>
          driver.id.toLowerCase().includes(term) ||
          driver.name.toLowerCase().includes(term) ||
          driver.assignedVehicleId?.toLowerCase().includes(term),
      )
      .map((driver) => ({
        id: `driver-${driver.id}`,
        label: driver.name,
        meta: `${driver.id} · ${driver.status}`,
        path: `/drivers?highlight=${driver.id}`,
      }))

    const routeResults: SearchResult[] = routes
      .filter(
        (route) =>
          route.id.toLowerCase().includes(term) ||
          route.name.toLowerCase().includes(term) ||
          route.stops.some((stop) => stop.toLowerCase().includes(term)),
      )
      .map((route) => ({
        id: `route-${route.id}`,
        label: route.name,
        meta: `${route.id} · ${route.status}`,
        path: `/routes?highlight=${route.id}`,
      }))

    return [...vehicleResults, ...driverResults, ...routeResults].slice(0, 6)
  }, [drivers, query, routes, vehicles])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const firstResult = searchResults[0]
    if (firstResult) {
      navigate(firstResult.path)
      setQuery('')
      return
    }

    if (query.trim()) {
      navigate(`/vehicles?q=${encodeURIComponent(query.trim())}`)
      setQuery('')
    }
  }

  function handleResultSelect(path: string) {
    navigate(path)
    setQuery('')
  }

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <div className="navbar__logo">FM</div>
        <div className="navbar__copy">
          <h1>Fleet Command Center</h1>
          <p>Monitor vehicles, drivers, maintenance, and routes from one place.</p>
        </div>
      </div>
      <div className="navbar__actions">
        <form className="navbar__search-panel" onSubmit={handleSearchSubmit}>
          <input
            aria-label="Search fleet data"
            className="navbar__search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search vehicles, drivers, or routes"
            type="search"
            value={query}
          />
          {query.trim() ? (
            <div className="navbar__search-results">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    className="navbar__search-result"
                    onClick={() => handleResultSelect(result.path)}
                    type="button"
                  >
                    <strong>{result.label}</strong>
                    <span className="muted">{result.meta}</span>
                  </button>
                ))
              ) : (
                <div className="navbar__search-empty">
                  {isSearchReady
                    ? 'No exact match. Press Enter to open the vehicle list with this search.'
                    : 'Loading searchable fleet data...'}
                </div>
              )}
            </div>
          ) : null}
        </form>
        <Link className="navbar__profile" to="/profile">
          <span className="avatar">
            {session?.profile.name
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('') ?? 'FM'}
          </span>
          <div>
            <strong>{session?.profile.name ?? 'Fleet User'}</strong>
            <div className="muted">{session?.profile.role ?? 'View profile'}</div>
          </div>
        </Link>
        <button className="secondary-button navbar__logout" onClick={handleLogout} type="button">
          Sign out
        </button>
      </div>
    </header>
  )
}
