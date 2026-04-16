import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { VehicleCard } from '../components/VehicleCard'
import { useAuth } from '../context/useAuth'
import { canManageVehicles } from '../security/permissions'
import { createVehicle, deleteVehicle, fetchVehicles, updateVehicle } from '../services/apiService'
import type { CreateVehicleInput, Vehicle } from '../types'

const initialForm: CreateVehicleInput = {
  name: '',
  type: 'Heavy Truck',
  status: 'Active',
  location: '',
  fuelLevel: 50,
  mileage: 0,
  driverId: '',
}

const vehicleStatusFilters: Array<{ label: string; value: 'All' | Vehicle['status'] }> = [
  { label: 'All', value: 'All' },
  { label: 'Active', value: 'Active' },
  { label: 'Rest', value: 'Idle' },
  { label: 'Maintenance', value: 'Maintenance' },
]

function formatVehicleNumericInput(value: string, options?: { maxValue?: number }) {
  if (!value) {
    return ''
  }

  if (!/^\d*\.?\d*$/.test(value)) {
    return value
  }

  const limitedValue = (() => {
    if (!value.includes('.')) {
      return value
    }

    const [integerPart, fractionalPart] = value.split('.', 2)
    return `${integerPart}.${fractionalPart.slice(0, 2)}`
  })()

  if (limitedValue === '.') {
    return '0.'
  }

  const normalizedValue = limitedValue.startsWith('.') ? `0${limitedValue}` : limitedValue
  const parsedValue = Number(normalizedValue)

  if (Number.isNaN(parsedValue)) {
    return normalizedValue
  }

  if (typeof options?.maxValue === 'number' && parsedValue > options.maxValue) {
    return String(options.maxValue)
  }

  if (parsedValue >= 10) {
    if (normalizedValue.includes('.')) {
      const [integerPart, fractionalPart] = normalizedValue.split('.', 2)
      return `${String(Number(integerPart))}.${fractionalPart}`
    }

    return String(parsedValue)
  }

  if (normalizedValue.includes('.')) {
    const [integerPart, fractionalPart] = normalizedValue.split('.', 2)
    const paddedIntegerPart =
      integerPart && integerPart !== '0' ? integerPart.padStart(2, '0') : integerPart

    return `${paddedIntegerPart}.${fractionalPart}`
  }

  if (/^\d$/.test(normalizedValue) && normalizedValue !== '0') {
    return normalizedValue.padStart(2, '0')
  }

  if (/^0\d+$/.test(normalizedValue)) {
    return String(parsedValue).padStart(2, '0')
  }

  return normalizedValue
}

function statusLabel(status: Vehicle['status']) {
  return status === 'Idle' ? 'Rest' : status
}

function toneClass(tone: string) {
  return `dashboard-summary-card tone-${tone}`
}

function statusPillClass(status: Vehicle['status']) {
  switch (status) {
    case 'Active':
      return 'status-pill status-pill--mint'
    case 'Idle':
      return 'status-pill status-pill--amber'
    case 'Maintenance':
      return 'status-pill status-pill--rose'
    default:
      return 'status-pill'
  }
}

