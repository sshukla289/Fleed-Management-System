import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DriverCard } from '../components/DriverCard'
import { PageHeader } from '../components/PageHeader'
import {
  assignShift,
  createDriver,
  deleteDriver,
  fetchDrivers,
  fetchVehicles,
  updateDriver,
} from '../services/apiService'
import type { AssignShiftInput, CreateDriverInput, Driver, Vehicle } from '../types'

const initialDriverForm: CreateDriverInput = {
  name: '',
  status: 'On Duty',
  licenseType: '',
  assignedVehicleId: '',
  hoursDrivenToday: 0,
}

function formatDriverHoursInput(value: string) {
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

export function DriverList() {
  const [searchParams] = useSearchParams()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [showShiftForm, setShowShiftForm] = useState(false)
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null)
  const [deletingDriverId, setDeletingDriverId] = useState<string | null>(null)
  const [hoursDrivenInput, setHoursDrivenInput] = useState('0')
  const [error, setError] = useState('')
  const [assignment, setAssignment] = useState<AssignShiftInput>({
    driverId: '',
    assignedVehicleId: '',
    status: 'On Duty',
  })
  const [driverForm, setDriverForm] = useState<CreateDriverInput>(initialDriverForm)

  useEffect(() => {
    async function loadDrivers() {
      const [driverData, vehicleData] = await Promise.all([fetchDrivers(), fetchVehicles()])
      setDrivers(driverData)
      setVehicles(vehicleData)

      if (driverData[0] && vehicleData[0]) {
        setAssignment({
          driverId: driverData[0].id,
          assignedVehicleId: vehicleData[0].id,
          status: 'On Duty',
        })
      }
    }

    void loadDrivers()
  }, [])

  async function handleAssignShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    try {
      const updatedDriver = await assignShift(assignment)
      setDrivers((current) => current.map((driver) => (driver.id === updatedDriver.id ? updatedDriver : driver)))
      setShowShiftForm(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to update shift.')
    }
  }

  async function handleDriverSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const parsedHoursDriven = Number(hoursDrivenInput)
    if (!hoursDrivenInput.trim() || Number.isNaN(parsedHoursDriven) || parsedHoursDriven < 0) {
      setError('Hours driven today must be a valid non-negative number.')
      return
    }

    const nextDriverForm = {
      ...driverForm,
      hoursDrivenToday: parsedHoursDriven,
    }

    try {
      if (editingDriverId) {
        const updated = await updateDriver(editingDriverId, nextDriverForm)
        setDrivers((current) => current.map((driver) => (driver.id === updated.id ? updated : driver)))
      } else {
        const created = await createDriver(nextDriverForm)
        setDrivers((current) => [...current, created])
      }

      resetDriverForm()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save driver.')
    }
  }

  async function handleDelete(driver: Driver) {
    setError('')
    setDeletingDriverId(driver.id)

    try {
      await deleteDriver(driver.id)
      setDrivers((current) => current.filter((item) => item.id !== driver.id))
      if (editingDriverId === driver.id) {
        resetDriverForm()
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete driver.')
    } finally {
      setDeletingDriverId((current) => (current === driver.id ? null : current))
    }
  }

  function handleEdit(driver: Driver) {
    setDriverForm({
      name: driver.name,
      status: driver.status,
      licenseType: driver.licenseType,
      assignedVehicleId: driver.assignedVehicleId ?? '',
      hoursDrivenToday: driver.hoursDrivenToday,
    })
    setHoursDrivenInput(formatDriverHoursInput(String(driver.hoursDrivenToday)))
    setEditingDriverId(driver.id)
    setShowDriverForm(true)
    setShowShiftForm(false)
    setError('')
  }

  function resetDriverForm() {
    setDriverForm(initialDriverForm)
    setHoursDrivenInput(formatDriverHoursInput(String(initialDriverForm.hoursDrivenToday)))
    setEditingDriverId(null)
    setShowDriverForm(false)
    setError('')
  }

  const highlightedDriverId = searchParams.get('highlight')
  const orderedDrivers = [...drivers].sort((left, right) => {
    if (left.id === highlightedDriverId) return -1
    if (right.id === highlightedDriverId) return 1
    return left.name.localeCompare(right.name)
  })

  return (
    <div className="page-shell">
      <div className="page-top-actions">
        <button className="secondary-button" onClick={() => {
          setShowShiftForm((current) => !current)
          setShowDriverForm(false)
          setError('')
        }} type="button">
          {showShiftForm ? 'Close shift assignment' : 'Assign shift'}
        </button>
        <button
          className="primary-button"
          onClick={() => {
            if (showDriverForm) {
              resetDriverForm()
            } else {
              setShowDriverForm(true)
              setShowShiftForm(false)
              setError('')
            }
          }}
          type="button"
        >
          {showDriverForm ? 'Close driver form' : 'Add driver'}
        </button>
      </div>

      {showDriverForm ? (
        <form className="panel--flat inline-form" onSubmit={handleDriverSubmit}>
          <div className="panel__header">
            <div>
              <h3>{editingDriverId ? `Edit ${editingDriverId}` : 'Add driver'}</h3>
              <p className="muted">Create or update driver records with assignment-ready details.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="input-group">
              <span>Name</span>
              <input onChange={(event) => setDriverForm({ ...driverForm, name: event.target.value })} required type="text" value={driverForm.name} />
            </label>
            <label className="input-group">
              <span>Status</span>
              <select onChange={(event) => setDriverForm({ ...driverForm, status: event.target.value as Driver['status'] })} value={driverForm.status}>
                <option value="On Duty">On Duty</option>
                <option value="Off Duty">Off Duty</option>
                <option value="Resting">Resting</option>
              </select>
            </label>
            <label className="input-group">
              <span>License type</span>
              <input onChange={(event) => setDriverForm({ ...driverForm, licenseType: event.target.value })} required type="text" value={driverForm.licenseType} />
            </label>
            <label className="input-group">
              <span>Assigned vehicle</span>
              <select onChange={(event) => setDriverForm({ ...driverForm, assignedVehicleId: event.target.value })} value={driverForm.assignedVehicleId}>
                <option value="">Unassigned</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>
                ))}
              </select>
            </label>
            <label className="input-group">
              <span>Hours driven today</span>
              <input
                min="0"
                onChange={(event) => setHoursDrivenInput(formatDriverHoursInput(event.target.value))}
                required
                step="0.01"
                type="number"
                value={hoursDrivenInput}
              />
            </label>
          </div>
          {error ? <div className="form-error">{error}</div> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit">
              {editingDriverId ? 'Save changes' : 'Save driver'}
            </button>
            <button className="secondary-button" onClick={resetDriverForm} type="button">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {showShiftForm ? (
        <form className="panel--flat inline-form" onSubmit={handleAssignShift}>
          <div className="panel__header">
            <div>
              <h3>Assign shift</h3>
              <p className="muted">Move a driver onto a vehicle and update their shift status.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="input-group">
              <span>Driver</span>
              <select onChange={(event) => setAssignment({ ...assignment, driverId: event.target.value })} value={assignment.driverId}>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>
            </label>
            <label className="input-group">
              <span>Vehicle</span>
              <select onChange={(event) => setAssignment({ ...assignment, assignedVehicleId: event.target.value })} value={assignment.assignedVehicleId}>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>
                ))}
              </select>
            </label>
            <label className="input-group">
              <span>Status</span>
              <select onChange={(event) => setAssignment({ ...assignment, status: event.target.value as Driver['status'] })} value={assignment.status}>
                <option value="On Duty">On Duty</option>
                <option value="Off Duty">Off Duty</option>
                <option value="Resting">Resting</option>
              </select>
            </label>
          </div>
          {error ? <div className="form-error">{error}</div> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit">Update shift</button>
            <button className="secondary-button" onClick={() => setShowShiftForm(false)} type="button">Cancel</button>
          </div>
        </form>
      ) : null}

      <section className="list-grid">
        {orderedDrivers.map((driver) => (
          <DriverCard
            key={driver.id}
            driver={driver}
            highlighted={driver.id === highlightedDriverId}
            isDeleting={deletingDriverId === driver.id}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ))}
      </section>
    </div>
  )
}
