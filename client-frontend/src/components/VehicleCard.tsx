import { Link } from 'react-router-dom'
import type { Vehicle } from '../types'

function statusClassName(status: Vehicle['status']) {
  switch (status) {
    case 'Active':
      return 'badge badge--active'
    case 'Idle':
      return 'badge badge--idle'
    case 'Maintenance':
      return 'badge badge--maintenance'
    default:
      return 'badge'
  }
}

interface VehicleCardProps {
  vehicle: Vehicle
  onEdit?: (vehicle: Vehicle) => void
  onDelete?: (vehicle: Vehicle) => void
  isDeleting?: boolean
}

export function VehicleCard({ vehicle, onEdit, onDelete, isDeleting = false }: VehicleCardProps) {
  return (
    <article className="vehicle-card card">
      <div className="vehicle-card__header">
        <div>
          <h3>{vehicle.name}</h3>
          <p className="muted">
            {vehicle.id} · {vehicle.type}
          </p>
        </div>
        <span className={statusClassName(vehicle.status)}>{vehicle.status}</span>
      </div>
      <div className="vehicle-card__meta">
        <span className="badge">{vehicle.location}</span>
        <span className="badge">Fuel {vehicle.fuelLevel}%</span>
        <span className="badge">{vehicle.mileage.toLocaleString()} km</span>
      </div>
      <div className="vehicle-card__footer">
        <div className="muted">Assigned driver {vehicle.driverId}</div>
        <div className="card-actions">
          {onEdit ? (
            <button className="secondary-button" disabled={isDeleting} onClick={() => onEdit(vehicle)} type="button">
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button
              className="secondary-button danger-button"
              disabled={isDeleting}
              onClick={() => onDelete(vehicle)}
              type="button"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : null}
          <Link className="link-button" to={`/vehicles/${vehicle.id}`}>
            View details
          </Link>
        </div>
      </div>
    </article>
  )
}
