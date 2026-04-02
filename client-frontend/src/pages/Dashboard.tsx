import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { TelemetryChart } from '../components/TelemetryChart'
import { VehicleCard } from '../components/VehicleCard'
import { fetchDrivers, fetchMaintenanceAlerts, fetchVehicles } from '../services/apiService'
import { fetchVehicleTelemetry } from '../services/telemetryService'
import type { Driver, MaintenanceAlert, TelemetryData, Vehicle } from '../types'

export function Dashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([])
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([])

  useEffect(() => {
    async function loadDashboard() {
      const [vehicleData, driverData, alertData] = await Promise.all([
        fetchVehicles(),
        fetchDrivers(),
        fetchMaintenanceAlerts(),
      ])

      setVehicles(vehicleData)
      setDrivers(driverData)
      setAlerts(alertData)

      if (vehicleData[0]) {
        const telemetryData = await fetchVehicleTelemetry(vehicleData[0].id)
        setTelemetry(telemetryData)
      }
    }

    void loadDashboard()
  }, [])

  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'Active').length
  const driversOnDuty = drivers.filter((driver) => driver.status === 'On Duty').length

  function handleExportReport() {
    const report = {
      exportedAt: new Date().toISOString(),
      totals: {
        vehicles: vehicles.length,
        activeVehicles,
        drivers: drivers.length,
        driversOnDuty,
        alerts: alerts.length,
      },
      vehicles,
      alerts,
      telemetry,
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'fleet-dashboard-report.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations overview"
        title="Fleet dashboard"
        description="A command view for vehicle availability, route execution, and upcoming maintenance workload."
        actionLabel="Export report"
        onAction={handleExportReport}
      />

      <section className="hero-panel">
        <div>
          <span className="pill">Live fleet intelligence</span>
          <h1 className="hero-panel__title">Track movement, spot risks, and coordinate the next dispatch.</h1>
          <p className="hero-panel__description">
            Monitor live fleet activity, inspect duty coverage, and export the current operating
            snapshot for dispatch and workshop planning.
          </p>
          <div className="hero-panel__chips">
            <div className="metric-card">
              <span className="muted">Vehicles in service</span>
              <strong>{activeVehicles}/{vehicles.length || 0}</strong>
            </div>
            <div className="metric-card">
              <span className="muted">Drivers on duty</span>
              <strong>{driversOnDuty}</strong>
            </div>
            <div className="metric-card">
              <span className="muted">Open maintenance alerts</span>
              <strong>{alerts.length}</strong>
            </div>
          </div>
        </div>

        <div className="hero-panel__metrics">
          <StatCard
            label="Utilization"
            value={`${vehicles.length ? Math.round((activeVehicles / vehicles.length) * 100) : 0}%`}
            trend="+8% vs yesterday"
          />
          <StatCard
            label="Fuel efficiency"
            value="6.4 km/l"
            trend="Stable in the last 24h"
          />
          <StatCard
            label="On-time departures"
            value="93%"
            trend="+3 scheduled routes"
          />
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Connected vehicles" value={`${vehicles.length}`} trend="Mock API ready" />
        <StatCard label="Driver roster" value={`${drivers.length}`} trend="2 shifts active" />
        <StatCard
          label="Critical alerts"
          value={`${alerts.filter((alert) => alert.severity === 'Critical').length}`}
          trend="Prioritize workshop slots"
        />
      </section>

      {telemetry.length > 0 ? (
        <section className="charts-grid">
          <TelemetryChart data={telemetry} metric="speed" title="Speed profile" />
          <TelemetryChart data={telemetry} metric="fuelUsage" title="Fuel usage trend" />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Vehicle spotlight</h3>
            <p className="muted">Sample cards showing how fleet units can be rendered on overview pages.</p>
          </div>
        </div>
        <div className="list-grid">
          {vehicles.slice(0, 3).map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      </section>
    </div>
  )
}
