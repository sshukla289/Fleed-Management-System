import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { VehicleCard } from '../components/VehicleCard'
import { fetchDrivers, fetchMaintenanceAlerts, fetchRoutePlans, fetchVehicles } from '../services/apiService'
import { fetchVehicleTelemetry, submitVehicleTelemetry } from '../services/telemetryService'
import type { Driver, MaintenanceAlert, RoutePlan, TelemetryData, Vehicle } from '../types'

interface TelemetryFormState {
  latitude: string
  longitude: string
  speed: string
  fuelLevel: string
  timestamp: string
}

type Tone = 'blue' | 'mint' | 'amber' | 'violet' | 'rose' | 'teal'

const initialTelemetryForm: TelemetryFormState = {
  latitude: '12.9716',
  longitude: '77.5946',
  speed: '84',
  fuelLevel: '18',
  timestamp: '',
}

const fallbackTelemetrySeries = [
  { label: 'Nov 2025', value: 42 },
  { label: 'Dec 2025', value: 46 },
  { label: 'Jan 2026', value: 49 },
  { label: 'Feb 2026', value: 54 },
  { label: 'Mar 2026', value: 63 },
  { label: 'Apr 2026', value: 72 },
]

function formatTelemetryNumericInput(value: string, options?: { maxValue?: number }) {
  if (!value) return ''
  if (!/^\d*\.?\d*$/.test(value)) return value

  const limitedValue = value.includes('.') ? `${value.split('.', 2)[0]}.${value.split('.', 2)[1].slice(0, 2)}` : value
  if (limitedValue === '.') return '0.'

  const normalizedValue = limitedValue.startsWith('.') ? `0${limitedValue}` : limitedValue
  const parsedValue = Number(normalizedValue)

  if (Number.isNaN(parsedValue)) return normalizedValue
  if (typeof options?.maxValue === 'number' && parsedValue > options.maxValue) return String(options.maxValue)

  if (parsedValue >= 10) {
    return normalizedValue.includes('.') ? `${String(Number(normalizedValue.split('.', 2)[0]))}.${normalizedValue.split('.', 2)[1]}` : String(parsedValue)
  }

  if (normalizedValue.includes('.')) {
    const [integerPart, fractionalPart] = normalizedValue.split('.', 2)
    const paddedIntegerPart = integerPart && integerPart !== '0' ? integerPart.padStart(2, '0') : integerPart
    return `${paddedIntegerPart}.${fractionalPart}`
  }

  if (/^\d$/.test(normalizedValue) && normalizedValue !== '0') return normalizedValue.padStart(2, '0')
  if (/^0\d+$/.test(normalizedValue)) return String(parsedValue).padStart(2, '0')
  return normalizedValue
}

function toneClassName(tone: Tone) {
  return `tone-${tone}`
}

function driverStatusClass(status: Driver['status']) {
  if (status === 'On Duty') {
    return 'dashboard-chip dashboard-chip--success'
  }

  if (status === 'Resting') {
    return 'dashboard-chip dashboard-chip--warn'
  }

  return 'dashboard-chip'
}

function routeStatusClass(status: RoutePlan['status']) {
  if (status === 'In Progress') {
    return 'dashboard-chip dashboard-chip--success'
  }

  if (status === 'Scheduled') {
    return 'dashboard-chip dashboard-chip--warn'
  }

  return 'dashboard-chip'
}

function SectionHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string
  title: string
  meta?: string
}) {
  return (
    <div className="dashboard-card-header">
      <div>
        <span className="dashboard-card-header__eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
      </div>
      {meta ? <span className="dashboard-chip">{meta}</span> : null}
    </div>
  )
}

