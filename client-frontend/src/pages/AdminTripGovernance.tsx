import { useDeferredValue, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDriversList } from '../services/driverService'
import { fetchRoutesList } from '../services/routeService'
import {
  cancelGovernanceTrip,
  createGovernanceTrip,
  dispatchGovernanceTrip,
  fetchGovernanceTrips,
  optimizeGovernanceTrip,
  validateGovernanceTrip,
} from '../services/tripGovernanceService'
import { fetchVehiclesList } from '../services/vehicleService'
import type {
  CreateTripInput,
  Driver,
  RoutePlan,
  Trip,
  TripPriority,
  TripStatus,
  Vehicle,
} from '../types'
import {
  patchAdminTripGovernanceState,
  resetAdminTripGovernanceState,
} from '../store/adminModuleSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import './AdminTripGovernance.css'

const tripQueryKey = ['admin-trip-governance', 'trips'] as const
const routeQueryKey = ['admin-trip-governance', 'routes'] as const
const driverQueryKey = ['admin-trip-governance', 'drivers'] as const
const vehicleQueryKey = ['admin-trip-governance', 'vehicles'] as const

const TRIP_STATUS_FILTERS: Array<'ALL' | TripStatus> = [
  'ALL',
  'DRAFT',
  'VALIDATED',
  'OPTIMIZED',
  'DISPATCHED',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'BLOCKED',
]

