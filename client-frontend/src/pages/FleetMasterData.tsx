import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { assignDriverShift, createDriverRecord, deleteDriverRecord, fetchDriversList, updateDriverRecord } from '../services/driverService'
import { createRouteRecord, deleteRouteRecord, fetchRoutesList, optimizeRoutePlans, updateRouteRecord } from '../services/routeService'
import { createVehicleRecord, deleteVehicleRecord, fetchVehiclesList, updateVehicleRecord } from '../services/vehicleService'
import type { AssignShiftInput, CreateDriverInput, CreateRoutePlanInput, CreateVehicleInput, Driver, RoutePlan, TripStop, Vehicle } from '../types'
import './FleetMasterData.css'

type FleetTab = 'vehicles' | 'drivers' | 'routes'
type NoticeTone = 'success' | 'error'

type VehicleModalState =
  | { mode: 'create' }
  | { mode: 'edit'; vehicle: Vehicle }

type DriverModalState =
  | { mode: 'create' }
  | { mode: 'edit'; driver: Driver }

type DriverShiftModalState = {
  driver: Driver
}

type RouteModalState =
  | { mode: 'create' }
  | { mode: 'edit'; route: RoutePlan }

type NoticeState = {
  tone: NoticeTone
  text: string
}

const TABS: Array<{ id: FleetTab; label: string; description: string }> = [
  { id: 'vehicles', label: 'Vehicles', description: 'Fleet units, status, and regional assignments.' },
  { id: 'drivers', label: 'Drivers', description: 'Licenses, shift coverage, and vehicle handoffs.' },
  { id: 'routes', label: 'Routes', description: 'Master route plans and optimization controls.' },
]

const VEHICLE_STATUSES: Vehicle['status'][] = ['Active', 'Maintenance', 'Idle']
const DRIVER_STATUSES: Driver['status'][] = ['On Duty', 'Off Duty', 'Resting']
const DRIVER_SHIFTS = ['Morning', 'Evening', 'Night', 'Flexible']
const ROUTE_STATUSES: RoutePlan['status'][] = ['Scheduled', 'In Progress', 'Completed']

const vehicleQueryKey = ['fleet-master', 'vehicles'] as const
const driverQueryKey = ['fleet-master', 'drivers'] as const
const routeQueryKey = ['fleet-master', 'routes'] as const

const initialVehicleForm: CreateVehicleInput = {
  name: '',
  type: '',
  status: 'Active',
  location: '',
  assignedRegion: '',
  fuelLevel: 50,
  mileage: 0,
  driverId: '',
}

const initialDriverForm: CreateDriverInput = {
  name: '',
  status: 'On Duty',
  licenseType: '',
  licenseNumber: '',
  licenseExpiryDate: '',
  assignedShift: 'Morning',
  phone: '',
  assignedVehicleId: '',
  hoursDrivenToday: 0,
}

const initialShiftForm: AssignShiftInput = {
  driverId: '',
  assignedVehicleId: '',
  status: 'On Duty',
  assignedShift: 'Morning',
}

const initialRouteForm: CreateRoutePlanInput = {
  name: '',
  status: 'Scheduled',
  distanceKm: 0,
  estimatedDuration: '',
  stops: [
    { name: '', sequence: 1, status: 'PENDING' },
    { name: '', sequence: 2, status: 'PENDING' },
  ],
}

function safeActiveTab(value: string | null): FleetTab {
  return value === 'drivers' || value === 'routes' ? value : 'vehicles'
}

