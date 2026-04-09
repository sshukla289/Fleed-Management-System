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

function statusLabel(status: Vehicle['status']) {
  return status === 'Idle' ? 'Rest' : status
}

interface VehicleCardProps {
  vehicle: Vehicle
  onEdit?: (vehicle: Vehicle) => void
  onDelete?: (vehicle: Vehicle) => void
  onSelect?: (vehicle: Vehicle) => void
  isDeleting?: boolean
  selected?: boolean
  variant?: 'default' | 'tracking'
}

export function VehicleCard({
  vehicle,
  onEdit,
  onDelete,
  onSelect,
  isDeleting = false,
  selected = false,
  variant = 'default',
}: VehicleCardProps) {
  if (variant === 'tracking') {
    return (
      <article
        aria-pressed={selected}
        className={`vehicle-card vehicle-card--tracking${selected ? ' vehicle-card--tracking-selected' : ''}`}
        onClick={() => onSelect?.(vehicle)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect?.(vehicle)
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="vehicle-card__tracking-header">
          <div>
            <span className="vehicle-card__tracking-eyebrow">{vehicle.id}</span>
            <h3>{vehicle.name}</h3>
            <p className="muted">{vehicle.type}</p>
          </div>
          <span className={statusClassName(vehicle.status)}>{statusLabel(vehicle.status)}</span>
        </div>
        <div className="vehicle-card__tracking-visual">
          <div className="vehicle-card__tracking-truck" aria-hidden="true">
            <span className="vehicle-card__tracking-cab" />
            <span className="vehicle-card__tracking-trailer">
              <span className="vehicle-card__tracking-progress" style={{ width: `${vehicle.fuelLevel}%` }} />
            </span>
            <span className="vehicle-card__tracking-wheel vehicle-card__tracking-wheel--front" />
            <span className="vehicle-card__tracking-wheel vehicle-card__tracking-wheel--rear" />
          </div>
          <div className="vehicle-card__tracking-visual-copy">
            <strong>{vehicle.fuelLevel}% fuel</strong>
            <p>Fleet position from {vehicle.location}</p>
          </div>
        </div>
        <div className="vehicle-card__tracking-meta">
          <span className="badge">{vehicle.location}</span>
          <span className="badge">{vehicle.mileage.toLocaleString()} km</span>
        </div>
        <div className="vehicle-card__tracking-footer">
          <span className="muted">Driver {vehicle.driverId}</span>
          <span className="link-button">Track vehicle</span>
        </div>
      </article>
    )
  }

  return (
    <article className="vehicle-card card">
      <div className="vehicle-card__header">
        <div>
          <h3>{vehicle.name}</h3>
          <p className="muted">
            {vehicle.id} &middot; {vehicle.type}
          </p>
        </div>
        <span className={statusClassName(vehicle.status)}>{statusLabel(vehicle.status)}</span>
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
              aria-busy={isDeleting}
              aria-label={isDeleting ? 'Deleting...' : 'Delete'}
              className={`secondary-button danger-button loading-button${isDeleting ? ' is-loading' : ''}`}
              disabled={isDeleting}
              onClick={() => onDelete(vehicle)}
              type="button"
            >
              <span aria-hidden="true" className="loading-button__content">
                <span className="loading-button__label loading-button__label--default">Delete</span>
                <span className="loading-button__label loading-button__label--active">Deleting...</span>
              </span>
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
