import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { canManageMaintenance } from '../security/permissions'
import {
  createMaintenanceSchedule,
  fetchMaintenanceAlerts,
  fetchMaintenanceSchedules,
  fetchVehicles,
  updateMaintenanceScheduleStatus,
} from '../services/apiService'
import type {
  CreateMaintenanceScheduleInput,
  MaintenanceAlert,
  MaintenanceSchedule,
  MaintenanceScheduleStatus,
  Vehicle,
} from '../types'

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultScheduleForm(vehicleId = ''): CreateMaintenanceScheduleInput {
  const startDate = new Date()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 1)

  return {
    vehicleId,
    title: '',
    status: 'PLANNED',
    plannedStartDate: formatDateInput(startDate),
    plannedEndDate: formatDateInput(endDate),
    blockDispatch: true,
    reasonCode: 'ROUTINE_SERVICE',
    notes: '',
  }
}

function isBlockingSchedule(schedule: MaintenanceSchedule) {
  return schedule.blockDispatch && (schedule.status === 'PLANNED' || schedule.status === 'IN_PROGRESS')
}

function toneClass(tone: string) {
  return `dashboard-summary-card tone-${tone}`
}

function scheduleStatusClass(status: MaintenanceScheduleStatus) {
  if (status === 'IN_PROGRESS') {
    return 'status-pill status-pill--blue'
  }

  if (status === 'COMPLETED') {
    return 'status-pill status-pill--mint'
  }

  if (status === 'CANCELLED') {
    return 'status-pill status-pill--violet'
  }

  return 'status-pill status-pill--amber'
}

function alertSeverityClass(severity: MaintenanceAlert['severity']) {
  if (severity === 'Critical') {
    return 'status-pill status-pill--rose'
  }

  if (severity === 'Medium') {
    return 'status-pill status-pill--amber'
  }

  return 'status-pill status-pill--mint'
}

function vehicleStateClass(vehicle: Vehicle, blocked: boolean) {
  if (blocked || vehicle.status === 'Maintenance') {
    return 'status-pill status-pill--rose'
  }

  if (vehicle.status === 'Idle') {
    return 'status-pill status-pill--amber'
  }

  return 'status-pill status-pill--mint'
}

