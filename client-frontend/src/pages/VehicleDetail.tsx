import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapView } from '../components/MapView'
import { PageHeader } from '../components/PageHeader'
import { TelemetryChart } from '../components/TelemetryChart'
import { fetchVehicleById } from '../services/apiService'
import { fetchVehicleTelemetry } from '../services/telemetryService'
import type { TelemetryData, Vehicle } from '../types'

export function VehicleDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [vehicle, setVehicle] = useState<Vehicle | undefined>()
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadVehicleDetail() {
      setError(null)

      try {
        const vehicleData = await fetchVehicleById(id)
        setVehicle(vehicleData)

        if (vehicleData) {
          const telemetryData = await fetchVehicleTelemetry(vehicleData.id)
          setTelemetry(telemetryData)
        }
      } catch (loadError) {
        setTelemetry([])
        setError(loadError instanceof Error ? loadError.message : 'Unable to load vehicle detail telemetry.')
      }
    }

    void loadVehicleDetail()
  }, [id])

  if (!vehicle) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Vehicle"
          title="Vehicle not found"
          description="The selected vehicle could not be loaded from the active fleet records."
        />
        <div className="empty-state">Try selecting a vehicle from the vehicle list page.</div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Vehicle telemetry"
        title={`${vehicle.name} details`}
        description="Review live telemetry, route context, and maintenance readiness for this vehicle."
        actionLabel="Schedule service"
        onAction={() =>
          navigate(`/maintenance?vehicleId=${encodeURIComponent(vehicle.id)}&openCreate=1`)
        }
      />
      <section className="detail-grid">
        <div className="detail-section">
          {error ? <div className="notice">{error}</div> : null}
          <div className="panel">
            <div className="detail-section__header">
              <div>
                <h3>{vehicle.id}</h3>
                <p className="muted">
                  {vehicle.type} operating from {vehicle.location}
                </p>
              </div>
              <span className="badge">{vehicle.status}</span>
            </div>
            <div className="detail-meta">
              <span className="badge">Fuel {vehicle.fuelLevel}%</span>
              <span className="badge">{vehicle.mileage.toLocaleString()} km</span>
              <span className="badge">Driver {vehicle.driverId}</span>
            </div>
            <div className="detail-kpis">
              <div className="card">
                <span className="muted">Avg speed</span>
                <strong>61 km/h</strong>
              </div>
              <div className="card">
                <span className="muted">Fuel burn</span>
                <strong>14 l/h</strong>
              </div>
              <div className="card">
                <span className="muted">Engine temp</span>
                <strong>92 C</strong>
              </div>
            </div>
          </div>

          {telemetry.length > 0 ? (
            <TelemetryChart data={telemetry} metric="engineTemperature" title="Engine temperature" />
          ) : null}
        </div>

        <MapView
          title="Route footprint"
          stops={[vehicle.location, 'Checkpoint Alpha', 'Checkpoint Bravo', 'Destination']}
        />
      </section>
    </div>
  )
}
