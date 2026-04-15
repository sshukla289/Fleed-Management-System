import { useEffect, useState } from 'react'
import {
  fetchDashboardAnalytics,
  fetchTripAnalytics,
  fetchAlerts
} from '../services/apiService'
import type { 
  DashboardAnalytics, 
  TripAnalytics, 
  Alert 
} from '../types'

export function OperationsDashboard() {
  const [dashData, setDashData] = useState<DashboardAnalytics | null>(null)
  const [tripStats, setTripStats] = useState<TripAnalytics | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const [dash, trip, al] = await Promise.all([
        fetchDashboardAnalytics(),
        fetchTripAnalytics(),
        fetchAlerts()
      ])
      setDashData(dash)
      setTripStats(trip)
      setAlerts(al.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH'))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load operations data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  if (loading) return <div className="dd-loading">Assembling operations intelligence...</div>

  return (
    <div className="dd">
      {message && <div className="dd-toast">{message}</div>}

      {/* Top: KPI Cards */}
      <section className="dd-topbar">
        <div className="dd-stats-row">
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#253B80' }}>{dashData?.activeTrips ?? 0}</span>
            <span className="dd-stat__l">Active Trips</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#ef4444' }}>{dashData?.delayedTrips ?? 0}</span>
            <span className="dd-stat__l">Delayed Trips</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#059669' }}>{dashData?.fleetReadinessPercent ?? 0}%</span>
            <span className="dd-stat__l">Fleet Readiness</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#7c3aed' }}>{tripStats?.fuelEfficiencyKmPerFuelUnit.toFixed(1) ?? 0}</span>
            <span className="dd-stat__l">km/Fuel Unit</span>
          </div>
        </div>
      </section>

      {/* Middle: Charts & Trends Section */}
      <div className="dd-grid" style={{ marginTop: '24px' }}>
        <div className="dd-grid__main">
          <section className="dd-card">
            <div className="dd-card__head">
              <h4>Fleet Performance Trends</h4>
              <span className="dd-pill dd-pill--blue">Last 7 Days</span>
            </div>
            <div className="dd-chart-mock" style={{ padding: '20px', height: '300px', display: 'flex', alignItems: 'flex-end', gap: '15px' }}>
              {/* Visualizing trends via styled divs since I don't have a chart lib */}
              {tripStats?.delayTrends.map((trend, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ 
                    width: '100%', 
                    background: 'linear-gradient(to top, #253B80, #3b82f6)', 
                    height: `${Math.min(trend.count * 10, 200)}px`,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease'
                  }} />
                  <small style={{ marginTop: '8px', fontSize: '10px', textAlign: 'center' }}>{trend.label.split(' ')[0]}</small>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom Table: Efficiency Report */}
          <section className="dd-card" style={{ marginTop: '24px' }}>
            <div className="dd-card__head"><h4>Route Efficiency Deep-Dive</h4></div>
            <div className="dd-tbl">
              <div className="dd-tbl__head">
                <span>Trip ID</span>
                <span>Status</span>
                <span>Fuel Usage</span>
                <span>Distance</span>
                <span>Delay</span>
              </div>
              {tripStats?.recentTrips.slice(0, 10).map(trip => (
                <div key={trip.tripId} className="dd-tbl__row">
                  <span><strong>{trip.tripId}</strong></span>
                  <span><span className={`dd-pill ${trip.status === 'COMPLETED' ? 'dd-pill--green' : 'dd-pill--blue'}`}>{trip.status}</span></span>
                  <span>{trip.fuelUsed?.toFixed(2) ?? '0.00'}</span>
                  <span>{trip.actualDistance} km</span>
                  <span style={{ color: (trip.delayMinutes ?? 0) > 30 ? '#ef4444' : 'inherit' }}>{trip.delayMinutes ?? 0}m</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Pane: Exceptions and Alerts */}
        <aside className="dd-grid__side">
          <div className="dd-block">
            <h4 className="dd-block__title">Critical Exceptions</h4>
            <div className="dd-alerts-list">
              {alerts.length > 0 ? (
                alerts.map(alert => (
                  <div key={alert.id} className="dd-notif dd-notif--block" style={{ marginBottom: '12px' }}>
                    <strong>{alert.title}</strong>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>{alert.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', opacity: 0.7 }}>
                      <small>{alert.category}</small>
                      <small>{new Date(alert.createdAt).toLocaleDateString()}</small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dd-notif dd-notif--clear">✅ All critical operations cleared</div>
              )}
            </div>
          </div>

          <div className="dd-block">
            <h4 className="dd-block__title">Fleet Health Distribution</h4>
            <div style={{ padding: '10px' }}>
              <div className="dd-health-bar" style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${dashData?.fleetReadinessPercent ?? 0}%`, background: '#059669' }} />
                <div style={{ width: `${100 - (dashData?.fleetReadinessPercent ?? 100)}%`, background: '#f59e0b' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem' }}>
                <span>Active: {dashData?.availableVehicles}</span>
                <span>In Maintenance: {dashData?.vehiclesInMaintenance}</span>
              </div>
            </div>
          </div>

          <div className="dd-block">
            <h4 className="dd-block__title">Personnel Overview</h4>
            <div className="dd-metrics-compact">
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Drivers On Duty</span>
                <strong>{dashData?.driversOnDuty}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Active Shifts</span>
                <strong>{dashData?.activeTrips}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