function formatDisplayDate(value: string) {
  const normalized = value.includes('T') ? value : `${value}T00:00:00`
  const parsed = new Date(normalized)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function scheduleSortValue(status: MaintenanceScheduleStatus) {
  if (status === 'IN_PROGRESS') {
    return 0
  }

  if (status === 'PLANNED') {
    return 1
  }

  if (status === 'COMPLETED') {
    return 2
  }

  return 3
}

function buildManageAlertsPath(vehicleId: string) {
  if (!vehicleId) {
    return '/maintenance/alerts'
  }

  return `/maintenance/alerts?vehicleId=${encodeURIComponent(vehicleId)}&openCreate=1`
}

export function MaintenanceDashboard() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedVehicleId = searchParams.get('vehicleId') ?? ''
  const canManage = canManageMaintenance(session?.profile.role)
  const [selectedVehicleId, setSelectedVehicleId] = useState(requestedVehicleId)
  const [form, setForm] = useState<CreateMaintenanceScheduleInput>(() => createDefaultScheduleForm(requestedVehicleId))
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [quickActionBusy, setQuickActionBusy] = useState(false)
  const [actionScheduleId, setActionScheduleId] = useState<string | null>(null)

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: fetchVehicles,
  })
  const schedulesQuery = useQuery({
    queryKey: ['maintenance-schedules'],
    queryFn: fetchMaintenanceSchedules,
  })
  const alertsQuery = useQuery({
    queryKey: ['maintenance-alerts'],
    queryFn: fetchMaintenanceAlerts,
  })

  const vehicles = vehiclesQuery.data ?? []
  const schedules = schedulesQuery.data ?? []
  const alerts = alertsQuery.data ?? []

  useEffect(() => {
    const preferredVehicleId =
      vehicles.find((vehicle) => vehicle.id === requestedVehicleId)?.id ??
      vehicles[0]?.id ??
      ''

    if (preferredVehicleId && !selectedVehicleId) {
      setSelectedVehicleId(preferredVehicleId)
    }
  }, [requestedVehicleId, selectedVehicleId, vehicles])

  useEffect(() => {
    if (!selectedVehicleId) {
      return
    }

    setForm((current) =>
      current.vehicleId === selectedVehicleId
        ? current
        : {
            ...current,
            vehicleId: selectedVehicleId,
          },
    )
  }, [selectedVehicleId])

  async function refreshMaintenanceData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedules'] }),
      queryClient.invalidateQueries({ queryKey: ['maintenance-alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
    ])
  }

  function resetForm(vehicleId = selectedVehicleId) {
    setForm(createDefaultScheduleForm(vehicleId))
  }

  async function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFeedback(null)
    setError(null)

    try {
      await createMaintenanceSchedule(form)
      await refreshMaintenanceData()
      resetForm(form.vehicleId)
      setFeedback(
        form.status === 'IN_PROGRESS' || form.blockDispatch
          ? `Vehicle ${form.vehicleId} is now blocked for maintenance.`
          : `Maintenance scheduled for ${form.vehicleId}.`,
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save maintenance schedule.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleScheduleAction(
    schedule: MaintenanceSchedule,
    nextStatus: Extract<MaintenanceScheduleStatus, 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>,
    notes: string,
  ) {
    setActionScheduleId(schedule.id)
    setFeedback(null)
    setError(null)

    try {
      await updateMaintenanceScheduleStatus(schedule.id, {
        status: nextStatus,
        notes,
      })
      await refreshMaintenanceData()

      if (nextStatus === 'IN_PROGRESS') {
        setFeedback(`Vehicle ${schedule.vehicleId} has been moved into the service bay.`)
      } else if (nextStatus === 'COMPLETED') {
        setFeedback(`Maintenance completed and vehicle ${schedule.vehicleId} is ready for release.`)
      } else {
        setFeedback(`Maintenance block cancelled for vehicle ${schedule.vehicleId}.`)
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update maintenance status.')
    } finally {
      setActionScheduleId((current) => (current === schedule.id ? null : current))
    }
  }

  async function handleImmediateBlock() {
    if (!selectedVehicleId || !canManage) {
      return
    }

    setQuickActionBusy(true)
    setFeedback(null)
    setError(null)

    const selectedVehicleSchedules = schedules
      .filter((schedule) => schedule.vehicleId === selectedVehicleId)
      .sort((left, right) => scheduleSortValue(left.status) - scheduleSortValue(right.status))
    const selectedBlockingSchedule =
      selectedVehicleSchedules.find((schedule) => schedule.status === 'IN_PROGRESS') ??
      selectedVehicleSchedules.find(isBlockingSchedule)
    const selectedVehicleAlerts = alerts.filter((alert) => alert.vehicleId === selectedVehicleId)
    const urgentAlert = selectedVehicleAlerts.find((alert) => alert.severity === 'Critical') ?? selectedVehicleAlerts[0]

    try {
      if (selectedBlockingSchedule?.status === 'IN_PROGRESS') {
        setFeedback(`Vehicle ${selectedVehicleId} is already blocked for active maintenance.`)
        return
      }

      if (selectedBlockingSchedule?.status === 'PLANNED') {
        await updateMaintenanceScheduleStatus(selectedBlockingSchedule.id, {
          status: 'IN_PROGRESS',
          notes: selectedBlockingSchedule.notes ?? 'Started from the maintenance dashboard quick action.',
        })
      } else {
        const startDate = new Date()
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)

        await createMaintenanceSchedule({
          vehicleId: selectedVehicleId,
          title: urgentAlert?.title ?? `Immediate workshop inspection for ${selectedVehicleId}`,
          status: 'IN_PROGRESS',
          plannedStartDate: formatDateInput(startDate),
          plannedEndDate: formatDateInput(endDate),
          blockDispatch: true,
          reasonCode: urgentAlert ? 'ALERT_RESPONSE' : 'UNSCHEDULED',
          notes: urgentAlert?.description ?? 'Created from the maintenance dashboard quick block action.',
        })
      }

      await refreshMaintenanceData()
      setFeedback(`Vehicle ${selectedVehicleId} has been blocked and assigned to active maintenance.`)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to block the selected vehicle.')
    } finally {
      setQuickActionBusy(false)
    }
  }

  if (vehiclesQuery.isLoading || schedulesQuery.isLoading || alertsQuery.isLoading) {
    return <div className="dd-loading">Calibrating the maintenance command center...</div>
  }

  const loadError = vehiclesQuery.error ?? schedulesQuery.error ?? alertsQuery.error
  if (loadError) {
    return (
      <div className="page-shell maintenance-dashboard">
        <section className="panel--flat">
          <div className="panel__header">
            <div>
              <span className="page-header__eyebrow">Maintenance</span>
              <h3>Unable to load workshop data</h3>
            </div>
          </div>
          <p className="muted">
            {loadError instanceof Error ? loadError.message : 'The maintenance workspace could not be loaded.'}
          </p>
        </section>
      </div>
    )
  }

  const today = formatDateInput(new Date())
  const dueSoonDate = new Date()
  dueSoonDate.setDate(dueSoonDate.getDate() + 7)
  const nextWeek = formatDateInput(dueSoonDate)

  const sortedSchedules = [...schedules].sort((left, right) => {
    const statusDiff = scheduleSortValue(left.status) - scheduleSortValue(right.status)
    if (statusDiff !== 0) {
      return statusDiff
    }

    return left.plannedStartDate.localeCompare(right.plannedStartDate)
  })

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    vehicles[0] ??
    null
  const selectedVehicleSchedules = sortedSchedules.filter((schedule) => schedule.vehicleId === selectedVehicleId)
  const selectedVehicleAlerts = alerts.filter((alert) => alert.vehicleId === selectedVehicleId)
  const selectedBlockingSchedule =
    selectedVehicleSchedules.find((schedule) => schedule.status === 'IN_PROGRESS') ??
    selectedVehicleSchedules.find(isBlockingSchedule)

  const blockedSchedules = sortedSchedules.filter(isBlockingSchedule)
  const blockedVehicleIds = new Set(blockedSchedules.map((schedule) => schedule.vehicleId))
  const blockedVehicles = vehicles.filter((vehicle) => blockedVehicleIds.has(vehicle.id))

  const vehiclesInService = vehicles.filter((vehicle) => vehicle.status === 'Maintenance').length
  const overdueAlerts = alerts.filter((alert) => alert.dueDate < today).length
  const dueSoonAlerts = alerts.filter((alert) => alert.dueDate >= today && alert.dueDate <= nextWeek).length
  const readyVehicles = vehicles.filter(
    (vehicle) => vehicle.status !== 'Maintenance' && !blockedVehicleIds.has(vehicle.id),
  ).length

  const summaryCards = [
    { key: 'blocked', label: 'Blocked vehicles', value: blockedVehicles.length, note: 'Dispatch hold active', tone: 'rose' },
    { key: 'service', label: 'In service bay', value: vehiclesInService, note: 'Vehicle status in maintenance', tone: 'blue' },
    { key: 'alerts', label: 'Due this week', value: dueSoonAlerts, note: 'Alerts within 7 days', tone: 'amber' },
    { key: 'overdue', label: 'Overdue alerts', value: overdueAlerts, note: 'Need immediate workshop action', tone: 'violet' },
    { key: 'ready', label: 'Fleet ready', value: readyVehicles, note: 'Clear for dispatch planning', tone: 'mint' },
  ]

  return (
    <div className="page-shell maintenance-dashboard">
      <div className="page-top-actions">
        <button
          className="primary-button"
          disabled={!canManage || !selectedVehicleId || quickActionBusy || selectedBlockingSchedule?.status === 'IN_PROGRESS'}
          onClick={handleImmediateBlock}
          type="button"
        >
          {quickActionBusy
            ? 'Blocking vehicle...'
            : selectedBlockingSchedule?.status === 'IN_PROGRESS'
              ? 'Vehicle already blocked'
              : selectedBlockingSchedule?.status === 'PLANNED'
                ? 'Start planned maintenance'
                : 'Block vehicle now'}
        </button>
        <Link className="secondary-button" to={buildManageAlertsPath(selectedVehicleId)}>
          Manage alerts
        </Link>
      </div>

      <section className="panel--flat maintenance-hero">
        <div className="maintenance-hero__copy">
          <span className="page-header__eyebrow">Maintenance Command Center</span>
          <h2>Control service readiness, dispatch blocks, and live workshop priorities.</h2>
          <p>
            This workspace brings together maintenance alerts, work orders, and vehicle block status so the
            workshop team can protect fleet readiness without bouncing between screens.
          </p>
          {requestedVehicleId ? (
            <div className="maintenance-hero__notice">
              Form and vehicle selection were prefilled for {requestedVehicleId}.
            </div>
          ) : null}
        </div>
        <div className="maintenance-hero__meta">
          <span className="badge">Open work orders {sortedSchedules.length}</span>
          <span className="badge">Alert queue {alerts.length}</span>
          <span className="badge">Blocked dispatch {blockedVehicles.length}</span>
        </div>
      </section>

      {(feedback || error) ? (
        <section className={`maintenance-feedback ${error ? 'maintenance-feedback--error' : 'maintenance-feedback--success'}`}>
          <strong>{error ? 'Action blocked' : 'Update saved'}</strong>
          <p>{error ?? feedback}</p>
        </section>
      ) : null}

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Workshop pulse</span>
            <h2 className="dashboard-section__title">Maintenance overview</h2>
          </div>
          <span className="dashboard-section__counter">{vehicles.length} tracked vehicles</span>
        </div>
        <div className="dashboard-summary-grid">
          {summaryCards.map((card) => (
            <article key={card.key} className={toneClass(card.tone)}>
              <span className="dashboard-summary-card__label">{card.label}</span>
              <strong className="dashboard-summary-card__value">{card.value}</strong>
              <p className="dashboard-summary-card__note">{card.note}</p>
              <span className="dashboard-summary-card__spark" />
            </article>
          ))}
        </div>
      </section>

      <div className="maintenance-dashboard__layout">
        <aside className="panel--flat maintenance-dashboard__fleet">
          <div className="panel__header">
            <div>
              <span className="page-header__eyebrow">Fleet Health</span>
              <h3>Vehicle watchlist</h3>
            </div>
            <span className="badge">{vehicles.length} vehicles</span>
          </div>
          <div className="maintenance-dashboard__fleet-list">
            {vehicles.map((vehicle) => {
              const vehicleAlertCount = alerts.filter((alert) => alert.vehicleId === vehicle.id).length
              const vehicleBlockingSchedule = blockedSchedules.find((schedule) => schedule.vehicleId === vehicle.id)

              return (
                <button
                  key={vehicle.id}
                  className={`maintenance-vehicle-card${selectedVehicleId === vehicle.id ? ' maintenance-vehicle-card--selected' : ''}`}
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                  type="button"
                >
                  <div className="maintenance-vehicle-card__top">
                    <div>
                      <span className="page-header__eyebrow">{vehicle.id}</span>
                      <strong>{vehicle.name}</strong>
                    </div>
                    <span className={vehicleStateClass(vehicle, Boolean(vehicleBlockingSchedule))}>
                      {vehicleBlockingSchedule ? 'Blocked' : vehicle.status}
                    </span>
                  </div>
                  <p>{vehicle.location}</p>
                  <div className="maintenance-vehicle-card__meta">
                    <span>{vehicle.type}</span>
                    <span>{vehicle.mileage.toLocaleString()} km</span>
                    <span>{vehicleAlertCount} alerts</span>
                  </div>
                  <div className="maintenance-vehicle-card__fuel">
                    <div
                      className="maintenance-vehicle-card__fuel-bar"
                      style={{ width: `${Math.max(8, vehicle.fuelLevel)}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="maintenance-dashboard__main">
          {selectedVehicle ? (
            <section className="panel--flat maintenance-spotlight">
              <div className="maintenance-spotlight__header">
                <div>
                  <span className="page-header__eyebrow">Selected Vehicle</span>
                  <h3>{selectedVehicle.name} ({selectedVehicle.id})</h3>
                  <p className="muted">
                    {selectedVehicle.type} operating from {selectedVehicle.location}
                  </p>
                </div>
                <div className="card-actions">
                  <span className={vehicleStateClass(selectedVehicle, Boolean(selectedBlockingSchedule))}>
                    {selectedBlockingSchedule ? 'Dispatch blocked' : selectedVehicle.status}
                  </span>
                  {selectedBlockingSchedule?.status === 'IN_PROGRESS' ? (
                    <button
                      className="secondary-button"
                      disabled={!canManage || actionScheduleId === selectedBlockingSchedule.id}
                      onClick={() =>
                        handleScheduleAction(
                          selectedBlockingSchedule,
                          'COMPLETED',
                          selectedBlockingSchedule.notes ?? 'Released from the maintenance dashboard.',
                        )
                      }
                      type="button"
                    >
                      {actionScheduleId === selectedBlockingSchedule.id ? 'Releasing...' : 'Release vehicle'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="maintenance-spotlight__stats">
                <article className="maintenance-stat-card">
                  <span>Driver</span>
                  <strong>{selectedVehicle.driverId || 'Unassigned'}</strong>
                </article>
                <article className="maintenance-stat-card">
                  <span>Fuel reserve</span>
                  <strong>{selectedVehicle.fuelLevel}%</strong>
                </article>
                <article className="maintenance-stat-card">
                  <span>Alerts</span>
                  <strong>{selectedVehicleAlerts.length}</strong>
                </article>
                <article className="maintenance-stat-card">
                  <span>Open schedules</span>
                  <strong>{selectedVehicleSchedules.filter((schedule) => schedule.status !== 'COMPLETED' && schedule.status !== 'CANCELLED').length}</strong>
                </article>
              </div>

              <div className="maintenance-spotlight__grid">
                <article className="maintenance-detail-card">
                  <div className="maintenance-detail-card__header">
                    <h4>Block status</h4>
                    <span className="badge">
                      {selectedBlockingSchedule
                        ? selectedBlockingSchedule.status === 'IN_PROGRESS'
                          ? 'Active block'
                          : 'Planned block'
                        : 'No active block'}
                    </span>
                  </div>
                  <p>
                    {selectedBlockingSchedule
                      ? `${selectedVehicle.id} is tied to ${selectedBlockingSchedule.id} for ${selectedBlockingSchedule.title}.`
                      : `${selectedVehicle.id} is currently clear for dispatch planning.`}
                  </p>
                  <div className="maintenance-detail-card__chips">
                    <span className="badge">Mileage {selectedVehicle.mileage.toLocaleString()} km</span>
                    <span className="badge">Fuel {selectedVehicle.fuelLevel}%</span>
                    <span className="badge">{selectedVehicle.location}</span>
                  </div>
                </article>

                <article className="maintenance-detail-card">
                  <div className="maintenance-detail-card__header">
                    <h4>Selected vehicle queue</h4>
                    <span className="badge">{selectedVehicleSchedules.length} schedules</span>
                  </div>
                  <div className="maintenance-mini-list">
                    {selectedVehicleSchedules.slice(0, 3).map((schedule) => (
                      <div key={schedule.id} className="maintenance-mini-list__item">
                        <div>
                          <strong>{schedule.title}</strong>
                          <p>{formatDisplayDate(schedule.plannedStartDate)} to {formatDisplayDate(schedule.plannedEndDate)}</p>
                        </div>
                        <span className={scheduleStatusClass(schedule.status)}>{schedule.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                    {selectedVehicleSchedules.length === 0 ? (
                      <p className="muted">No maintenance work orders are attached to this vehicle yet.</p>
                    ) : null}
                  </div>
                </article>

                <article className="maintenance-detail-card">
                  <div className="maintenance-detail-card__header">
                    <h4>Alert context</h4>
                    <span className="badge">{selectedVehicleAlerts.length} alerts</span>
                  </div>
                  <div className="maintenance-mini-list">
                    {selectedVehicleAlerts.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="maintenance-mini-list__item">
                        <div>
                          <strong>{alert.title}</strong>
                          <p>Due {formatDisplayDate(alert.dueDate)}</p>
                        </div>
                        <span className={alertSeverityClass(alert.severity)}>{alert.severity}</span>
                      </div>
                    ))}
                    {selectedVehicleAlerts.length === 0 ? (
                      <p className="muted">No open maintenance alerts for the selected vehicle.</p>
                    ) : null}
                  </div>
                </article>
              </div>
            </section>
          ) : (
            <section className="panel--flat">
              <p className="muted">Select a vehicle to view maintenance details.</p>
            </section>
          )}

          <div className="maintenance-dashboard__lower">
            <form className="panel--flat maintenance-form-panel" onSubmit={handleScheduleSubmit}>
              <div className="panel__header">
                <div>
                  <span className="page-header__eyebrow">Schedule Maintenance</span>
                  <h3>Create or plan service work</h3>
                </div>
              </div>
              <div className="maintenance-form-grid">
                <label className="input-group">
                  <span>Vehicle</span>
                  <select
                    onChange={(event) => {
                      setForm({ ...form, vehicleId: event.target.value })
                      setSelectedVehicleId(event.target.value)
                    }}
                    value={form.vehicleId}
                  >
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.id} - {vehicle.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-group">
                  <span>Work order title</span>
                  <input
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="Brake inspection, oil service, refrigeration check..."
                    required
                    type="text"
                    value={form.title}
                  />
                </label>
                <label className="input-group">
                  <span>Lifecycle</span>
                  <select
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as Extract<MaintenanceScheduleStatus, 'PLANNED' | 'IN_PROGRESS'>,
                      })
                    }
                    value={form.status}
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">Start immediately</option>
                  </select>
                </label>
                <label className="input-group">
                  <span>Reason code</span>
                  <input
                    onChange={(event) => setForm({ ...form, reasonCode: event.target.value })}
                    placeholder="ROUTINE_SERVICE, ALERT_RESPONSE, BRAKES..."
                    type="text"
                    value={form.reasonCode ?? ''}
                  />
                </label>
                <label className="input-group">
                  <span>Planned start</span>
                  <input
                    onChange={(event) => setForm({ ...form, plannedStartDate: event.target.value })}
                    required
                    type="date"
                    value={form.plannedStartDate}
                  />
                </label>
                <label className="input-group">
                  <span>Planned end</span>
                  <input
                    onChange={(event) => setForm({ ...form, plannedEndDate: event.target.value })}
                    required
                    type="date"
                    value={form.plannedEndDate}
                  />
                </label>
                <label className="input-group input-group--full">
                  <span>Workshop notes</span>
                  <textarea
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Capture the root cause, parts needed, or any workshop instructions."
                    rows={4}
                    value={form.notes ?? ''}
                  />
                </label>
              </div>
              <label className="maintenance-form-panel__toggle">
                <input
                  checked={form.blockDispatch}
                  onChange={(event) => setForm({ ...form, blockDispatch: event.target.checked })}
                  type="checkbox"
                />
                <span>Block dispatch while this maintenance order is active.</span>
              </label>
              <p className="muted maintenance-form-panel__hint">
                In-progress maintenance always blocks dispatch even if the toggle is off.
              </p>
              <div className="form-actions">
                <button className="primary-button" disabled={!canManage || submitting} type="submit">
                  {submitting ? 'Saving work order...' : 'Save maintenance schedule'}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => resetForm(form.vehicleId)}
                  type="button"
                >
                  Reset form
                </button>
              </div>
            </form>

            <div className="maintenance-dashboard__stack">
              <section className="panel--flat maintenance-schedule-panel">
                <div className="panel__header">
                  <div>
                    <span className="page-header__eyebrow">Live Work Orders</span>
                    <h3>Workshop queue</h3>
                  </div>
                  <span className="badge">{sortedSchedules.length} schedules</span>
                </div>
                <div className="maintenance-list">
                  {sortedSchedules.map((schedule) => {
                    const vehicle = vehicles.find((item) => item.id === schedule.vehicleId)
                    const isWorking = actionScheduleId === schedule.id

                    return (
                      <article key={schedule.id} className="maintenance-list__item">
                        <div className="maintenance-list__top">
                          <div>
                            <span className="page-header__eyebrow">{schedule.id}</span>
                            <strong>{schedule.title}</strong>
                            <p>
                              {schedule.vehicleId}
                              {vehicle ? ` - ${vehicle.name}` : ''}
                            </p>
                          </div>
                          <span className={scheduleStatusClass(schedule.status)}>{schedule.status.replace('_', ' ')}</span>
                        </div>
                        <div className="maintenance-list__meta">
                          <span>{formatDisplayDate(schedule.plannedStartDate)} to {formatDisplayDate(schedule.plannedEndDate)}</span>
                          <span>{schedule.reasonCode || 'No reason code'}</span>
                          <span>{schedule.blockDispatch ? 'Dispatch blocked' : 'Dispatch open'}</span>
                        </div>
                        {schedule.notes ? <p className="maintenance-list__notes">{schedule.notes}</p> : null}
                        {canManage ? (
                          <div className="form-actions">
                            {schedule.status === 'PLANNED' ? (
                              <button
                                className="primary-button"
                                disabled={isWorking}
                                onClick={() =>
                                  handleScheduleAction(
                                    schedule,
                                    'IN_PROGRESS',
                                    schedule.notes ?? 'Started from the maintenance dashboard.',
                                  )
                                }
                                type="button"
                              >
                                {isWorking ? 'Starting...' : 'Start maintenance'}
                              </button>
                            ) : null}
                            {schedule.status === 'IN_PROGRESS' ? (
                              <button
                                className="primary-button"
                                disabled={isWorking}
                                onClick={() =>
                                  handleScheduleAction(
                                    schedule,
                                    'COMPLETED',
                                    schedule.notes ?? 'Completed from the maintenance dashboard.',
                                  )
                                }
                                type="button"
                              >
                                {isWorking ? 'Updating...' : 'Complete'}
                              </button>
                            ) : null}
                            {(schedule.status === 'PLANNED' || schedule.status === 'IN_PROGRESS') ? (
                              <button
                                className="secondary-button"
                                disabled={isWorking}
                                onClick={() =>
                                  handleScheduleAction(
                                    schedule,
                                    'CANCELLED',
                                    schedule.notes ?? 'Cancelled from the maintenance dashboard.',
                                  )
                                }
                                type="button"
                              >
                                {isWorking ? 'Updating...' : 'Cancel'}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                  {sortedSchedules.length === 0 ? (
                    <p className="muted">No maintenance schedules are currently in the queue.</p>
                  ) : null}
                </div>
              </section>

              <section className="panel--flat maintenance-alert-panel">
                <div className="panel__header">
                  <div>
                    <span className="page-header__eyebrow">Maintenance Alerts</span>
                    <h3>Service attention queue</h3>
                  </div>
                  <span className="badge">{alerts.length} alerts</span>
                </div>
                <div className="maintenance-alert-panel__list">
                  {alerts.map((alert) => {
                    const vehicle = vehicles.find((item) => item.id === alert.vehicleId)

                    return (
                      <article key={alert.id} className="maintenance-alert-panel__item">
                        <div className="maintenance-list__top">
                          <div>
                            <span className="page-header__eyebrow">{alert.id}</span>
                            <strong>{alert.title}</strong>
                            <p>
                              {alert.vehicleId}
                              {vehicle ? ` - ${vehicle.name}` : ''}
                            </p>
                          </div>
                          <span className={alertSeverityClass(alert.severity)}>{alert.severity}</span>
                        </div>
                        <p className="maintenance-list__notes">{alert.description}</p>
                        <div className="maintenance-list__meta">
                          <span>Due {formatDisplayDate(alert.dueDate)}</span>
                          <span>{vehicle?.location ?? 'Location pending'}</span>
                        </div>
                      </article>
                    )
                  })}
                  {alerts.length === 0 ? (
                    <p className="muted">No maintenance alerts are waiting in the queue.</p>
                  ) : null}
                </div>
              </section>

              <section className="panel--flat maintenance-block-panel">
                <div className="panel__header">
                  <div>
                    <span className="page-header__eyebrow">Blocked Fleet</span>
                    <h3>Dispatch hold roster</h3>
                  </div>
                  <span className="badge">{blockedVehicles.length} vehicles</span>
                </div>
                <div className="maintenance-block-panel__grid">
                  {blockedVehicles.map((vehicle) => {
                    const block = blockedSchedules.find((schedule) => schedule.vehicleId === vehicle.id)

                    return (
                      <article key={vehicle.id} className="maintenance-block-panel__card">
                        <div className="maintenance-list__top">
                          <div>
                            <span className="page-header__eyebrow">{vehicle.id}</span>
                            <strong>{vehicle.name}</strong>
                          </div>
                          <span className="status-pill status-pill--rose">
                            {block?.status === 'IN_PROGRESS' ? 'In bay' : 'Planned block'}
                          </span>
                        </div>
                        <p>{block?.title ?? 'Maintenance block active'}</p>
                        <div className="maintenance-list__meta">
                          <span>{vehicle.location}</span>
                          <span>{block ? formatDisplayDate(block.plannedStartDate) : 'Date pending'}</span>
                        </div>
                      </article>
                    )
                  })}
                  {blockedVehicles.length === 0 ? (
                    <p className="muted">No vehicles are currently blocked from dispatch.</p>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