export function VehicleList() {
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | Vehicle['status']>('All')
  const [showForm, setShowForm] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null)
  const [fuelLevelInput, setFuelLevelInput] = useState('50')
  const [mileageInput, setMileageInput] = useState('0')
  const [form, setForm] = useState<CreateVehicleInput>(initialForm)
  const [error, setError] = useState('')
  const query = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const canManage = canManageVehicles(session?.profile.role)

  useEffect(() => {
    void fetchVehicles().then((vehicleData) => {
      setVehicles(vehicleData)
      if (vehicleData[0]) {
        setSelectedVehicleId(vehicleData[0].id)
      }
    })
  }, [])

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const matchesQuery =
          !query ||
          vehicle.id.toLowerCase().includes(query) ||
          vehicle.name.toLowerCase().includes(query) ||
          vehicle.location.toLowerCase().includes(query) ||
          (vehicle.driverId ?? '').toLowerCase().includes(query)
        const matchesStatus = statusFilter === 'All' || vehicle.status === statusFilter
        return matchesQuery && matchesStatus
      }),
    [query, statusFilter, vehicles],
  )

  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    filteredVehicles[0] ??
    vehicles[0]

  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'Active').length
  const idleVehicles = vehicles.filter((vehicle) => vehicle.status === 'Idle').length
  const serviceVehicles = vehicles.filter((vehicle) => vehicle.status === 'Maintenance').length
  const lowFuelVehicles = vehicles.filter((vehicle) => vehicle.fuelLevel < 40).length
  const averageFuelLevel = vehicles.length
    ? Math.round(vehicles.reduce((sum, vehicle) => sum + vehicle.fuelLevel, 0) / vehicles.length)
    : 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const parsedFuelLevel = Number(fuelLevelInput)
    if (
      !fuelLevelInput.trim() ||
      Number.isNaN(parsedFuelLevel) ||
      parsedFuelLevel < 0 ||
      parsedFuelLevel > 100
    ) {
      setError('Fuel level must be a valid percentage between 0 and 100.')
      return
    }

    const parsedMileage = Number(mileageInput)
    if (!mileageInput.trim() || Number.isNaN(parsedMileage) || parsedMileage < 0) {
      setError('Mileage must be a valid non-negative number.')
      return
    }

    const nextForm = {
      ...form,
      fuelLevel: parsedFuelLevel,
      mileage: parsedMileage,
    }

    try {
      if (editingVehicleId) {
        const updatedVehicle = await updateVehicle(editingVehicleId, nextForm)
        setVehicles((current) =>
          current.map((vehicle) => (vehicle.id === updatedVehicle.id ? updatedVehicle : vehicle)),
        )
        setSelectedVehicleId(updatedVehicle.id)
      } else {
        const createdVehicle = await createVehicle(nextForm)
        setVehicles((current) => [...current, createdVehicle])
        setSelectedVehicleId(createdVehicle.id)
      }

      resetForm()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save vehicle.')
    }
  }

  async function handleDelete(vehicle: Vehicle) {
    setError('')
    setDeletingVehicleId(vehicle.id)

    try {
      await deleteVehicle(vehicle.id)
      setVehicles((current) => {
        const remainingVehicles = current.filter((item) => item.id !== vehicle.id)
        if (selectedVehicleId === vehicle.id) {
          setSelectedVehicleId(remainingVehicles[0]?.id ?? '')
        }

        return remainingVehicles
      })
      if (editingVehicleId === vehicle.id) {
        resetForm()
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete vehicle.')
    } finally {
      setDeletingVehicleId((current) => (current === vehicle.id ? null : current))
    }
  }

  function handleEdit(vehicle: Vehicle) {
    setForm({
      name: vehicle.name,
      type: vehicle.type,
      status: vehicle.status,
      location: vehicle.location,
      fuelLevel: vehicle.fuelLevel,
      mileage: vehicle.mileage,
      driverId: vehicle.driverId,
    })
    setFuelLevelInput(formatVehicleNumericInput(String(vehicle.fuelLevel), { maxValue: 100 }))
    setMileageInput(formatVehicleNumericInput(String(vehicle.mileage)))
    setEditingVehicleId(vehicle.id)
    setSelectedVehicleId(vehicle.id)
    setShowForm(true)
    setError('')
  }

  function resetForm() {
    setForm(initialForm)
    setFuelLevelInput(formatVehicleNumericInput(String(initialForm.fuelLevel), { maxValue: 100 }))
    setMileageInput(formatVehicleNumericInput(String(initialForm.mileage)))
    setEditingVehicleId(null)
    setShowForm(false)
    setError('')
  }

  const kpis = [
    { key: 'total', label: 'Total fleet', value: vehicles.length, note: 'Units in inventory', tone: 'blue' },
    { key: 'active', label: 'Active', value: activeVehicles, note: 'Currently dispatched', tone: 'mint' },
    { key: 'rest', label: 'Rest', value: idleVehicles, note: 'Idle or between trips', tone: 'amber' },
    { key: 'service', label: 'Service bay', value: serviceVehicles, note: 'Undergoing maintenance', tone: 'rose' },
    { key: 'fuel', label: 'Avg fuel', value: `${averageFuelLevel}%`, note: 'Fleet-wide average', tone: 'violet' },
    { key: 'low-fuel', label: 'Low fuel', value: lowFuelVehicles, note: 'Below 40% threshold', tone: 'amber' },
  ]

  return (
    <div className="page-shell">
      <div className="page-top-actions">
        <button
           className="primary-button"
           disabled={!canManage}
           onClick={() => {
             if (!canManage) return
             if (showForm) resetForm()
             else {
               setShowForm(true)
               setEditingVehicleId(null)
             }
           }}
           type="button"
        >
          {showForm ? 'Close form' : 'Add vehicle'}
        </button>
      </div>




      <section className="analytics-filter-container">
        <form className="analytics-filter" onSubmit={(e) => e.preventDefault()}>
          <label>
            <span>Search vehicles</span>
            <input
              placeholder="ID, name, location..."
              type="text"
              value={searchParams.get('q') ?? ''}
              onChange={(e) => setSearchParams(e.target.value ? { q: e.target.value } : {})}
            />
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              {vehicleStatusFilters.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </form>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Fleet analytics</span>
            <h2 className="dashboard-section__title">Operational status</h2>
          </div>
          <span className="dashboard-section__counter">{vehicles.length} units</span>
        </div>
        <div className="dashboard-summary-grid">
          {kpis.map((kpi) => (
            <article key={kpi.key} className={toneClass(kpi.tone)}>
              <span className="dashboard-summary-card__label">{kpi.label}</span>
              <strong className="dashboard-summary-card__value">{kpi.value}</strong>
              <p className="dashboard-summary-card__note">{kpi.note}</p>
              <span className="dashboard-summary-card__spark" />
            </article>
          ))}
        </div>
      </section>

      {showForm && canManage && (
        <section className="panel--flat">
          <div className="panel__header">
            <div>
              <h3>{editingVehicleId ? `Edit ${editingVehicleId}` : 'Create new vehicle'}</h3>
              <p className="muted">Provide vehicle details to add it to the active fleet tracking system.</p>
            </div>
          </div>
          <form className="trip-form" onSubmit={handleSubmit}>
            <label>
              <span>Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required type="text" />
            </label>
            <label>
              <span>Type</span>
              <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required type="text" />
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                <option value="Active">Active</option>
                <option value="Idle">Rest</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </label>
            <label>
              <span>Location</span>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required type="text" />
            </label>
            <label>
              <span>Fuel level (%)</span>
              <input value={fuelLevelInput} onChange={(e) => setFuelLevelInput(formatVehicleNumericInput(e.target.value, { maxValue: 100 }))} required type="number" step="0.01" max="100" min="0" />
            </label>
            <label>
              <span>Mileage</span>
              <input value={mileageInput} onChange={(e) => setMileageInput(formatVehicleNumericInput(e.target.value))} required type="number" step="0.01" min="0" />
            </label>
            <label>
              <span>Driver ID</span>
              <input value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} required type="text" />
            </label>
            <div className="trip-form__actions">
              <button className="primary-button" type="submit">
                {editingVehicleId ? 'Save changes' : 'Save vehicle'}
              </button>
              <button className="secondary-button" onClick={resetForm} style={{ marginLeft: '12px' }} type="button">
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {selectedVehicle && (
        <section className="panel--flat">
          <div className="panel__header">
            <div>
              <span className="page-header__eyebrow">Selected Vehicle</span>
              <h3>{selectedVehicle.name} ({selectedVehicle.id})</h3>
              <p className="muted">{selectedVehicle.type} &middot; Currently in {selectedVehicle.location}</p>
            </div>
            <div className="card-actions">
              <button className="secondary-button" disabled={!canManage} onClick={() => canManage && handleEdit(selectedVehicle)}>
                Edit vehicle
              </button>
              <button className="secondary-button danger-button" disabled={!canManage || deletingVehicleId === selectedVehicle.id} onClick={() => canManage && handleDelete(selectedVehicle)}>
                {deletingVehicleId === selectedVehicle.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
          <div className="trip-telemetry" style={{ marginTop: '24px' }}>
            <article className="trip-telemetry__item">
              <span>Status</span>
              <div style={{ marginTop: '6px' }}>
                <span className={statusPillClass(selectedVehicle.status)}>{statusLabel(selectedVehicle.status)}</span>
              </div>
            </article>
            <article className="trip-telemetry__item">
              <span>Assigned Driver</span>
              <strong style={{ display: 'block', fontSize: '1.25rem', marginTop: '4px' }}>{selectedVehicle.driverId}</strong>
            </article>
            <article className="trip-telemetry__item">
              <span>Service Status</span>
              <strong style={{ display: 'block', fontSize: '1.25rem', marginTop: '4px', color: selectedVehicle.status === 'Maintenance' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {selectedVehicle.status === 'Maintenance' ? 'Maintenance Due' : 'Fleet Active'}
              </strong>
            </article>
            <article className="trip-telemetry__item">
              <span>Mileage</span>
              <strong style={{ display: 'block', fontSize: '1.25rem', marginTop: '4px' }}>{selectedVehicle.mileage.toLocaleString()} km</strong>
            </article>
            
            <article className="trip-telemetry__item" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'center' }}>
              <div>
                <span>Operational Capacity</span>
                <strong style={{ display: 'block', fontSize: '2rem', margin: '8px 0', letterSpacing: '-0.02em' }}>{selectedVehicle.fuelLevel}% Fuel</strong>
                <p className="muted" style={{ fontSize: '0.82rem' }}>Vehicle range and payload readiness estimated from latest telemetry data.</p>
              </div>
              <div className="vehicle-card__tracking-visual" style={{ background: 'rgba(241, 245, 249, 0.8)', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '16px' }}>
                <div className="vehicle-card__tracking-truck" aria-hidden="true" style={{ minHeight: '52px' }}>
                  <span className="vehicle-card__tracking-cab" style={{ background: 'var(--color-primary)', borderRadius: '8px 4px 4px 8px' }} />
                  <span className="vehicle-card__tracking-trailer" style={{ background: '#e2e8f0', height: '44px' }}>
                    <span className="vehicle-card__tracking-progress" style={{ width: `${selectedVehicle.fuelLevel}%`, background: selectedVehicle.fuelLevel < 40 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }} />
                  </span>
                  <span className="vehicle-card__tracking-wheel vehicle-card__tracking-wheel--front" style={{ border: '2px solid #fff', background: '#334155' }} />
                  <span className="vehicle-card__tracking-wheel vehicle-card__tracking-wheel--rear" style={{ border: '2px solid #fff', background: '#334155' }} />
                </div>
              </div>
            </article>
          </div>
        </section>
      )}

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <h2 className="dashboard-section__title">All Vehicles</h2>
          <span className="dashboard-section__counter">{filteredVehicles.length} matches</span>
        </div>
        <div className="trip-compliance-grid">
          {filteredVehicles.map((vehicle) => (
             <article key={vehicle.id} className={`trip-compliance-card ${selectedVehicleId === vehicle.id ? 'card--highlighted' : ''}`} onClick={() => setSelectedVehicleId(vehicle.id)} style={{ cursor: 'pointer' }}>
                <span className="page-header__eyebrow">{vehicle.id}</span>
                <strong>{vehicle.name}</strong>
                <p>{vehicle.location}</p>
                <div style={{ marginTop: '8px' }}>
                  <span className={statusPillClass(vehicle.status)}>{statusLabel(vehicle.status)}</span>
                </div>
                <div className="trip-detail__stats">
                  <article>
                    <span>Fuel</span>
                    <strong>{vehicle.fuelLevel}%</strong>
                  </article>
                  <article>
                    <span>Mileage</span>
                    <strong>{Math.round(vehicle.mileage / 1000)}k</strong>
                  </article>
                </div>
             </article>
          ))}
          {!filteredVehicles.length && <p className="muted">No vehicles found matching the filters.</p>}
        </div>
      </section>
    </div>
  )
}