function toLower(value: string | undefined | null) {
  return (value ?? '').trim().toLowerCase()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

function formatLicenseExpiry(value: string) {
  if (!value) {
    return 'Not set'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function stopSummary(stops: TripStop[]) {
  if (!stops.length) {
    return 'No stops configured'
  }

  return stops.map((stop) => stop.name).filter(Boolean).join(' -> ')
}

function routeStatusTone(status: RoutePlan['status']) {
  if (status === 'Completed') {
    return 'fleet-master-pill fleet-master-pill--success'
  }

  if (status === 'In Progress') {
    return 'fleet-master-pill fleet-master-pill--warning'
  }

  return 'fleet-master-pill fleet-master-pill--info'
}

function vehicleStatusTone(status: Vehicle['status']) {
  if (status === 'Maintenance') {
    return 'fleet-master-pill fleet-master-pill--danger'
  }

  if (status === 'Idle') {
    return 'fleet-master-pill fleet-master-pill--warning'
  }

  return 'fleet-master-pill fleet-master-pill--success'
}

function driverStatusTone(status: Driver['status']) {
  if (status === 'Resting') {
    return 'fleet-master-pill fleet-master-pill--warning'
  }

  if (status === 'Off Duty') {
    return 'fleet-master-pill fleet-master-pill--neutral'
  }

  return 'fleet-master-pill fleet-master-pill--success'
}

function validateVehicleForm(form: CreateVehicleInput) {
  if (!form.name.trim() || !form.type.trim() || !form.location.trim() || !form.assignedRegion?.trim()) {
    return 'Name, type, location, and region are required.'
  }

  if (!Number.isFinite(form.fuelLevel) || form.fuelLevel < 0 || form.fuelLevel > 100) {
    return 'Fuel level must be between 0 and 100.'
  }

  if (!Number.isFinite(form.mileage) || form.mileage < 0) {
    return 'Mileage must be zero or greater.'
  }

  return ''
}

function validateDriverForm(form: CreateDriverInput) {
  if (!form.name.trim() || !form.licenseType.trim() || !form.licenseNumber?.trim()) {
    return 'Name, license type, and license number are required.'
  }

  if (!form.licenseExpiryDate?.trim()) {
    return 'License expiry date is required.'
  }

  if (!form.assignedShift?.trim()) {
    return 'Assigned shift is required.'
  }

  if (form.phone.trim() && !/^[0-9+()\-\s]{7,20}$/.test(form.phone.trim())) {
    return 'Phone number format is invalid.'
  }

  if (!Number.isFinite(form.hoursDrivenToday) || form.hoursDrivenToday < 0) {
    return 'Hours driven must be zero or greater.'
  }

  return ''
}

function validateShiftForm(form: AssignShiftInput) {
  if (!form.driverId.trim() || !form.assignedShift?.trim()) {
    return 'Driver and shift are required.'
  }

  return ''
}

function validateRouteForm(form: CreateRoutePlanInput) {
  if (!form.name.trim() || !form.estimatedDuration.trim()) {
    return 'Route name and estimated duration are required.'
  }

  if (!Number.isFinite(form.distanceKm) || form.distanceKm < 0) {
    return 'Distance must be zero or greater.'
  }

  const meaningfulStops = form.stops.filter((stop) => stop.name.trim())
  if (meaningfulStops.length < 2) {
    return 'Add at least two stop names to create a route plan.'
  }

  return ''
}

function normalizeRouteStops(stops: TripStop[]) {
  return stops
    .map((stop, index) => ({
      ...stop,
      name: stop.name.trim(),
      sequence: index + 1,
      status: stop.status ?? 'PENDING',
    }))
    .filter((stop) => stop.name)
}

function ModalShell({
  children,
  title,
  subtitle,
  eyebrow,
  onClose,
}: {
  children: ReactNode
  title: string
  subtitle: string
  eyebrow: string
  onClose: () => void
}) {
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  return (
    <div className="fleet-master-modal" onClick={onClose} role="presentation">
      <div
        aria-label={title}
        aria-modal="true"
        className="fleet-master-modal__card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="fleet-master-modal__header">
          <div>
            <span className="fleet-master-modal__eyebrow">{eyebrow}</span>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button className="fleet-master-modal__close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="fleet-master-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="fleet-master-empty">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function FleetMasterLoading() {
  return (
    <div className="fleet-master-loading">
      <div className="fleet-master-loading__spinner" />
      <span>Loading fleet master data...</span>
    </div>
  )
}

function FleetMasterError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="fleet-master-error">
      <strong>Unable to load fleet master data</strong>
      <p>{message}</p>
      <button className="fleet-master-button fleet-master-button--primary" onClick={onRetry} type="button">
        Retry
      </button>
    </div>
  )
}

function VehicleFormModal({
  mode,
  initialValue,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  initialValue?: Vehicle
  isSubmitting: boolean
  error: string
  onClose: () => void
  onSubmit: (form: CreateVehicleInput) => Promise<void>
}) {
  const [form, setForm] = useState<CreateVehicleInput>(() => ({
    ...initialVehicleForm,
    ...(initialValue
      ? {
          name: initialValue.name,
          type: initialValue.type,
          status: initialValue.status,
          location: initialValue.location,
          assignedRegion: initialValue.assignedRegion,
          fuelLevel: initialValue.fuelLevel,
          mileage: initialValue.mileage,
          driverId: initialValue.driverId,
        }
      : {}),
  }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(form)
  }

  return (
    <ModalShell
      eyebrow={mode === 'create' ? 'Create vehicle' : 'Edit vehicle'}
      onClose={onClose}
      subtitle="Capture vehicle status, region, and operational baseline details."
      title={mode === 'create' ? 'Add fleet unit' : `Update ${initialValue?.id ?? 'vehicle'}`}
    >
      <form className="fleet-master-form" onSubmit={handleSubmit}>
        <div className="fleet-master-form__grid">
          <label>
            <span>Name</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              type="text"
              value={form.name}
            />
          </label>
          <label>
            <span>Type</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              required
              type="text"
              value={form.type}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Vehicle['status'] }))}
              value={form.status}
            >
              {VEHICLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Assigned region</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, assignedRegion: event.target.value }))}
              required
              type="text"
              value={form.assignedRegion ?? ''}
            />
          </label>
          <label>
            <span>Location</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              required
              type="text"
              value={form.location}
            />
          </label>
          <label>
            <span>Driver ID</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, driverId: event.target.value }))}
              placeholder="Optional"
              type="text"
              value={form.driverId}
            />
          </label>
          <label>
            <span>Fuel level</span>
            <input
              max="100"
              min="0"
              onChange={(event) => setForm((current) => ({ ...current, fuelLevel: Number(event.target.value) }))}
              required
              type="number"
              value={form.fuelLevel}
            />
          </label>
          <label>
            <span>Mileage</span>
            <input
              min="0"
              onChange={(event) => setForm((current) => ({ ...current, mileage: Number(event.target.value) }))}
              required
              type="number"
              value={form.mileage}
            />
          </label>
        </div>
        {error ? <div className="fleet-master-form__error">{error}</div> : null}
        <div className="fleet-master-form__actions">
          <button className="fleet-master-button fleet-master-button--ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="fleet-master-button fleet-master-button--primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create vehicle' : 'Save changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function DriverFormModal({
  mode,
  initialValue,
  vehicleOptions,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  initialValue?: Driver
  vehicleOptions: Vehicle[]
  isSubmitting: boolean
  error: string
  onClose: () => void
  onSubmit: (form: CreateDriverInput) => Promise<void>
}) {
  const [form, setForm] = useState<CreateDriverInput>(() => ({
    ...initialDriverForm,
    ...(initialValue
      ? {
          name: initialValue.name,
          status: initialValue.status,
          licenseType: initialValue.licenseType,
          licenseNumber: initialValue.licenseNumber,
          licenseExpiryDate: initialValue.licenseExpiryDate,
          assignedShift: initialValue.assignedShift,
          phone: initialValue.phone ?? '',
          assignedVehicleId: initialValue.assignedVehicleId ?? '',
          hoursDrivenToday: initialValue.hoursDrivenToday,
        }
      : {}),
  }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(form)
  }

  return (
    <ModalShell
      eyebrow={mode === 'create' ? 'Create driver' : 'Edit driver'}
      onClose={onClose}
      subtitle="Store license details, shift coverage, and current assignment context."
      title={mode === 'create' ? 'Add driver record' : `Update ${initialValue?.id ?? 'driver'}`}
    >
      <form className="fleet-master-form" onSubmit={handleSubmit}>
        <div className="fleet-master-form__grid">
          <label>
            <span>Name</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              type="text"
              value={form.name}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Driver['status'] }))}
              value={form.status}
            >
              {DRIVER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>License type</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, licenseType: event.target.value }))}
              required
              type="text"
              value={form.licenseType}
            />
          </label>
          <label>
            <span>License number</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
              required
              type="text"
              value={form.licenseNumber ?? ''}
            />
          </label>
          <label>
            <span>License expiry</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, licenseExpiryDate: event.target.value }))}
              required
              type="date"
              value={form.licenseExpiryDate ?? ''}
            />
          </label>
          <label>
            <span>Assigned shift</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, assignedShift: event.target.value }))}
              value={form.assignedShift ?? ''}
            >
              {DRIVER_SHIFTS.map((shift) => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Phone</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              type="tel"
              value={form.phone}
            />
          </label>
          <label>
            <span>Assigned vehicle</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, assignedVehicleId: event.target.value }))}
              value={form.assignedVehicleId}
            >
              <option value="">Unassigned</option>
              {vehicleOptions.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.id} · {vehicle.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Hours driven today</span>
            <input
              min="0"
              onChange={(event) => setForm((current) => ({ ...current, hoursDrivenToday: Number(event.target.value) }))}
              required
              step="0.1"
              type="number"
              value={form.hoursDrivenToday}
            />
          </label>
        </div>
        {error ? <div className="fleet-master-form__error">{error}</div> : null}
        <div className="fleet-master-form__actions">
          <button className="fleet-master-button fleet-master-button--ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="fleet-master-button fleet-master-button--primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create driver' : 'Save changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function DriverShiftModal({
  initialValue,
  vehicleOptions,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  initialValue: Driver
  vehicleOptions: Vehicle[]
  isSubmitting: boolean
  error: string
  onClose: () => void
  onSubmit: (form: AssignShiftInput) => Promise<void>
}) {
  const [form, setForm] = useState<AssignShiftInput>({
    ...initialShiftForm,
    driverId: initialValue.id,
    assignedVehicleId: initialValue.assignedVehicleId ?? '',
    status: initialValue.status,
    assignedShift: initialValue.assignedShift || 'Morning',
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(form)
  }

  return (
    <ModalShell
      eyebrow="Assign shift"
      onClose={onClose}
      subtitle="Update shift coverage and the current vehicle handoff for this driver."
      title={`Assign shift for ${initialValue.name}`}
    >
      <form className="fleet-master-form" onSubmit={handleSubmit}>
        <div className="fleet-master-form__grid">
          <label>
            <span>Shift</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, assignedShift: event.target.value }))}
              value={form.assignedShift ?? ''}
            >
              {DRIVER_SHIFTS.map((shift) => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Driver['status'] }))}
              value={form.status}
            >
              {DRIVER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="fleet-master-form__grid-span">
            <span>Assigned vehicle</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, assignedVehicleId: event.target.value }))}
              value={form.assignedVehicleId}
            >
              <option value="">Unassigned</option>
              {vehicleOptions.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.id} · {vehicle.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <div className="fleet-master-form__error">{error}</div> : null}
        <div className="fleet-master-form__actions">
          <button className="fleet-master-button fleet-master-button--ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="fleet-master-button fleet-master-button--primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Updating...' : 'Update shift'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function RouteFormModal({
  mode,
  initialValue,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  initialValue?: RoutePlan
  isSubmitting: boolean
  error: string
  onClose: () => void
  onSubmit: (form: CreateRoutePlanInput) => Promise<void>
}) {
  const [form, setForm] = useState<CreateRoutePlanInput>(() => ({
    ...initialRouteForm,
    ...(initialValue
      ? {
          name: initialValue.name,
          status: initialValue.status,
          distanceKm: initialValue.distanceKm,
          estimatedDuration: initialValue.estimatedDuration,
          stops: initialValue.stops.length ? initialValue.stops.map((stop) => ({ ...stop })) : initialRouteForm.stops,
        }
      : {}),
  }))

  function updateStop(index: number, nextStop: TripStop) {
    setForm((current) => ({
      ...current,
      stops: current.stops.map((stop, stopIndex) => (stopIndex === index ? nextStop : stop)),
    }))
  }

  function addStop() {
    setForm((current) => ({
      ...current,
      stops: [...current.stops, { name: '', sequence: current.stops.length + 1, status: 'PENDING' }],
    }))
  }

  function removeStop(index: number) {
    setForm((current) => ({
      ...current,
      stops: current.stops
        .filter((_, stopIndex) => stopIndex !== index)
        .map((stop, stopIndex) => ({ ...stop, sequence: stopIndex + 1 })),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit({
      ...form,
      stops: normalizeRouteStops(form.stops),
    })
  }

  return (
    <ModalShell
      eyebrow={mode === 'create' ? 'Create route' : 'Edit route'}
      onClose={onClose}
      subtitle="Maintain route plans with ETA, distance, and ordered stop lists."
      title={mode === 'create' ? 'Add route plan' : `Update ${initialValue?.id ?? 'route'}`}
    >
      <form className="fleet-master-form" onSubmit={handleSubmit}>
        <div className="fleet-master-form__grid">
          <label>
            <span>Name</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              type="text"
              value={form.name}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as RoutePlan['status'] }))}
              value={form.status}
            >
              {ROUTE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Distance (km)</span>
            <input
              min="0"
              onChange={(event) => setForm((current) => ({ ...current, distanceKm: Number(event.target.value) }))}
              required
              type="number"
              value={form.distanceKm}
            />
          </label>
          <label>
            <span>Estimated duration</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, estimatedDuration: event.target.value }))}
              placeholder="3h 45m"
              required
              type="text"
              value={form.estimatedDuration}
            />
          </label>
        </div>

        <div className="fleet-master-stops">
          <div className="fleet-master-stops__header">
            <div>
              <strong>Stops</strong>
              <p>Ordered stop names define the route master data and optimization input.</p>
            </div>
            <button className="fleet-master-button fleet-master-button--ghost" onClick={addStop} type="button">
              Add stop
            </button>
          </div>
          <div className="fleet-master-stops__list">
            {form.stops.map((stop, index) => (
              <div key={`route-stop-${index}`} className="fleet-master-stops__row">
                <span className="fleet-master-stops__index">{index + 1}</span>
                <input
                  onChange={(event) => updateStop(index, { ...stop, name: event.target.value })}
                  placeholder="Enter stop name"
                  type="text"
                  value={stop.name}
                />
                <select
                  onChange={(event) => updateStop(index, { ...stop, status: event.target.value as TripStop['status'] })}
                  value={stop.status}
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
                <button
                  className="fleet-master-button fleet-master-button--danger"
                  disabled={form.stops.length <= 2}
                  onClick={() => removeStop(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {error ? <div className="fleet-master-form__error">{error}</div> : null}
        <div className="fleet-master-form__actions">
          <button className="fleet-master-button fleet-master-button--ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="fleet-master-button fleet-master-button--primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create route' : 'Save changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

export function FleetMasterDataPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = safeActiveTab(searchParams.get('tab'))

  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<'ALL' | Vehicle['status']>('ALL')
  const [driverSearch, setDriverSearch] = useState('')
  const [driverStatusFilter, setDriverStatusFilter] = useState<'ALL' | Driver['status']>('ALL')
  const [routeSearch, setRouteSearch] = useState('')
  const [routeStatusFilter, setRouteStatusFilter] = useState<'ALL' | RoutePlan['status']>('ALL')

  const deferredVehicleSearch = useDeferredValue(vehicleSearch)
  const deferredDriverSearch = useDeferredValue(driverSearch)
  const deferredRouteSearch = useDeferredValue(routeSearch)

  const [vehicleModal, setVehicleModal] = useState<VehicleModalState | null>(null)
  const [driverModal, setDriverModal] = useState<DriverModalState | null>(null)
  const [driverShiftModal, setDriverShiftModal] = useState<DriverShiftModalState | null>(null)
  const [routeModal, setRouteModal] = useState<RouteModalState | null>(null)
  const [vehicleModalError, setVehicleModalError] = useState('')
  const [driverModalError, setDriverModalError] = useState('')
  const [driverShiftError, setDriverShiftError] = useState('')
  const [routeModalError, setRouteModalError] = useState('')
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false)
  const [isSubmittingDriver, setIsSubmittingDriver] = useState(false)
  const [isSubmittingShift, setIsSubmittingShift] = useState(false)
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false)
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null)
  const [deletingDriverId, setDeletingDriverId] = useState<string | null>(null)
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null)
  const [isOptimizingRoutes, setIsOptimizingRoutes] = useState(false)

  const vehiclesQuery = useQuery({
    queryKey: vehicleQueryKey,
    queryFn: fetchVehiclesList,
  })
  const driversQuery = useQuery({
    queryKey: driverQueryKey,
    queryFn: fetchDriversList,
  })
  const routesQuery = useQuery({
    queryKey: routeQueryKey,
    queryFn: fetchRoutesList,
  })

  const vehicles = vehiclesQuery.data ?? []
  const drivers = driversQuery.data ?? []
  const routes = routesQuery.data ?? []

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const filteredVehicles = useMemo(() => {
    const query = toLower(deferredVehicleSearch)
    return vehicles.filter((vehicle) => {
      const matchesQuery =
        !query ||
        [vehicle.id, vehicle.name, vehicle.type, vehicle.location, vehicle.assignedRegion, vehicle.driverId]
          .some((field) => toLower(field).includes(query))
      const matchesStatus = vehicleStatusFilter === 'ALL' || vehicle.status === vehicleStatusFilter
      return matchesQuery && matchesStatus
    })
  }, [deferredVehicleSearch, vehicleStatusFilter, vehicles])

  const filteredDrivers = useMemo(() => {
    const query = toLower(deferredDriverSearch)
    return drivers.filter((driver) => {
      const matchesQuery =
        !query ||
        [driver.id, driver.name, driver.licenseType, driver.licenseNumber, driver.assignedShift, driver.assignedVehicleId]
          .some((field) => toLower(field).includes(query))
      const matchesStatus = driverStatusFilter === 'ALL' || driver.status === driverStatusFilter
      return matchesQuery && matchesStatus
    })
  }, [deferredDriverSearch, driverStatusFilter, drivers])

  const filteredRoutes = useMemo(() => {
    const query = toLower(deferredRouteSearch)
    return routes.filter((route) => {
      const matchesQuery =
        !query ||
        [route.id, route.name, route.estimatedDuration, ...route.stops.map((stop) => stop.name)]
          .some((field) => toLower(field).includes(query))
      const matchesStatus = routeStatusFilter === 'ALL' || route.status === routeStatusFilter
      return matchesQuery && matchesStatus
    })
  }, [deferredRouteSearch, routeStatusFilter, routes])

  const totalAssets = vehicles.length + drivers.length + routes.length
  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'Active').length
  const maintenanceVehicles = vehicles.filter((vehicle) => vehicle.status === 'Maintenance').length
  const onDutyDrivers = drivers.filter((driver) => driver.status === 'On Duty').length

  const hasLoadingState = vehiclesQuery.isPending || driversQuery.isPending || routesQuery.isPending
  const loadError =
    vehiclesQuery.error instanceof Error
      ? vehiclesQuery.error.message
      : driversQuery.error instanceof Error
        ? driversQuery.error.message
        : routesQuery.error instanceof Error
          ? routesQuery.error.message
          : ''

  function changeTab(tab: FleetTab) {
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('tab', tab)
      setSearchParams(nextParams)
    })
  }

  async function refreshEntities(keys: Array<typeof vehicleQueryKey | typeof driverQueryKey | typeof routeQueryKey>) {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

  async function handleVehicleSubmit(form: CreateVehicleInput) {
    const validationError = validateVehicleForm(form)
    if (validationError) {
      setVehicleModalError(validationError)
      return
    }

    setIsSubmittingVehicle(true)
    setVehicleModalError('')

    try {
      if (vehicleModal?.mode === 'edit') {
        await updateVehicleRecord(vehicleModal.vehicle.id, form)
        setNotice({ tone: 'success', text: 'Vehicle updated successfully.' })
      } else {
        await createVehicleRecord(form)
        setNotice({ tone: 'success', text: 'Vehicle created successfully.' })
      }

      await refreshEntities([vehicleQueryKey])
      setVehicleModal(null)
    } catch (error) {
      setVehicleModalError(error instanceof Error ? error.message : 'Unable to save vehicle.')
    } finally {
      setIsSubmittingVehicle(false)
    }
  }

  async function handleDriverSubmit(form: CreateDriverInput) {
    const validationError = validateDriverForm(form)
    if (validationError) {
      setDriverModalError(validationError)
      return
    }

    setIsSubmittingDriver(true)
    setDriverModalError('')

    try {
      if (driverModal?.mode === 'edit') {
        await updateDriverRecord(driverModal.driver.id, form)
        setNotice({ tone: 'success', text: 'Driver updated successfully.' })
      } else {
        await createDriverRecord(form)
        setNotice({ tone: 'success', text: 'Driver created successfully.' })
      }

      await refreshEntities([driverQueryKey])
      setDriverModal(null)
    } catch (error) {
      setDriverModalError(error instanceof Error ? error.message : 'Unable to save driver.')
    } finally {
      setIsSubmittingDriver(false)
    }
  }

  async function handleShiftSubmit(form: AssignShiftInput) {
    const validationError = validateShiftForm(form)
    if (validationError) {
      setDriverShiftError(validationError)
      return
    }

    setIsSubmittingShift(true)
    setDriverShiftError('')

    try {
      await assignDriverShift(form)
      await refreshEntities([driverQueryKey])
      setNotice({ tone: 'success', text: 'Driver shift updated successfully.' })
      setDriverShiftModal(null)
    } catch (error) {
      setDriverShiftError(error instanceof Error ? error.message : 'Unable to update shift.')
    } finally {
      setIsSubmittingShift(false)
    }
  }

  async function handleRouteSubmit(form: CreateRoutePlanInput) {
    const validationError = validateRouteForm(form)
    if (validationError) {
      setRouteModalError(validationError)
      return
    }

    setIsSubmittingRoute(true)
    setRouteModalError('')

    try {
      if (routeModal?.mode === 'edit') {
        await updateRouteRecord(routeModal.route.id, form)
        setNotice({ tone: 'success', text: 'Route plan updated successfully.' })
      } else {
        await createRouteRecord(form)
        setNotice({ tone: 'success', text: 'Route plan created successfully.' })
      }

      await refreshEntities([routeQueryKey])
      setRouteModal(null)
    } catch (error) {
      setRouteModalError(error instanceof Error ? error.message : 'Unable to save route.')
    } finally {
      setIsSubmittingRoute(false)
    }
  }

  async function handleDeleteVehicle(vehicle: Vehicle) {
    setDeletingVehicleId(vehicle.id)
    try {
      await deleteVehicleRecord(vehicle.id)
      await refreshEntities([vehicleQueryKey])
      setNotice({ tone: 'success', text: `${vehicle.name} deleted.` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to delete vehicle.' })
    } finally {
      setDeletingVehicleId(null)
    }
  }

  async function handleDeleteDriver(driver: Driver) {
    setDeletingDriverId(driver.id)
    try {
      await deleteDriverRecord(driver.id)
      await refreshEntities([driverQueryKey])
      setNotice({ tone: 'success', text: `${driver.name} deleted.` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to delete driver.' })
    } finally {
      setDeletingDriverId(null)
    }
  }

  async function handleDeleteRoute(route: RoutePlan) {
    setDeletingRouteId(route.id)
    try {
      await deleteRouteRecord(route.id)
      await refreshEntities([routeQueryKey])
      setNotice({ tone: 'success', text: `${route.name} deleted.` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to delete route.' })
    } finally {
      setDeletingRouteId(null)
    }
  }

  async function handleOptimizeRoutes() {
    setIsOptimizingRoutes(true)
    try {
      await optimizeRoutePlans()
      await refreshEntities([routeQueryKey])
      setNotice({ tone: 'success', text: 'Route optimization completed for current plans.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to optimize routes.' })
    } finally {
      setIsOptimizingRoutes(false)
    }
  }

  if (hasLoadingState) {
    return <FleetMasterLoading />
  }

  if (loadError) {
    return (
      <FleetMasterError
        message={loadError}
        onRetry={() => void refreshEntities([vehicleQueryKey, driverQueryKey, routeQueryKey])}
      />
    )
  }

  return (
    <div className="fleet-master">
      <section className="fleet-master__hero">
        <div className="fleet-master__hero-copy">
          <span className="fleet-master__eyebrow">Admin workspace</span>
          <h2>Fleet Master Data Management</h2>
          <p>
            Manage master records for vehicles, drivers, and routes from one structured control surface.
            The module keeps each entity modular, while preserving clean CRUD workflows and optimization tools.
          </p>
        </div>
        <div className="fleet-master__summary-grid">
          <SummaryCard label="Managed records" note="Vehicles, drivers, and routes in this workspace." value={formatNumber(totalAssets)} />
          <SummaryCard label="Active vehicles" note="Units currently available for fleet operations." value={formatNumber(activeVehicles)} />
          <SummaryCard label="Maintenance queue" note="Vehicles flagged for workshop or service hold." value={formatNumber(maintenanceVehicles)} />
          <SummaryCard label="Drivers on duty" note="Crew currently marked available for dispatch." value={formatNumber(onDutyDrivers)} />
        </div>
      </section>

      {notice ? (
        <section className={`fleet-master__notice fleet-master__notice--${notice.tone}`}>
          <strong>{notice.tone === 'success' ? 'Success' : 'Attention'}</strong>
          <p>{notice.text}</p>
        </section>
      ) : null}

      <section className="fleet-master__tabs">
        <div className="fleet-master__tab-list" role="tablist" aria-label="Fleet master data tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              aria-selected={activeTab === tab.id}
              className={`fleet-master__tab${activeTab === tab.id ? ' fleet-master__tab--active' : ''}`}
              onClick={() => changeTab(tab.id)}
              role="tab"
              type="button"
            >
              <span>{tab.label}</span>
              <small>{tab.description}</small>
            </button>
          ))}
        </div>

        {activeTab === 'vehicles' ? (
          <section className="fleet-master__panel">
            <div className="fleet-master__toolbar">
              <div className="fleet-master__toolbar-copy">
                <h3>Vehicles</h3>
                <p>Maintain fleet status, region ownership, and driver linkage.</p>
              </div>
              <div className="fleet-master__toolbar-actions">
                <input
                  className="fleet-master__search"
                  onChange={(event) => setVehicleSearch(event.target.value)}
                  placeholder="Search by ID, name, region, or driver..."
                  type="search"
                  value={vehicleSearch}
                />
                <select
                  className="fleet-master__filter"
                  onChange={(event) => setVehicleStatusFilter(event.target.value as 'ALL' | Vehicle['status'])}
                  value={vehicleStatusFilter}
                >
                  <option value="ALL">All statuses</option>
                  {VEHICLE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  className="fleet-master-button fleet-master-button--primary"
                  onClick={() => {
                    setVehicleModalError('')
                    setVehicleModal({ mode: 'create' })
                  }}
                  type="button"
                >
                  Add vehicle
                </button>
              </div>
            </div>

            {filteredVehicles.length ? (
              <div className="fleet-master-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Region</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th>Driver</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVehicles.map((vehicle) => (
                      <tr key={vehicle.id}>
                        <td>
                          <strong>{vehicle.name}</strong>
                          <span>{vehicle.id}</span>
                        </td>
                        <td>{vehicle.type}</td>
                        <td>{vehicle.assignedRegion || 'Unassigned'}</td>
                        <td><span className={vehicleStatusTone(vehicle.status)}>{vehicle.status}</span></td>
                        <td>{vehicle.location}</td>
                        <td>{vehicle.driverId || 'Unassigned'}</td>
                        <td>
                          <div className="fleet-master-table__actions">
                            <button
                              className="fleet-master-button fleet-master-button--ghost"
                              onClick={() => {
                                setVehicleModalError('')
                                setVehicleModal({ mode: 'edit', vehicle })
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="fleet-master-button fleet-master-button--danger"
                              disabled={deletingVehicleId === vehicle.id}
                              onClick={() => void handleDeleteVehicle(vehicle)}
                              type="button"
                            >
                              {deletingVehicleId === vehicle.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                description="Try adjusting search or status filters, or create the first fleet unit in this module."
                title="No vehicles match the current view"
              />
            )}
          </section>
        ) : null}

        {activeTab === 'drivers' ? (
          <section className="fleet-master__panel">
            <div className="fleet-master__toolbar">
              <div className="fleet-master__toolbar-copy">
                <h3>Drivers</h3>
                <p>Track driver readiness, license details, and shift assignments.</p>
              </div>
              <div className="fleet-master__toolbar-actions">
                <input
                  className="fleet-master__search"
                  onChange={(event) => setDriverSearch(event.target.value)}
                  placeholder="Search by ID, name, license, or shift..."
                  type="search"
                  value={driverSearch}
                />
                <select
                  className="fleet-master__filter"
                  onChange={(event) => setDriverStatusFilter(event.target.value as 'ALL' | Driver['status'])}
                  value={driverStatusFilter}
                >
                  <option value="ALL">All statuses</option>
                  {DRIVER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  className="fleet-master-button fleet-master-button--primary"
                  onClick={() => {
                    setDriverModalError('')
                    setDriverModal({ mode: 'create' })
                  }}
                  type="button"
                >
                  Add driver
                </button>
              </div>
            </div>

            {filteredDrivers.length ? (
              <div className="fleet-master-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>License</th>
                      <th>Shift</th>
                      <th>Vehicle</th>
                      <th>Status</th>
                      <th>Hours</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrivers.map((driver) => (
                      <tr key={driver.id}>
                        <td>
                          <strong>{driver.name}</strong>
                          <span>{driver.id}</span>
                        </td>
                        <td>
                          <strong>{driver.licenseType}</strong>
                          <span>{driver.licenseNumber}</span>
                          <span>Expires {formatLicenseExpiry(driver.licenseExpiryDate)}</span>
                        </td>
                        <td>{driver.assignedShift || 'Unassigned'}</td>
                        <td>{driver.assignedVehicleId || 'Unassigned'}</td>
                        <td><span className={driverStatusTone(driver.status)}>{driver.status}</span></td>
                        <td>{driver.hoursDrivenToday.toFixed(1)} hrs</td>
                        <td>
                          <div className="fleet-master-table__actions">
                            <button
                              className="fleet-master-button fleet-master-button--ghost"
                              onClick={() => {
                                setDriverShiftError('')
                                setDriverShiftModal({ driver })
                              }}
                              type="button"
                            >
                              Shift
                            </button>
                            <button
                              className="fleet-master-button fleet-master-button--ghost"
                              onClick={() => {
                                setDriverModalError('')
                                setDriverModal({ mode: 'edit', driver })
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="fleet-master-button fleet-master-button--danger"
                              disabled={deletingDriverId === driver.id}
                              onClick={() => void handleDeleteDriver(driver)}
                              type="button"
                            >
                              {deletingDriverId === driver.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                description="Broaden the filters or create a new driver record with license and shift details."
                title="No drivers match the current view"
              />
            )}
          </section>
        ) : null}

        {activeTab === 'routes' ? (
          <section className="fleet-master__panel">
            <div className="fleet-master__toolbar">
              <div className="fleet-master__toolbar-copy">
                <h3>Routes</h3>
                <p>Maintain route plans, stop sequences, and optimization readiness.</p>
              </div>
              <div className="fleet-master__toolbar-actions">
                <input
                  className="fleet-master__search"
                  onChange={(event) => setRouteSearch(event.target.value)}
                  placeholder="Search by route ID, name, or stop..."
                  type="search"
                  value={routeSearch}
                />
                <select
                  className="fleet-master__filter"
                  onChange={(event) => setRouteStatusFilter(event.target.value as 'ALL' | RoutePlan['status'])}
                  value={routeStatusFilter}
                >
                  <option value="ALL">All statuses</option>
                  {ROUTE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  className="fleet-master-button fleet-master-button--ghost"
                  disabled={isOptimizingRoutes}
                  onClick={() => void handleOptimizeRoutes()}
                  type="button"
                >
                  {isOptimizingRoutes ? 'Optimizing...' : 'Optimize routes'}
                </button>
                <button
                  className="fleet-master-button fleet-master-button--primary"
                  onClick={() => {
                    setRouteModalError('')
                    setRouteModal({ mode: 'create' })
                  }}
                  type="button"
                >
                  Add route
                </button>
              </div>
            </div>

            {filteredRoutes.length ? (
              <div className="fleet-master-table">
                <table>
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Status</th>
                      <th>Distance</th>
                      <th>ETA</th>
                      <th>Stops</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoutes.map((route) => (
                      <tr key={route.id}>
                        <td>
                          <strong>{route.name}</strong>
                          <span>{route.id}</span>
                        </td>
                        <td><span className={routeStatusTone(route.status)}>{route.status}</span></td>
                        <td>{formatNumber(route.distanceKm)} km</td>
                        <td>{route.estimatedDuration}</td>
                        <td className="fleet-master-table__wide">{stopSummary(route.stops)}</td>
                        <td>
                          <div className="fleet-master-table__actions">
                            <button
                              className="fleet-master-button fleet-master-button--ghost"
                              onClick={() => {
                                setRouteModalError('')
                                setRouteModal({ mode: 'edit', route })
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="fleet-master-button fleet-master-button--danger"
                              disabled={deletingRouteId === route.id}
                              onClick={() => void handleDeleteRoute(route)}
                              type="button"
                            >
                              {deletingRouteId === route.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                description="Try changing search filters or create a route plan with at least two stops."
                title="No routes match the current view"
              />
            )}
          </section>
        ) : null}
      </section>

      {vehicleModal ? (
        <VehicleFormModal
          error={vehicleModalError}
          initialValue={vehicleModal.mode === 'edit' ? vehicleModal.vehicle : undefined}
          isSubmitting={isSubmittingVehicle}
          mode={vehicleModal.mode}
          onClose={() => setVehicleModal(null)}
          onSubmit={handleVehicleSubmit}
        />
      ) : null}

      {driverModal ? (
        <DriverFormModal
          error={driverModalError}
          initialValue={driverModal.mode === 'edit' ? driverModal.driver : undefined}
          isSubmitting={isSubmittingDriver}
          mode={driverModal.mode}
          onClose={() => setDriverModal(null)}
          onSubmit={handleDriverSubmit}
          vehicleOptions={vehicles}
        />
      ) : null}

      {driverShiftModal ? (
        <DriverShiftModal
          error={driverShiftError}
          initialValue={driverShiftModal.driver}
          isSubmitting={isSubmittingShift}
          onClose={() => setDriverShiftModal(null)}
          onSubmit={handleShiftSubmit}
          vehicleOptions={vehicles}
        />
      ) : null}

      {routeModal ? (
        <RouteFormModal
          error={routeModalError}
          initialValue={routeModal.mode === 'edit' ? routeModal.route : undefined}
          isSubmitting={isSubmittingRoute}
          mode={routeModal.mode}
          onClose={() => setRouteModal(null)}
          onSubmit={handleRouteSubmit}
        />
      ) : null}
    </div>
  )
}