function LineChartCard({
  title,
  subtitle,
  series,
  accent,
  chip,
}: {
  title: string
  subtitle: string
  series: Array<{ label: string; value: number }>
  accent: string
  chip: string
}) {
  const width = 680
  const height = 260
  const paddingX = 26
  const paddingY = 24
  const maxValue = Math.max(...series.map((point) => point.value), 1)
  const minValue = Math.min(...series.map((point) => point.value), 0)
  const span = Math.max(maxValue - minValue, 1)
  const denominator = Math.max(series.length - 1, 1)

  const points = series.map((point, index) => {
    const x = paddingX + (index / denominator) * (width - paddingX * 2)
    const y = height - paddingY - ((point.value - minValue) / span) * (height - paddingY * 2)
    return { x, y, label: point.label }
  })

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPoints = `${polylinePoints} ${points.at(-1)?.x ?? width - paddingX},${height - paddingY} ${points[0]?.x ?? paddingX},${height - paddingY}`
  const gradientId = `chart-${title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <article className="dashboard-chart-card">
      <SectionHeader eyebrow="Analytics" title={title} meta={chip} />
      <p className="muted dashboard-chart-card__subtitle">{subtitle}</p>
      <svg aria-label={title} className="dashboard-chart-card__svg" viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="20" fill="#f8fbff" />
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} className="dashboard-chart-card__axis" />
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} className="dashboard-chart-card__axis" />
        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
        <polyline points={polylinePoints} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={`${title}-${point.label}`}>
            <circle cx={point.x} cy={point.y} r="4" fill={accent} />
            <circle cx={point.x} cy={point.y} r="7" fill={accent} fillOpacity="0.14" />
          </g>
        ))}
        {points.map((point) => (
          <text key={`${title}-${point.label}-label`} x={point.x} y={height - 8} textAnchor="middle" className="dashboard-chart-card__label">
            {point.label}
          </text>
        ))}
      </svg>
      <div className="dashboard-chart-card__legend">
        <span className="dashboard-chip">{series.at(0)?.label ?? 'Start'}</span>
        <span className="dashboard-chip">{series.at(-1)?.label ?? 'Latest'}</span>
      </div>
    </article>
  )
}

function QueueItem({
  title,
  note,
  status,
  tone,
}: {
  title: string
  note: string
  status: string
  tone: Tone
}) {
  return (
    <div className="dashboard-queue-item">
      <div>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
      <span className={`dashboard-queue-item__status ${toneClassName(tone)}`}>{status}</span>
    </div>
  )
}

function HealthItem({
  title,
  count,
  note,
  action,
}: {
  title: string
  count: string
  note: string
  action: string
}) {
  return (
    <div className="dashboard-health-item">
      <div>
        <strong>{title}</strong>
        <p>{note}</p>
      </div>
      <div className="dashboard-health-item__meta">
        <span className="dashboard-health-item__count">{count}</span>
        <Link className="dashboard-health-item__link" to={action}>
          View list
        </Link>
      </div>
    </div>
  )
}

function DataGrid({
  columns,
  rows,
  variant,
  emptyMessage,
}: {
  columns: string[]
  rows: Array<{ key: string; cells: ReactNode[] }>
  variant: 'drivers' | 'maintenance' | 'routes'
  emptyMessage: string
}) {
  return (
    <div className={`dashboard-data-grid dashboard-data-grid--${variant}`}>
      <div className="dashboard-data-grid__header">
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {rows.length ? (
        rows.map((row) => (
          <div key={row.key} className="dashboard-data-grid__row">
            {row.cells.map((cell, index) => (
              <div key={`${row.key}-${index}`} className="dashboard-data-grid__cell">
                {cell}
              </div>
            ))}
          </div>
        ))
      ) : (
        <div className="dashboard-data-grid__empty">{emptyMessage}</div>
      )}
    </div>
  )
}

function SubDashboardPanel({
  eyebrow,
  title,
  meta,
  link,
  summary,
  columns,
  rows,
  variant,
  emptyMessage,
}: {
  eyebrow: string
  title: string
  meta: string
  link: string
  summary: Array<{ label: string; value: string }>
  columns: string[]
  rows: Array<{ key: string; cells: ReactNode[] }>
  variant: 'drivers' | 'maintenance' | 'routes'
  emptyMessage: string
}) {
  return (
    <article className="dashboard-panel dashboard-subdashboard-panel">
      <div className="dashboard-card-header">
        <div>
          <span className="dashboard-card-header__eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        <Link className="dashboard-card-header__link" to={link}>
          {meta}
        </Link>
      </div>
      <div className="dashboard-subdashboard-summary">
        {summary.map((item) => (
          <span key={item.label} className="dashboard-chip">
            {item.label}: {item.value}
          </span>
        ))}
      </div>
      <DataGrid columns={columns} emptyMessage={emptyMessage} rows={rows} variant={variant} />
    </article>
  )
}

export function Dashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([])
  const [routes, setRoutes] = useState<RoutePlan[]>([])
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [telemetryForm, setTelemetryForm] = useState<TelemetryFormState>(initialTelemetryForm)
  const [isSubmittingTelemetry, setIsSubmittingTelemetry] = useState(false)
  const [telemetryMessage, setTelemetryMessage] = useState('')
  const [telemetryError, setTelemetryError] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      const [vehicleData, driverData, alertData, routeData] = await Promise.all([
        fetchVehicles(),
        fetchDrivers(),
        fetchMaintenanceAlerts(),
        fetchRoutePlans(),
      ])

      setVehicles(vehicleData)
      setDrivers(driverData)
      setAlerts(alertData)
      setRoutes(routeData)

      if (vehicleData[0]) {
        setSelectedVehicleId(vehicleData[0].id)
        setTelemetry(await fetchVehicleTelemetry(vehicleData[0].id))
      }
    }

    void loadDashboard()
  }, [])

  useEffect(() => {
    if (!selectedVehicleId) return
    void fetchVehicleTelemetry(selectedVehicleId).then(setTelemetry)
  }, [selectedVehicleId])

  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'Active').length
  const idleVehicles = vehicles.filter((vehicle) => vehicle.status === 'Idle').length
  const serviceVehicles = vehicles.filter((vehicle) => vehicle.status === 'Maintenance').length
  const driversOnDuty = drivers.filter((driver) => driver.status === 'On Duty').length
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'Critical').length
  const overdueAlerts = alerts.filter((alert) => new Date(alert.dueDate) < new Date()).length
  const scheduledRoutes = routes.filter((route) => route.status === 'Scheduled').length
  const inProgressRoutes = routes.filter((route) => route.status === 'In Progress').length
  const completedRoutes = routes.filter((route) => route.status === 'Completed').length
  const lowFuelVehicles = vehicles.filter((vehicle) => vehicle.fuelLevel < 40).length
  const averageFuelLevel = vehicles.length ? Math.round(vehicles.reduce((sum, vehicle) => sum + vehicle.fuelLevel, 0) / vehicles.length) : 0
  const utilization = vehicles.length ? Math.round((activeVehicles / vehicles.length) * 100) : 0
  const fleetIssues = criticalAlerts + overdueAlerts + lowFuelVehicles
  const lastTelemetryLabel = telemetry.at(-1)?.timestamp ?? 'N/A'
  const vehicleLookup = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles],
  )

  const orderedDrivers = useMemo(
    () =>
      [...drivers].sort((left, right) => {
        const statusRank = (status: Driver['status']) => {
          if (status === 'On Duty') return 0
          if (status === 'Resting') return 1
          return 2
        }

        return statusRank(left.status) - statusRank(right.status) || left.name.localeCompare(right.name)
      }),
    [drivers],
  )

  const orderedRoutes = useMemo(
    () =>
      [...routes].sort((left, right) => {
        const routeStatusRank = (status: RoutePlan['status']) => {
          if (status === 'In Progress') return 0
          if (status === 'Scheduled') return 1
          return 2
        }

        return routeStatusRank(left.status) - routeStatusRank(right.status) || left.distanceKm - right.distanceKm
      }),
    [routes],
  )

  const driverRows = useMemo(
    () =>
      orderedDrivers.slice(0, 4).map((driver) => {
        const vehicle = vehicleLookup.get(driver.assignedVehicleId ?? '')

        return {
          key: driver.id,
          cells: [
            <div key={`${driver.id}-name`}>
              <strong>{driver.name}</strong>
              <p className="muted">{driver.id}</p>
            </div>,
            <span key={`${driver.id}-status`} className={driverStatusClass(driver.status)}>
              {driver.status}
            </span>,
            <div key={`${driver.id}-vehicle`}>
              <strong>{vehicle?.name ?? 'Unassigned'}</strong>
              <p className="muted">{vehicle?.id ?? 'No vehicle linked'}</p>
            </div>,
            <span key={`${driver.id}-hours`}>{driver.hoursDrivenToday.toFixed(1)} h</span>,
            <span key={`${driver.id}-license`} className="dashboard-chip">
              {driver.licenseType}
            </span>,
          ],
        }
      }),
    [orderedDrivers, vehicleLookup],
  )

  const routeRows = useMemo(
    () =>
      orderedRoutes.slice(0, 4).map((route) => ({
        key: route.id,
        cells: [
          <div key={`${route.id}-name`}>
            <strong>{route.name}</strong>
            <p className="muted">{route.id}</p>
          </div>,
          <span key={`${route.id}-status`} className={routeStatusClass(route.status)}>
            {route.status}
          </span>,
          <span key={`${route.id}-distance`}>{route.distanceKm.toLocaleString('en-IN')} km</span>,
          <span key={`${route.id}-duration`}>{route.estimatedDuration}</span>,
          <span key={`${route.id}-stops`} className="dashboard-chip">
            {route.stops.length} stops
          </span>,
        ],
      })),
    [orderedRoutes],
  )

  const speedSeries = useMemo(
    () => (telemetry.length ? telemetry.map((point) => ({ label: point.timestamp, value: point.speed })) : fallbackTelemetrySeries),
    [telemetry],
  )

  const fuelSeries = useMemo(
    () =>
      telemetry.length
        ? telemetry.map((point) => ({ label: point.timestamp, value: point.fuelUsage }))
        : fallbackTelemetrySeries.map((point) => ({ label: point.label, value: Math.max(8, 28 - (point.value - 40) / 2) })),
    [telemetry],
  )

  async function handleTelemetrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedVehicleId) {
      setTelemetryError('Select a vehicle before sending telemetry.')
      setTelemetryMessage('')
      return
    }

    const parsedLatitude = Number(telemetryForm.latitude)
    const parsedLongitude = Number(telemetryForm.longitude)
    const parsedSpeed = Number(telemetryForm.speed)
    const parsedFuelLevel = Number(telemetryForm.fuelLevel)

    if (!telemetryForm.latitude.trim() || Number.isNaN(parsedLatitude)) return setTelemetryError('Latitude must be a valid number.')
    if (!telemetryForm.longitude.trim() || Number.isNaN(parsedLongitude)) return setTelemetryError('Longitude must be a valid number.')
    if (!telemetryForm.speed.trim() || Number.isNaN(parsedSpeed) || parsedSpeed < 0) return setTelemetryError('Speed must be a valid non-negative number.')
    if (!telemetryForm.fuelLevel.trim() || Number.isNaN(parsedFuelLevel) || parsedFuelLevel < 0 || parsedFuelLevel > 100) return setTelemetryError('Fuel level must be a valid percentage between 0 and 100.')

    setIsSubmittingTelemetry(true)
    setTelemetryError('')
    setTelemetryMessage('')

    try {
      await submitVehicleTelemetry({
        vehicleId: selectedVehicleId,
        ...telemetryForm,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        speed: parsedSpeed,
        fuelLevel: parsedFuelLevel,
        timestamp: telemetryForm.timestamp || undefined,
      })

      const [updatedTelemetry, updatedAlerts] = await Promise.all([
        fetchVehicleTelemetry(selectedVehicleId),
        fetchMaintenanceAlerts(),
      ])
      setTelemetry(updatedTelemetry)
      setAlerts(updatedAlerts)
      setTelemetryMessage('Telemetry event saved and fleet alerts refreshed.')
    } catch (error) {
      setTelemetryError(error instanceof Error ? error.message : 'Unable to save telemetry event.')
    } finally {
      setIsSubmittingTelemetry(false)
    }
  }

  const funnelItems: Array<{ title: string; note: string; status: string; tone: Tone }> = [
    {
      title: 'Maintenance',
      note: `${criticalAlerts} critical items waiting on sign-off`,
      status: criticalAlerts ? 'Open' : 'Clear',
      tone: criticalAlerts ? 'rose' : 'mint',
    },
    {
      title: 'Routes',
      note: `${scheduledRoutes} routes queued for dispatch`,
      status: scheduledRoutes ? 'Open' : 'Clear',
      tone: scheduledRoutes ? 'amber' : 'mint',
    },
    {
      title: 'Drivers',
      note: `${drivers.filter((driver) => driver.status !== 'On Duty').length} handoffs in progress`,
      status: 'Open',
      tone: 'blue',
    },
    {
      title: 'Telemetry',
      note: `${telemetry.length} recent readings available`,
      status: telemetry.length ? 'Live' : 'Waiting',
      tone: telemetry.length ? 'mint' : 'amber',
    },
  ]

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero card">
        <div>
          <span className="dashboard-card-header__eyebrow">Dashboard snapshot</span>
          <h1 className="dashboard-hero__title">Fleet dashboard</h1>
          <p className="dashboard-hero__description">Overview of your fleet&apos;s dispatch, maintenance, and telemetry system.</p>
        </div>
        <div className="dashboard-hero__aside">
          <div className="dashboard-hero__pill">
            <span className="dashboard-hero__pill-label">Organization</span>
            <strong>Demo Fleet</strong>
          </div>
          <div className="dashboard-hero__pill dashboard-hero__pill--muted">
            <span className="dashboard-hero__pill-label">Live status</span>
            <strong>{telemetry.length ? 'Connected' : 'Loading'}</strong>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Fleet overview</span>
            <h2 className="dashboard-section__title">Owner quick summary</h2>
          </div>
          <span className="dashboard-section__counter">5 cards</span>
        </div>
        <div className="dashboard-summary-grid">
          {[
            { label: 'Active vehicles', value: String(activeVehicles), note: `${idleVehicles} at rest · ${serviceVehicles} in maintenance`, tone: 'blue' },
            { label: 'Dispatch cycle', value: inProgressRoutes ? 'IN PROGRESS' : 'SCHEDULED', note: `${routes.length} routes planned · ${completedRoutes} completed`, tone: 'mint' },
            { label: 'Pending approvals', value: String(criticalAlerts + scheduledRoutes), note: `${criticalAlerts} critical · ${overdueAlerts} overdue`, tone: 'amber' },
            { label: 'Driver duty', value: `${utilization}%`, note: `${driversOnDuty} on duty · ${drivers.length - driversOnDuty} off shift`, tone: 'violet' },
            { label: 'Carry forward', value: String(Math.max(overdueAlerts + serviceVehicles, 0)), note: 'Backlog into the next dispatch window', tone: 'rose' },
          ].map((card) => (
            <article key={card.label} className={`dashboard-summary-card ${toneClassName(card.tone as Tone)}`}>
              <span className="dashboard-summary-card__label">{card.label}</span>
              <strong className="dashboard-summary-card__value">{card.value}</strong>
              <p className="dashboard-summary-card__note">{card.note}</p>
              <span className="dashboard-summary-card__spark" />
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Action center</span>
            <h2 className="dashboard-section__title">Pending actions</h2>
          </div>
          <span className="dashboard-section__counter">{criticalAlerts + scheduledRoutes + fleetIssues} pending</span>
        </div>
        <div className="dashboard-action-grid">
          {[
            { label: 'Approvals', title: 'Maintenance approvals', count: String(criticalAlerts), note: criticalAlerts ? 'Critical maintenance items need review' : 'No pending items', link: '/maintenance', tone: 'blue' },
            { label: 'Approvals', title: 'Route reassignments', count: String(scheduledRoutes), note: scheduledRoutes ? 'Planned routes waiting for dispatch' : 'No pending items', link: '/routes', tone: 'mint' },
            { label: 'Approvals', title: 'Driver handoffs', count: String(drivers.filter((driver) => driver.status === 'Resting').length), note: 'Pending shift changes and relief coverage', link: '/drivers', tone: 'amber' },
            { label: 'Approvals', title: 'Telemetry watch', count: String(telemetry.length), note: telemetry.length ? 'Recent readings from the selected vehicle' : 'No live stream yet', link: '/vehicles', tone: 'violet' },
            { label: 'Monitoring', title: 'Fuel exceptions', count: String(lowFuelVehicles), note: lowFuelVehicles ? 'Fleet units under the preferred fuel threshold' : 'No pending items', link: '/vehicles', tone: 'rose' },
            { label: 'Monitoring', title: 'Service bay queue', count: String(serviceVehicles), note: serviceVehicles ? 'Vehicles currently in maintenance' : 'No pending items', link: '/maintenance', tone: 'teal' },
            { label: 'Approvals', title: 'Completed routes', count: String(completedRoutes), note: 'Archived route runs ready for review', link: '/routes', tone: 'blue' },
            { label: 'Monitoring', title: 'Compliance flags', count: String(fleetIssues), note: fleetIssues ? 'Open items that need owner attention' : 'No pending items', link: '/profile', tone: 'amber' },
          ].map((card) => (
            <article key={card.title} className={`dashboard-action-card ${toneClassName(card.tone as Tone)}`}>
              <span className="dashboard-action-card__eyebrow">{card.label}</span>
              <strong className="dashboard-action-card__title">{card.title}</strong>
              <div className="dashboard-action-card__count">{card.count}</div>
              <p className="dashboard-action-card__note">{card.note}</p>
              <div className="dashboard-action-card__footer">
                <span className="dashboard-action-card__placeholder">No pending items</span>
                <Link className="dashboard-action-card__link" to={card.link}>View all</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Sub dashboards</span>
            <h2 className="dashboard-section__title">Drivers and routes</h2>
          </div>
          <span className="dashboard-section__counter">{drivers.length + routes.length} records</span>
        </div>
        <div className="dashboard-subdashboard-grid">
          <SubDashboardPanel
            columns={['Driver', 'Status', 'Vehicle', 'Hours', 'License']}
            emptyMessage="No driver records available."
            eyebrow="Crew board"
            link="/drivers"
            meta="View drivers"
            rows={driverRows}
            summary={[
              { label: 'Total', value: String(drivers.length) },
              { label: 'On duty', value: String(driversOnDuty) },
              { label: 'Resting', value: String(drivers.filter((driver) => driver.status === 'Resting').length) },
            ]}
            variant="drivers"
            title="Drivers"
          />
          <SubDashboardPanel
            columns={['Route', 'Status', 'Distance', 'Duration', 'Stops']}
            emptyMessage="No route plans available."
            eyebrow="Dispatch board"
            link="/routes"
            meta="View routes"
            rows={routeRows}
            summary={[
              { label: 'Total', value: String(routes.length) },
              { label: 'Live', value: String(inProgressRoutes) },
              { label: 'Scheduled', value: String(scheduledRoutes) },
            ]}
            variant="routes"
            title="Routes"
          />
        </div>
      </section>

      <section className="dashboard-content-grid">
        <div className="dashboard-stack">
          <LineChartCard title="Speed profile" subtitle="Dispatch trend built from the latest vehicle data stream." series={speedSeries} accent="#2f6bff" chip="Fleet telemetry" />
          <LineChartCard title="Fuel usage trend" subtitle="Fuel consumption across the currently selected vehicle." series={fuelSeries} accent="#14b8a6" chip="Live efficiency" />
          <article className="dashboard-panel">
            <SectionHeader eyebrow="Vehicle spotlight" title="Assets in focus" meta={`${vehicles.length} vehicles`} />
            <p className="muted">Sample cards showing how fleet units can be rendered on overview pages.</p>
            <div className="list-grid">
              {vehicles.slice(0, 3).map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
            </div>
          </article>
        </div>

        <aside className="dashboard-rail">
          <article className="dashboard-panel">
            <SectionHeader eyebrow="Approvals" title="Approval funnel" meta="5 queues" />
            <div className="dashboard-funnel-tags">
              <span className="dashboard-chip">Pending: {criticalAlerts}</span>
              <span className="dashboard-chip">&gt;3d: {overdueAlerts}</span>
              <span className="dashboard-chip">&gt;7d: {Math.max(overdueAlerts - 1, 0)}</span>
            </div>
            <div className="dashboard-queue-list">
              {funnelItems.map((item) => <QueueItem key={item.title} {...item} />)}
            </div>
          </article>

          <article className="dashboard-panel">
            <SectionHeader eyebrow="Live snapshot" title="Supporting overview" meta="Owner view" />
            <div className="dashboard-live-grid">
              {[
                { label: 'Active vehicles', value: String(activeVehicles), note: 'Current fleet strength' },
                { label: 'Avg fuel', value: `${averageFuelLevel}%`, note: 'Fleet-wide fuel level' },
                { label: 'Last sync', value: lastTelemetryLabel, note: 'Latest telemetry reading' },
                { label: 'Fleet issues', value: String(fleetIssues), note: 'Open items across the fleet' },
              ].map((item) => (
                <div key={item.label} className="dashboard-live-tile">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-panel">
            <SectionHeader eyebrow="Ops watchlist" title="Immediate operational checks" meta="Live" />
            <div className="dashboard-queue-list dashboard-queue-list--compact">
              <QueueItem title="Low fuel units" note={`${lowFuelVehicles} vehicles below the preferred threshold`} status={lowFuelVehicles ? 'Alert' : 'Clear'} tone={lowFuelVehicles ? 'amber' : 'mint'} />
              <QueueItem title="Overdue maintenance" note={`${overdueAlerts} items reached their due date`} status={overdueAlerts ? 'Open' : 'Clear'} tone={overdueAlerts ? 'rose' : 'mint'} />
              <QueueItem title="Telemetry coverage" note={`${telemetry.length} readings available for the selected vehicle`} status={telemetry.length ? 'Healthy' : 'Waiting'} tone={telemetry.length ? 'blue' : 'amber'} />
              <QueueItem title="Routes in progress" note={`${inProgressRoutes} active route plans on the board`} status={inProgressRoutes ? 'Open' : 'Clear'} tone={inProgressRoutes ? 'violet' : 'mint'} />
            </div>
          </article>
        </aside>
      </section>

      <section className="dashboard-lower-grid">
        <article className="dashboard-panel">
          <SectionHeader eyebrow="Fleet health" title="Onboarding and data completeness" meta={`${fleetIssues} issues`} />
          <div className="dashboard-health-list">
            {[
              { title: 'Vehicles missing driver sync', count: String(vehicles.filter((vehicle) => !vehicle.driverId).length), note: 'Fleet units with incomplete assignment data', action: '/vehicles' },
              { title: 'Drivers missing route match', count: String(drivers.filter((driver) => !driver.assignedVehicleId).length), note: 'Drivers awaiting a vehicle handoff', action: '/drivers' },
              { title: 'Routes needing review', count: String(scheduledRoutes + inProgressRoutes), note: 'Planned and active routes to check', action: '/routes' },
              { title: 'Alerts needing closure', count: String(overdueAlerts + criticalAlerts), note: 'Service items that need owner attention', action: '/maintenance' },
            ].map((item) => <HealthItem key={item.title} {...item} />)}
          </div>
        </article>

        <article className="dashboard-panel">
          <SectionHeader eyebrow="Notifications" title="Recent notifications" meta="2 unread" />
          <div className="dashboard-notification-list">
            {[
              { title: 'Created login', note: 'by Fleet Owner', time: '30 seconds ago' },
              { title: 'Maintenance alert', note: 'Brake wear threshold crossed', time: '4 hours ago' },
              { title: 'Route approved', note: 'Western corridor dispatch updated', time: '1 day ago' },
              { title: 'Telemetry received', note: 'Latest vehicle stream synced', time: '1 day ago' },
            ].map((item) => (
              <div key={`${item.title}-${item.time}`} className="dashboard-notification-item">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.note}</p>
                </div>
                <span>{item.time}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel">
          <SectionHeader eyebrow="Operational controls" title="Delegation and authority" meta="Permissions ready" />
          <div className="dashboard-permission-grid">
            {['Manage vehicles', 'Approve routes', 'Review maintenance', 'Assign drivers', 'View telemetry', 'Export reports'].map((item) => (
              <label key={item} className="dashboard-permission-item">
                <span className="dashboard-permission-item__check" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </article>

        <article className="dashboard-panel dashboard-panel--form">
          <SectionHeader eyebrow="Telemetry intake" title="Live telemetry simulator" />
          <p className="muted">Send a telemetry reading for a vehicle to update charts and trigger maintenance alerts when thresholds are crossed.</p>
          <form className="inline-form" onSubmit={handleTelemetrySubmit}>
            <div className="form-grid">
              <label className="input-group">
                <span>Vehicle</span>
                <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)}>
                  {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} ({vehicle.id})</option>)}
                </select>
              </label>
              <label className="input-group">
                <span>Speed (km/h)</span>
                <input type="number" min="0" step="0.01" value={telemetryForm.speed} onChange={(event) => setTelemetryForm((current) => ({ ...current, speed: formatTelemetryNumericInput(event.target.value) }))} />
              </label>
              <label className="input-group">
                <span>Fuel level (%)</span>
                <input type="number" min="0" max="100" step="0.01" value={telemetryForm.fuelLevel} onChange={(event) => setTelemetryForm((current) => ({ ...current, fuelLevel: formatTelemetryNumericInput(event.target.value, { maxValue: 100 }) }))} />
              </label>
              <label className="input-group">
                <span>Latitude</span>
                <input type="number" step="0.0001" value={telemetryForm.latitude} onChange={(event) => setTelemetryForm((current) => ({ ...current, latitude: event.target.value }))} />
              </label>
              <label className="input-group">
                <span>Longitude</span>
                <input type="number" step="0.0001" value={telemetryForm.longitude} onChange={(event) => setTelemetryForm((current) => ({ ...current, longitude: event.target.value }))} />
              </label>
              <label className="input-group">
                <span>Timestamp</span>
                <input type="datetime-local" value={telemetryForm.timestamp ?? ''} onChange={(event) => setTelemetryForm((current) => ({ ...current, timestamp: event.target.value }))} />
              </label>
            </div>
            {telemetryError ? <div className="form-error">{telemetryError}</div> : null}
            {telemetryMessage ? <div className="form-success">{telemetryMessage}</div> : null}
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isSubmittingTelemetry}>{isSubmittingTelemetry ? 'Sending telemetry...' : 'Send telemetry event'}</button>
              <button className="secondary-button" type="button" onClick={() => setTelemetryForm(initialTelemetryForm)}>Reset sample values</button>
            </div>
          </form>
        </article>
      </section>
    </div>
  )
}