const PRIORITIES: TripPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function buildInitialTripForm(route?: RoutePlan | null): CreateTripInput {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const yyyyMmDd = tomorrow.toISOString().slice(0, 10)

  if (!route) {
    return {
      routeId: '',
      assignedVehicleId: '',
      assignedDriverId: '',
      source: '',
      destination: '',
      stops: [],
      plannedStartTime: `${yyyyMmDd}T08:00`,
      plannedEndTime: `${yyyyMmDd}T18:00`,
      estimatedDistance: 0,
      estimatedDuration: '',
      priority: 'MEDIUM',
      remarks: '',
    }
  }

  const normalizedStops = route.stops.map((stop, index) => ({
    ...stop,
    sequence: index + 1,
    status: 'PENDING' as const,
    arrivalTime: undefined,
    departureTime: undefined,
  }))

  return {
    routeId: route.id,
    assignedVehicleId: '',
    assignedDriverId: '',
    source: normalizedStops[0]?.name ?? route.name,
    destination: normalizedStops[normalizedStops.length - 1]?.name ?? route.name,
    stops: normalizedStops,
    plannedStartTime: `${yyyyMmDd}T08:00`,
    plannedEndTime: `${yyyyMmDd}T18:00`,
    estimatedDistance: route.distanceKm,
    estimatedDuration: route.estimatedDuration,
    priority: 'MEDIUM',
    remarks: '',
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not scheduled'
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatShortDateTime(value?: string | null) {
  if (!value) {
    return 'Not scheduled'
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function tripStatusClass(status: Trip['status']) {
  switch (status) {
    case 'COMPLETED':
      return 'admin-trip-pill admin-trip-pill--success'
    case 'DISPATCHED':
    case 'IN_PROGRESS':
      return 'admin-trip-pill admin-trip-pill--info'
    case 'PAUSED':
      return 'admin-trip-pill admin-trip-pill--warning'
    case 'CANCELLED':
      return 'admin-trip-pill admin-trip-pill--neutral'
    case 'BLOCKED':
      return 'admin-trip-pill admin-trip-pill--danger'
    default:
      return 'admin-trip-pill admin-trip-pill--violet'
  }
}

function complianceClass(status: Trip['complianceStatus']) {
  switch (status) {
    case 'COMPLIANT':
      return 'admin-trip-pill admin-trip-pill--success'
    case 'REVIEW_REQUIRED':
      return 'admin-trip-pill admin-trip-pill--warning'
    case 'BLOCKED':
      return 'admin-trip-pill admin-trip-pill--danger'
    default:
      return 'admin-trip-pill admin-trip-pill--neutral'
  }
}

function optimizationClass(status: Trip['optimizationStatus']) {
  switch (status) {
    case 'OPTIMIZED':
      return 'admin-trip-pill admin-trip-pill--success'
    case 'FAILED':
      return 'admin-trip-pill admin-trip-pill--danger'
    case 'READY':
      return 'admin-trip-pill admin-trip-pill--info'
    default:
      return 'admin-trip-pill admin-trip-pill--neutral'
  }
}

function dispatchClass(status: Trip['dispatchStatus']) {
  switch (status) {
    case 'DISPATCHED':
      return 'admin-trip-pill admin-trip-pill--info'
    case 'QUEUED':
      return 'admin-trip-pill admin-trip-pill--warning'
    case 'RELEASED':
      return 'admin-trip-pill admin-trip-pill--neutral'
    default:
      return 'admin-trip-pill admin-trip-pill--neutral'
  }
}

function canValidateTrip(trip: Trip) {
  return trip.status === 'DRAFT' || trip.status === 'BLOCKED'
}

function canOptimizeTrip(trip: Trip) {
  return trip.status === 'DRAFT' || trip.status === 'VALIDATED' || trip.status === 'BLOCKED'
}

function canDispatchTrip(trip: Trip) {
  return trip.status === 'DRAFT' || trip.status === 'VALIDATED' || trip.status === 'OPTIMIZED' || trip.status === 'BLOCKED'
}

function canCancelTrip(trip: Trip) {
  return trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED'
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function formatReferenceLoadIssue(label: string, error: unknown) {
  return error instanceof Error ? `${label}: ${error.message}` : ''
}

function summarizeStops(trip: Trip) {
  return trip.stops.map((stop) => stop.name).join(' -> ')
}

function validateTripDraft(form: CreateTripInput) {
  if (!form.routeId || !form.assignedVehicleId || !form.assignedDriverId) {
    return 'Route, vehicle, and driver are required.'
  }

  if (!form.source.trim() || !form.destination.trim() || form.stops.length < 2) {
    return 'The selected route must provide at least two stops.'
  }

  if (!form.plannedStartTime || !form.plannedEndTime) {
    return 'Planned start and end times are required.'
  }

  if (new Date(form.plannedEndTime).getTime() <= new Date(form.plannedStartTime).getTime()) {
    return 'Planned end time must be after the planned start time.'
  }

  return ''
}

function ModalShell({
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
}: {
  eyebrow: string
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="admin-trip-modal" onClick={onClose} role="presentation">
      <div
        aria-label={title}
        aria-modal="true"
        className="admin-trip-modal__card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="admin-trip-modal__header">
          <div>
            <span className="admin-trip-modal__eyebrow">{eyebrow}</span>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button className="admin-trip-button admin-trip-button--ghost" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CreateTripModal({
  routes,
  drivers,
  vehicles,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  routes: RoutePlan[]
  drivers: Driver[]
  vehicles: Vehicle[]
  isSubmitting: boolean
  error: string
  onClose: () => void
  onSubmit: (form: CreateTripInput) => Promise<void>
}) {
  const [form, setForm] = useState<CreateTripInput>(() => buildInitialTripForm(routes[0] ?? null))
  const isCatalogReady = routes.length > 0 && drivers.length > 0 && vehicles.length > 0

  function applyRoute(routeId: string) {
    const selectedRoute = routes.find((route) => route.id === routeId) ?? null
    setForm((current) => {
      const routeDraft = buildInitialTripForm(selectedRoute)
      return {
        ...routeDraft,
        assignedDriverId: current.assignedDriverId,
        assignedVehicleId: current.assignedVehicleId,
        priority: current.priority,
        plannedStartTime: current.plannedStartTime || routeDraft.plannedStartTime,
        plannedEndTime: current.plannedEndTime || routeDraft.plannedEndTime,
        remarks: current.remarks,
      }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isCatalogReady) {
      return
    }

    await onSubmit(form)
  }

  return (
    <ModalShell
      eyebrow="Create trip"
      onClose={onClose}
      subtitle="Stage a trip from the route catalog, then validate, optimize, dispatch, or cancel it from the same screen."
      title="Create governed trip"
    >
      <form className="admin-trip-form" onSubmit={handleSubmit}>
        <div className="admin-trip-form__grid">
          <label>
            <span>Route template</span>
            <select onChange={(event) => applyRoute(event.target.value)} value={form.routeId}>
              <option value="">Select route</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {`${route.id} - ${route.name}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Vehicle</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, assignedVehicleId: event.target.value }))}
              value={form.assignedVehicleId}
            >
              <option value="">Select vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {`${vehicle.id} - ${vehicle.name}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Driver</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, assignedDriverId: event.target.value }))}
              value={form.assignedDriverId}
            >
              <option value="">Select driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {`${driver.id} - ${driver.name}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TripPriority }))} value={form.priority}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Planned start</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, plannedStartTime: event.target.value }))}
              type="datetime-local"
              value={form.plannedStartTime}
            />
          </label>
          <label>
            <span>Planned end</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, plannedEndTime: event.target.value }))}
              type="datetime-local"
              value={form.plannedEndTime}
            />
          </label>
          <label className="admin-trip-form__span">
            <span>Route summary</span>
            <div className="admin-trip-form__readonly">
              <strong>{form.source || 'Select a route to begin'}</strong>
              <p>{form.destination ? `${form.source} -> ${form.destination}` : 'Origin and destination will come from the route template.'}</p>
              <small>{`${form.stops.length} stops - ${form.estimatedDistance} km - ${form.estimatedDuration || 'No ETA yet'}`}</small>
            </div>
          </label>
          <label className="admin-trip-form__span">
            <span>Remarks</span>
            <textarea
              onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
              rows={3}
              value={form.remarks ?? ''}
            />
          </label>
        </div>
        {!isCatalogReady ? (
          <div className="admin-trip-form__error">
            Route, driver, and vehicle catalogs must be available before a new trip can be created.
          </div>
        ) : null}
        {error ? <div className="admin-trip-form__error">{error}</div> : null}
        <div className="admin-trip-form__actions">
          <button className="admin-trip-button admin-trip-button--ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="admin-trip-button admin-trip-button--primary" disabled={isSubmitting || !isCatalogReady} type="submit">
            {isSubmitting ? 'Creating...' : 'Create trip'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function DispatchModal({
  trip,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  trip: Trip
  isSubmitting: boolean
  error: string
  onClose: () => void
  onSubmit: (overrideValidation: boolean) => Promise<void>
}) {
  const [overrideValidation, setOverrideValidation] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(overrideValidation)
  }

  return (
    <ModalShell
      eyebrow="Dispatch trip"
      onClose={onClose}
      subtitle="Admin can force dispatch with override if validation blockers still exist."
      title={`Dispatch ${trip.tripId}`}
    >
      <form className="admin-trip-form" onSubmit={handleSubmit}>
        <div className="admin-trip-modal__summary">
          <div>
            <small>Status</small>
            <span className={tripStatusClass(trip.status)}>{trip.status}</span>
          </div>
          <div>
            <small>Compliance</small>
            <span className={complianceClass(trip.complianceStatus)}>{trip.complianceStatus}</span>
          </div>
          <div>
            <small>Optimization</small>
            <span className={optimizationClass(trip.optimizationStatus)}>{trip.optimizationStatus}</span>
          </div>
        </div>

        <label className="admin-trip-checkbox">
          <input checked={overrideValidation} onChange={(event) => setOverrideValidation(event.target.checked)} type="checkbox" />
          <span>Override validation blockers and dispatch anyway</span>
        </label>

        <div className="admin-trip-modal__note">
          <strong>Real status handling</strong>
          <p>
            Override does not fake compliance. The trip can be dispatched while compliance state remains
            blocked or review required, so the admin can still see the true lifecycle condition.
          </p>
        </div>

        {error ? <div className="admin-trip-form__error">{error}</div> : null}
        <div className="admin-trip-form__actions">
          <button className="admin-trip-button admin-trip-button--ghost" onClick={onClose} type="button">
            Back
          </button>
          <button className="admin-trip-button admin-trip-button--primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Dispatching...' : overrideValidation ? 'Force dispatch' : 'Dispatch trip'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function CancelModal({
  trip,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  trip: Trip
  isSubmitting: boolean
  error: string
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit(reason)
  }

  return (
    <ModalShell
      eyebrow="Cancel trip"
      onClose={onClose}
      subtitle="Cancel the trip and release reserved resources when lifecycle rules permit."
      title={`Cancel ${trip.tripId}`}
    >
      <form className="admin-trip-form" onSubmit={handleSubmit}>
        <label className="admin-trip-form__span">
          <span>Reason</span>
          <textarea onChange={(event) => setReason(event.target.value)} placeholder="Optional reason for cancellation" rows={4} value={reason} />
        </label>
        {error ? <div className="admin-trip-form__error">{error}</div> : null}
        <div className="admin-trip-form__actions">
          <button className="admin-trip-button admin-trip-button--ghost" onClick={onClose} type="button">
            Back
          </button>
          <button className="admin-trip-button admin-trip-button--danger" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Cancelling...' : 'Cancel trip'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

export function AdminTripGovernancePage() {
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const {
    search,
    statusFilter,
    selectedTripId,
    notice,
    showCreateModal,
    dispatchTripId,
    cancelTripId,
    validationResult,
    optimizationResult,
  } = useAppSelector((state) => state.adminModule.tripGovernance)
  const [createError, setCreateError] = useState('')
  const [dispatchError, setDispatchError] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    dispatch(resetAdminTripGovernanceState())
  }, [dispatch])

  const tripsQuery = useQuery({ queryKey: tripQueryKey, queryFn: fetchGovernanceTrips })
  const routesQuery = useQuery({ queryKey: routeQueryKey, queryFn: fetchRoutesList })
  const driversQuery = useQuery({ queryKey: driverQueryKey, queryFn: fetchDriversList })
  const vehiclesQuery = useQuery({ queryKey: vehicleQueryKey, queryFn: fetchVehiclesList })

  const trips = tripsQuery.data ?? []
  const routes = routesQuery.data ?? []
  const drivers = driversQuery.data ?? []
  const vehicles = vehiclesQuery.data ?? []

  useEffect(() => {
    if (!selectedTripId && trips[0]) {
      dispatch(patchAdminTripGovernanceState({ selectedTripId: trips[0].tripId }))
    }

    if (selectedTripId && !trips.some((trip) => trip.tripId === selectedTripId)) {
      dispatch(patchAdminTripGovernanceState({ selectedTripId: trips[0]?.tripId ?? null }))
    }
  }, [dispatch, selectedTripId, trips])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timer = window.setTimeout(() => dispatch(patchAdminTripGovernanceState({ notice: null })), 4800)
    return () => window.clearTimeout(timer)
  }, [dispatch, notice])

  const routeLookup = useMemo(() => new Map(routes.map((route) => [route.id, route])), [routes])
  const driverLookup = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers])
  const vehicleLookup = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles])
  const referenceLoadIssues = useMemo(
    () =>
      [
        formatReferenceLoadIssue('Routes', routesQuery.error),
        formatReferenceLoadIssue('Drivers', driversQuery.error),
        formatReferenceLoadIssue('Vehicles', vehiclesQuery.error),
      ].filter(Boolean),
    [driversQuery.error, routesQuery.error, vehiclesQuery.error],
  )
  const isReferenceDataLoading = routesQuery.isPending || driversQuery.isPending || vehiclesQuery.isPending

  const filteredTrips = useMemo(() => {
    const query = normalizeSearch(deferredSearch)
    return trips.filter((trip) => {
      const matchesSearch =
        !query ||
        [
          trip.tripId,
          trip.routeId,
          routeLookup.get(trip.routeId)?.name ?? '',
          trip.assignedDriverId,
          driverLookup.get(trip.assignedDriverId)?.name ?? '',
          trip.assignedVehicleId,
          trip.source,
          trip.destination,
        ].some((value) => value.toLowerCase().includes(query))

      const matchesStatus = statusFilter === 'ALL' || trip.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [deferredSearch, driverLookup, routeLookup, statusFilter, trips])

  const selectedTrip =
    filteredTrips.find((trip) => trip.tripId === selectedTripId) ??
    trips.find((trip) => trip.tripId === selectedTripId) ??
    filteredTrips[0] ??
    trips[0] ??
    null
  const dispatchTrip = trips.find((trip) => trip.tripId === dispatchTripId) ?? null
  const cancelTrip = trips.find((trip) => trip.tripId === cancelTripId) ?? null

  const activeTrips = trips.filter((trip) => ['DISPATCHED', 'IN_PROGRESS', 'PAUSED'].includes(trip.status)).length
  const blockedTrips = trips.filter((trip) => trip.status === 'BLOCKED').length
  const completedTrips = trips.filter((trip) => trip.status === 'COMPLETED').length
  const canCreateTrip =
    !isReferenceDataLoading &&
    referenceLoadIssues.length === 0 &&
    routes.length > 0 &&
    drivers.length > 0 &&
    vehicles.length > 0
  const createTripDisabledReason = isReferenceDataLoading
    ? 'Trip catalogs are still loading.'
    : referenceLoadIssues.length
      ? 'Trip creation is unavailable until route, driver, and vehicle access is restored.'
      : routes.length === 0
        ? 'Create at least one route before creating a trip.'
        : drivers.length === 0
          ? 'Create at least one driver before creating a trip.'
          : vehicles.length === 0
            ? 'Create at least one vehicle before creating a trip.'
            : ''

  async function refreshGovernanceData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tripQueryKey }),
      queryClient.invalidateQueries({ queryKey: routeQueryKey }),
      queryClient.invalidateQueries({ queryKey: vehicleQueryKey }),
      queryClient.invalidateQueries({ queryKey: driverQueryKey }),
    ])
  }

  async function handleCreateTrip(form: CreateTripInput) {
    const validationError = validateTripDraft(form)
    if (validationError) {
      setCreateError(validationError)
      return
    }

    setIsCreating(true)
    setCreateError('')

    try {
      const createdTrip = await createGovernanceTrip(form)
      await refreshGovernanceData()
      dispatch(patchAdminTripGovernanceState({
        selectedTripId: createdTrip.tripId,
        validationResult: null,
        optimizationResult: null,
        notice: { tone: 'success', text: `Trip ${createdTrip.tripId} created in draft state.` },
        showCreateModal: false,
      }))
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to create trip.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleValidateTrip(trip: Trip) {
    setActiveActionId(`${trip.tripId}:validate`)
    try {
      const result = await validateGovernanceTrip(trip.tripId)
      await refreshGovernanceData()
      dispatch(patchAdminTripGovernanceState({
        selectedTripId: trip.tripId,
        validationResult: result,
        optimizationResult: null,
        notice: {
          tone: result.valid ? 'success' : 'error',
          text: result.valid ? `Trip ${trip.tripId} passed validation.` : `Trip ${trip.tripId} still has validation blockers.`,
        },
      }))
    } catch (error) {
      dispatch(patchAdminTripGovernanceState({
        notice: { tone: 'error', text: error instanceof Error ? error.message : 'Validation failed.' },
      }))
    } finally {
      setActiveActionId(null)
    }
  }

  async function handleOptimizeTrip(trip: Trip) {
    setActiveActionId(`${trip.tripId}:optimize`)
    try {
      const result = await optimizeGovernanceTrip(trip.tripId)
      await refreshGovernanceData()
      dispatch(patchAdminTripGovernanceState({
        selectedTripId: trip.tripId,
        optimizationResult: result,
        notice: { tone: 'success', text: `Trip ${trip.tripId} optimized.` },
      }))
    } catch (error) {
      dispatch(patchAdminTripGovernanceState({
        notice: { tone: 'error', text: error instanceof Error ? error.message : 'Optimization failed.' },
      }))
    } finally {
      setActiveActionId(null)
    }
  }

  async function handleDispatchTrip(overrideValidation: boolean) {
    if (!dispatchTrip) {
      return
    }

    setIsDispatching(true)
    setDispatchError('')

    try {
      await dispatchGovernanceTrip(dispatchTrip.tripId, { overrideValidation })
      await refreshGovernanceData()
      dispatch(patchAdminTripGovernanceState({
        selectedTripId: dispatchTrip.tripId,
        validationResult: null,
        optimizationResult: null,
        notice: {
          tone: 'success',
          text: overrideValidation
            ? `Trip ${dispatchTrip.tripId} dispatched with admin override.`
            : `Trip ${dispatchTrip.tripId} dispatched successfully.`,
        },
        dispatchTripId: null,
      }))
    } catch (error) {
      setDispatchError(error instanceof Error ? error.message : 'Dispatch failed.')
    } finally {
      setIsDispatching(false)
    }
  }

  async function handleCancelTrip(reason: string) {
    if (!cancelTrip) {
      return
    }

    setIsCancelling(true)
    setCancelError('')

    try {
      await cancelGovernanceTrip(cancelTrip.tripId, reason)
      await refreshGovernanceData()
      dispatch(patchAdminTripGovernanceState({
        selectedTripId: cancelTrip.tripId,
        validationResult: null,
        optimizationResult: null,
        notice: { tone: 'success', text: `Trip ${cancelTrip.tripId} cancelled.` },
        cancelTripId: null,
      }))
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Cancellation failed.')
    } finally {
      setIsCancelling(false)
    }
  }

  const isLoading = tripsQuery.isPending
  const loadError = tripsQuery.error instanceof Error ? tripsQuery.error.message : ''

  if (isLoading) {
    return (
      <div className="admin-trip-loading">
        <div className="admin-trip-loading__spinner" />
        <span>Loading admin trip governance...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="admin-trip-error">
        <strong>Unable to load trip governance</strong>
        <p>{loadError}</p>
        <button className="admin-trip-button admin-trip-button--primary" onClick={() => void refreshGovernanceData()} type="button">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="admin-trip-governance">
      <section className="admin-trip-hero">
        <div className="admin-trip-hero__copy">
          <span className="admin-trip-hero__eyebrow">Admin control</span>
          <h2>Trip Governance System</h2>
          <p>
            Create, validate, optimize, dispatch, and cancel trips from one lifecycle console. Admin override
            keeps dispatch possible even when validation blockers still exist, while preserving the real backend states.
          </p>
        </div>
        <div className="admin-trip-hero__stats">
          <article>
            <span>Total trips</span>
            <strong>{trips.length}</strong>
          </article>
          <article>
            <span>Active</span>
            <strong>{activeTrips}</strong>
          </article>
          <article>
            <span>Blocked</span>
            <strong>{blockedTrips}</strong>
          </article>
          <article>
            <span>Completed</span>
            <strong>{completedTrips}</strong>
          </article>
        </div>
      </section>

      {notice ? (
        <section className={`admin-trip-notice admin-trip-notice--${notice.tone}`}>
          <strong>{notice.tone === 'success' ? 'Success' : 'Attention'}</strong>
          <p>{notice.text}</p>
        </section>
      ) : null}

      {referenceLoadIssues.length ? (
        <section className="admin-trip-notice admin-trip-notice--warning">
          <strong>Reference data unavailable</strong>
          <p>
            {referenceLoadIssues.join(' ')} Existing trip lifecycle data is still available, but create flow and
            friendly labels may be limited until these catalogs load.
          </p>
        </section>
      ) : null}

      <section className="admin-trip-toolbar">
        <div>
          <h3>Lifecycle table</h3>
          <p>Real statuses from the `/trips` lifecycle, with validation, optimization, dispatch, and cancellation controls.</p>
          {!canCreateTrip && createTripDisabledReason ? (
            <p className="admin-trip-toolbar__meta">{createTripDisabledReason}</p>
          ) : null}
        </div>
        <div className="admin-trip-toolbar__actions">
          <input
            className="admin-trip-toolbar__search"
            onChange={(event) => dispatch(patchAdminTripGovernanceState({ search: event.target.value }))}
            placeholder="Search by trip, route, driver, or location..."
            type="search"
            value={search}
          />
          <select
            className="admin-trip-toolbar__filter"
            onChange={(event) => dispatch(patchAdminTripGovernanceState({ statusFilter: event.target.value as 'ALL' | TripStatus }))}
            value={statusFilter}
          >
            {TRIP_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All statuses' : status}
              </option>
            ))}
          </select>
          <button
            className="admin-trip-button admin-trip-button--primary"
            disabled={!canCreateTrip}
            onClick={() => {
              if (!canCreateTrip) {
                return
              }

              setCreateError('')
              dispatch(patchAdminTripGovernanceState({ showCreateModal: true }))
            }}
            title={createTripDisabledReason}
            type="button"
          >
            Create trip
          </button>
        </div>
      </section>

      <div className="admin-trip-layout">
        <section className="admin-trip-table">
          <table>
            <thead>
              <tr>
                <th>Trip ID</th>
                <th>Route</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map((trip) => (
                <tr
                  key={trip.tripId}
                  className={trip.tripId === selectedTrip?.tripId ? 'admin-trip-table__row--selected' : ''}
                  onClick={() => dispatch(patchAdminTripGovernanceState({ selectedTripId: trip.tripId }))}
                >
                  <td>
                    <strong>{trip.tripId}</strong>
                    <span>{formatShortDateTime(trip.plannedStartTime)}</span>
                  </td>
                  <td>
                    <strong>{routeLookup.get(trip.routeId)?.name ?? trip.routeId}</strong>
                    <span>{trip.source}{' -> '}{trip.destination}</span>
                  </td>
                  <td>
                    <strong>{driverLookup.get(trip.assignedDriverId)?.name ?? trip.assignedDriverId}</strong>
                    <span>{trip.assignedVehicleId}</span>
                  </td>
                  <td>
                    <span className={tripStatusClass(trip.status)}>{trip.status}</span>
                    <small>{trip.complianceStatus} - {trip.dispatchStatus}</small>
                  </td>
                  <td>
                    <div className="admin-trip-table__actions">
                      <button
                        className="admin-trip-button admin-trip-button--ghost"
                        disabled={!canValidateTrip(trip) || activeActionId !== null}
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleValidateTrip(trip)
                        }}
                        type="button"
                      >
                        {activeActionId === `${trip.tripId}:validate` ? 'Validating...' : 'Validate'}
                      </button>
                      <button
                        className="admin-trip-button admin-trip-button--ghost"
                        disabled={!canOptimizeTrip(trip) || activeActionId !== null}
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleOptimizeTrip(trip)
                        }}
                        type="button"
                      >
                        {activeActionId === `${trip.tripId}:optimize` ? 'Optimizing...' : 'Optimize'}
                      </button>
                      <button
                        className="admin-trip-button admin-trip-button--primary"
                        disabled={!canDispatchTrip(trip) || isDispatching}
                        onClick={(event) => {
                          event.stopPropagation()
                          setDispatchError('')
                          dispatch(patchAdminTripGovernanceState({ dispatchTripId: trip.tripId }))
                        }}
                        type="button"
                      >
                        Dispatch
                      </button>
                      <button
                        className="admin-trip-button admin-trip-button--danger"
                        disabled={!canCancelTrip(trip) || isCancelling}
                        onClick={(event) => {
                          event.stopPropagation()
                          setCancelError('')
                          dispatch(patchAdminTripGovernanceState({ cancelTripId: trip.tripId }))
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredTrips.length ? (
            <div className="admin-trip-empty">
              <strong>No trips match the current view</strong>
              <p>Adjust the search or status filter, or create a new trip from the governance modal.</p>
            </div>
          ) : null}
        </section>

        <aside className="admin-trip-detail">
          {selectedTrip ? (
            <>
              <section className="admin-trip-detail__hero">
                <div>
                  <span className="admin-trip-detail__eyebrow">Selected trip</span>
                  <h3>{selectedTrip.tripId}</h3>
                  <p>{routeLookup.get(selectedTrip.routeId)?.name ?? selectedTrip.routeId}</p>
                </div>
                <span className={tripStatusClass(selectedTrip.status)}>{selectedTrip.status}</span>
              </section>

              <section className="admin-trip-detail__status-grid">
                <article>
                  <small>Compliance</small>
                  <span className={complianceClass(selectedTrip.complianceStatus)}>{selectedTrip.complianceStatus}</span>
                </article>
                <article>
                  <small>Optimization</small>
                  <span className={optimizationClass(selectedTrip.optimizationStatus)}>{selectedTrip.optimizationStatus}</span>
                </article>
                <article>
                  <small>Dispatch</small>
                  <span className={dispatchClass(selectedTrip.dispatchStatus)}>{selectedTrip.dispatchStatus}</span>
                </article>
              </section>

              <section className="admin-trip-detail__block">
                <h4>Trip context</h4>
                <div className="admin-trip-detail__kv">
                  <div>
                    <span>Route</span>
                    <strong>{routeLookup.get(selectedTrip.routeId)?.name ?? selectedTrip.routeId}</strong>
                  </div>
                  <div>
                    <span>Driver</span>
                    <strong>{driverLookup.get(selectedTrip.assignedDriverId)?.name ?? selectedTrip.assignedDriverId}</strong>
                  </div>
                  <div>
                    <span>Vehicle</span>
                    <strong>{vehicleLookup.get(selectedTrip.assignedVehicleId)?.name ?? selectedTrip.assignedVehicleId}</strong>
                  </div>
                  <div>
                    <span>Window</span>
                    <strong>{formatDateTime(selectedTrip.plannedStartTime)}</strong>
                  </div>
                </div>
              </section>

              <section className="admin-trip-detail__block">
                <h4>Stops</h4>
                <p>{summarizeStops(selectedTrip)}</p>
              </section>

              <section className="admin-trip-detail__block">
                <h4>Latest validation</h4>
                {validationResult && validationResult.tripId === selectedTrip.tripId ? (
                  <>
                    <div className="admin-trip-detail__result-head">
                      <span className={validationResult.valid ? 'admin-trip-pill admin-trip-pill--success' : 'admin-trip-pill admin-trip-pill--danger'}>
                        {validationResult.valid ? 'Passed' : 'Blocked'}
                      </span>
                      <small>{validationResult.recommendedAction}</small>
                    </div>
                    {validationResult.blockingReasons.length ? (
                      <ul>
                        {validationResult.blockingReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                    {validationResult.warnings.length ? (
                      <div className="admin-trip-detail__callout">
                        <strong>Warnings</strong>
                        <p>{validationResult.warnings.join(' ')}</p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p>No validation response captured in this session yet. Use the table action to evaluate the trip.</p>
                )}
              </section>

              <section className="admin-trip-detail__block">
                <h4>Latest optimization</h4>
                {optimizationResult && optimizationResult.tripId === selectedTrip.tripId ? (
                  <>
                    <div className="admin-trip-detail__result-head">
                      <span className={optimizationClass(optimizationResult.optimizationStatus)}>{optimizationResult.optimizationStatus}</span>
                      <small>Score {optimizationResult.routeScore}/100</small>
                    </div>
                    <div className="admin-trip-detail__kv admin-trip-detail__kv--compact">
                      <div>
                        <span>Distance</span>
                        <strong>{optimizationResult.estimatedDistance} km</strong>
                      </div>
                      <div>
                        <span>Duration</span>
                        <strong>{optimizationResult.estimatedDuration}</strong>
                      </div>
                    </div>
                    <p>{optimizationResult.notes}</p>
                  </>
                ) : (
                  <p>No optimization response captured in this session yet. Optimize from the lifecycle table when needed.</p>
                )}
              </section>
            </>
          ) : (
            <div className="admin-trip-empty">
              <strong>No trip selected</strong>
              <p>Select a row from the lifecycle table to inspect real trip statuses and action results.</p>
            </div>
          )}
        </aside>
      </div>

      {showCreateModal ? (
        <CreateTripModal
          drivers={drivers}
          error={createError}
          isSubmitting={isCreating}
          onClose={() => dispatch(patchAdminTripGovernanceState({ showCreateModal: false }))}
          onSubmit={handleCreateTrip}
          routes={routes}
          vehicles={vehicles}
        />
      ) : null}

      {dispatchTrip ? (
        <DispatchModal
          error={dispatchError}
          isSubmitting={isDispatching}
          onClose={() => dispatch(patchAdminTripGovernanceState({ dispatchTripId: null }))}
          onSubmit={handleDispatchTrip}
          trip={dispatchTrip}
        />
      ) : null}

      {cancelTrip ? (
        <CancelModal
          error={cancelError}
          isSubmitting={isCancelling}
          onClose={() => dispatch(patchAdminTripGovernanceState({ cancelTripId: null }))}
          onSubmit={handleCancelTrip}
          trip={cancelTrip}
        />
      ) : null}
    </div>
  )
}
