import { useEffect, useState, useMemo } from 'react'
import { MapView } from '../components/MapView'
import {
  fetchTrips,
  fetchDrivers,
  fetchVehicles,
  fetchAlerts,
  updateTrip
} from '../services/apiService'
import type { Trip, Driver, Vehicle, Alert, UpdateTripInput } from '../types'

export function DispatcherDashboard() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [assigningDriverId, setAssigningDriverId] = useState<string>('')

  const activeTrips = useMemo(() => trips.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED'), [trips])
  const selectedTrip = useMemo(() => trips.find(t => t.tripId === selectedTripId), [selectedTripId, trips])

  async function loadData() {
    setLoading(true)
    try {
      const [t, d, v, a] = await Promise.all([
        fetchTrips(),
        fetchDrivers(),
        fetchVehicles(),
        fetchAlerts()
      ])
      setTrips(t)
      setDrivers(d)
      setVehicles(v)
      setAlerts(a.filter(al => al.status !== 'RESOLVED'))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load dispatcher data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    const interval = setInterval(() => { void loadData() }, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(t)
  }, [message])

  const handleAssign = async () => {
    if (!selectedTripId || !assigningDriverId) return
    setWorking(true)
    try {
      // Logic for assignment: update the trip with the new driver
      const input: UpdateTripInput = {
        assignedDriverId: assigningDriverId
      }
      await updateTrip(selectedTripId, input)
      await loadData()
      setMessage(`Assigned driver ${assigningDriverId} to trip ${selectedTripId}`)
      setSelectedTripId(null)
      setAssigningDriverId('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Assignment failed')
    } finally {
      setWorking(false)
    }
  }

  if (loading && trips.length === 0) {
    return <div className="dd-loading">Syncing fleet status...</div>
  }

  // Map data: use all active trip destinations as "stops" to show coverage
  const mapStops = activeTrips.map(t => t.destination)

  return (
    <div className="dd">
      {message && <div className="dd-toast">{message}</div>}

      {/* Top: Active Trips Summary */}
      <section className="dd-topbar" style={{ marginBottom: '24px' }}>
        <div className="dd-stats-row">
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#253B80' }}>{activeTrips.length}</span>
            <span className="dd-stat__l">Live Trips</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#10b981' }}>{drivers.filter(d => d.status === 'On Duty').length}</span>
            <span className="dd-stat__l">Drivers On Duty</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#ef4444' }}>{alerts.length}</span>
            <span className="dd-stat__l">Active Alerts</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#0ea5e9' }}>{vehicles.filter(v => v.status === 'Active').length}</span>
            <span className="dd-stat__l">Vehicles Active</span>
          </div>
        </div>
        <button className="dd-btn dd-btn--ghost" onClick={() => void loadData()}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /></svg>
          Refresh
        </button>
      </section>

      {/* Main Grid */}
      <div className="dd-grid">
        {/* Left: Map */}
        <div className="dd-grid__main">
          <div className="dd-map-wrap">
            <MapView title="Fleet Coverage Map" stops={mapStops.length > 0 ? mapStops : ['HQ']} />
          </div>

          {/* Active Trips Table */}
          <section className="dd-card" style={{ marginTop: '24px' }}>
            <div className="dd-card__head"><h4>Live Trip Monitoring</h4></div>
            <div className="dd-tbl">
              <div className="dd-tbl__head">
                <span>Trip ID</span>
                <span>Status</span>
                <span>Driver</span>
                <span>Destination</span>
              </div>
              {activeTrips.map(t => (
                <button 
                  key={t.tripId} 
                  className={`dd-tbl__row ${selectedTripId === t.tripId ? 'dd-tbl__row--sel' : ''}`}
                  onClick={() => {
                    setSelectedTripId(t.tripId)
                    setAssigningDriverId(t.assignedDriverId || '')
                  }}
                >
                  <span><strong>{t.tripId}</strong></span>
                  <span><span className={`dd-pill ${t.status === 'IN_PROGRESS' ? 'dd-pill--blue' : 'dd-pill--amber'}`}>{t.status}</span></span>
                  <span>{t.assignedDriverId || <em className="muted">Unassigned</em>}</span>
                  <span>{t.destination}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Side Panels */}
        <aside className="dd-grid__side">
          {/* Driver Assignment Panel */}
          <div className="dd-block">
            <h4 className="dd-block__title">Driver Assignment</h4>
            {selectedTrip ? (
              <div className="dd-form">
                <p><small>Assigning to </small><strong>{selectedTripId}</strong></p>
                <label className="dd-form__full">
                  <small>Select Driver</small>
                  <select 
                    value={assigningDriverId} 
                    onChange={e => setAssigningDriverId(e.target.value)}
                    style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: '8px', borderRadius: '6px', width: '100%' }}
                  >
                    <option value="">-- Choose Driver --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="dd-btn dd-btn--primary" style={{ flex: 1 }} onClick={handleAssign} disabled={working}>Assign Driver</button>
                  <button className="dd-btn dd-btn--ghost" onClick={() => setSelectedTripId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <p className="muted">Select a trip from the table to reassign or assign a driver.</p>
            )}
          </div>

          {/* Alerts Panel */}
          <div className="dd-block">
            <h4 className="dd-block__title">Active Alerts</h4>
            <div className="dd-alerts-list">
              {alerts.length > 0 ? (
                alerts.slice(0, 10).map(alert => (
                  <div key={alert.id} className={`dd-notif dd-notif--${alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'block' : 'warn'}`} style={{ marginBottom: '8px' }}>
                    <strong>{alert.title}</strong>
                    <small style={{ display: 'block' }}>{alert.category} | {new Date(alert.createdAt).toLocaleTimeString()}</small>
                  </div>
                ))
              ) : (
                <div className="dd-notif dd-notif--clear">✅ No active operations alerts</div>
              )}
            </div>
          </div>

          {/* Vehicle Status Panel */}
          <div className="dd-block">
            <h4 className="dd-block__title">Fleet Health</h4>
            <div className="dd-metrics-compact">
              {vehicles.slice(0, 5).map(v => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>{v.id}</span>
                  <span className={`dd-pill ${v.status === 'Active' ? 'dd-pill--green' : 'dd-pill--amber'}`} style={{ fontSize: '0.65rem' }}>{v.status}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
