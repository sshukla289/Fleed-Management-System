import { startTransition, useDeferredValue, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/useAuth'
import { fetchDriverAnalytics, fetchTripAnalytics, fetchVehicleAnalytics, fetchVehicles } from '../services/apiService'
import type { DriverAnalytics, TripAnalytics, VehicleAnalytics } from '../types'

type FilterState = {
  from: string
  to: string
  region: string
}

type AdminAnalyticsSnapshot = {
  tripAnalytics: TripAnalytics
  vehicleAnalytics: VehicleAnalytics
  driverAnalytics: DriverAnalytics
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function defaultFilters(): FilterState {
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 29)

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(today),
    region: 'ALL',
  }
}

function toApiFilters(filters: FilterState) {
  return {
    startDate: `${filters.from}T00:00:00`,
    endDate: `${filters.to}T23:59:59`,
    region: filters.region === 'ALL' ? undefined : filters.region,
  }
}

function formatPercent(value?: number | null) {
  return `${Number.isFinite(value ?? NaN) ? (value ?? 0).toFixed(1) : '0.0'}%`
}

function formatNumber(value?: number | null, digits = 1) {
  return Number.isFinite(value ?? NaN) ? (value ?? 0).toFixed(digits) : '0.0'
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Unavailable'
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
}

function shortName(value: string) {
  const parts = value.trim().split(/\s+/)
  if (parts.length <= 1) {
    return value
  }

  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}.`
}

function formatTripStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusTone(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
    case 'IN_PROGRESS':
    case 'DISPATCHED':
      return 'bg-blue-100 text-blue-700 ring-blue-200'
    case 'BLOCKED':
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700 ring-rose-200'
    default:
      return 'bg-amber-100 text-amber-700 ring-amber-200'
  }
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{title}</p>
      <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">{message}</p>
    </div>
  )
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-4 h-9 w-28 rounded bg-slate-200" />
          <div className="mt-6 h-3 w-40 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

function StatCard({
  label,
  value,
  note,
  accent,
}: {
  label: string
  value: string
  note: string
  accent: string
}) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-500">{note}</p>
    </article>
  )
}

function SectionCard({
  eyebrow,
  title,
  subtitle,
  meta,
  children,
}: {
  eyebrow: string
  title: string
  subtitle: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
      {children}
    </article>
  )
}

export function AdminAnalytics() {
  const { session } = useAuth()
  const [draftFilters, setDraftFilters] = useState<FilterState>(() => defaultFilters())
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() => defaultFilters())
  const deferredFilters = useDeferredValue(appliedFilters)

  const regionsQuery = useQuery({
    queryKey: ['admin-analytics', 'regions'],
    queryFn: fetchVehicles,
    staleTime: 5 * 60 * 1000,
  })

  const dashboardQuery = useQuery({
    queryKey: ['admin-analytics', deferredFilters],
    queryFn: async (): Promise<AdminAnalyticsSnapshot> => {
      const filters = toApiFilters(deferredFilters)
      const [tripAnalytics, vehicleAnalytics, driverAnalytics] = await Promise.all([
        fetchTripAnalytics(filters),
        fetchVehicleAnalytics(filters),
        fetchDriverAnalytics(filters),
      ])

      return {
        tripAnalytics,
        vehicleAnalytics,
        driverAnalytics,
      }
    },
  })

  const regions = useMemo(() => {
    const values = (regionsQuery.data ?? [])
      .map((vehicle) => vehicle.assignedRegion || vehicle.location)
      .filter((value): value is string => Boolean(value && value.trim()))

    return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
  }, [regionsQuery.data])

  const data = dashboardQuery.data
  const tripAnalytics = data?.tripAnalytics ?? null
  const vehicleAnalytics = data?.vehicleAnalytics ?? null
  const driverAnalytics = data?.driverAnalytics ?? null

  const availableVehicles = vehicleAnalytics?.utilizationByVehicle.filter((vehicle) => !vehicle.maintenanceDue && vehicle.status !== 'Maintenance').length ?? 0
  const blockedVehicles = vehicleAnalytics?.utilizationByVehicle.length ? vehicleAnalytics.utilizationByVehicle.length - availableVehicles : 0

  const summaryCards = useMemo(() => {
    if (!tripAnalytics || !vehicleAnalytics || !driverAnalytics) {
      return []
    }

    return [
      {
        label: 'Fleet availability',
        value: `${availableVehicles}/${vehicleAnalytics.utilizationByVehicle.length || 0}`,
        note: 'Vehicles currently clear for dispatch in the selected scope.',
        accent: '#2563eb',
      },
      {
        label: 'Avg utilization',
        value: formatPercent(vehicleAnalytics.averageUtilizationPercent),
        note: 'Average fleet usage based on completed and active assignments.',
        accent: '#0f766e',
      },
      {
        label: 'Driver productivity',
        value: formatPercent(driverAnalytics.averageProductivityPercent),
        note: 'Completed trips as a share of assigned work for visible drivers.',
        accent: '#f59e0b',
      },
      {
        label: 'On-time delivery',
        value: formatPercent(tripAnalytics.onTimeDeliveryRate),
        note: 'How reliably completed trips landed on or before the plan.',
        accent: '#7c3aed',
      },
    ]
  }, [availableVehicles, driverAnalytics, tripAnalytics, vehicleAnalytics])

  const fleetBarData = useMemo(
    () => (vehicleAnalytics?.utilizationByVehicle ?? [])
      .slice(0, 6)
      .map((vehicle) => ({
        label: shortName(vehicle.name),
        utilizationPercent: vehicle.utilizationPercent,
        activeTrips: vehicle.activeTrips,
      })),
    [vehicleAnalytics],
  )

  const driverBarData = useMemo(
    () => (driverAnalytics?.productivityByDriver ?? [])
      .slice(0, 6)
      .map((driver) => ({
        label: shortName(driver.name),
        productivityPercent: driver.productivityPercent,
        hoursDrivenToday: driver.hoursDrivenToday,
        completedTrips: driver.completedTrips,
      })),
    [driverAnalytics],
  )

  const topDrivers = driverAnalytics?.productivityByDriver.slice(0, 5) ?? []
  const tripTrendData = tripAnalytics?.tripVolumeTrend ?? []
  const recentTrips = tripAnalytics?.recentTrips ?? []
  const delayData = tripAnalytics?.delayTrends ?? []
  const maintenanceTrends = vehicleAnalytics?.maintenanceTrends ?? []

  const requestError = dashboardQuery.error ?? regionsQuery.error
  const isLoading = dashboardQuery.isPending || regionsQuery.isPending
  const isFetching = dashboardQuery.isFetching || regionsQuery.isFetching

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(() => setAppliedFilters(draftFilters))
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(15,118,110,0.14),_transparent_30%),linear-gradient(135deg,_#ffffff,_#f8fafc)] px-6 py-8 md:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-700">Admin Analytics Module</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Insightful dashboards for fleet, drivers, and trip execution
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
                Track throughput, utilization, and delivery risk in one compact view. The layout stays intentionally focused so the signal is obvious even during busy operational windows.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white/80 px-4 py-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Operator</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{session?.profile.name ?? 'Admin'}</p>
                <p className="mt-1 text-sm text-slate-500">{session?.profile.role ?? 'ADMIN'}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/80 px-4 py-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Focus region</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{appliedFilters.region === 'ALL' ? 'All regions' : appliedFilters.region}</p>
                <p className="mt-1 text-sm text-slate-500">Date range filtered</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/80 px-4 py-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Last sync</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{formatDateTime(data?.tripAnalytics.generatedAt)}</p>
                <p className="mt-1 text-sm text-slate-500">{isFetching ? 'Refreshing live analytics' : 'Snapshot ready'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto_auto]" onSubmit={handleApplyFilters}>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">From</span>
            <input
              type="date"
              value={draftFilters.from}
              onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">To</span>
            <input
              type="date"
              value={draftFilters.to}
              onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Region</span>
            <select
              value={draftFilters.region}
              onChange={(event) => setDraftFilters((current) => ({ ...current, region: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="ALL">All regions</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Apply filters
          </button>

          <button
            type="button"
            onClick={() => { void dashboardQuery.refetch() }}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </form>
      </section>

      {requestError ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
          {requestError instanceof Error ? requestError.message : 'Unable to load admin analytics.'}
        </section>
      ) : null}

      {isLoading ? (
        <LoadingGrid />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <StatCard key={card.label} accent={card.accent} label={card.label} note={card.note} value={card.value} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              eyebrow="Fleet performance"
              title="Vehicle utilization by region"
              subtitle="Focus on the fleet units carrying the heaviest share of dispatched and completed work."
              meta={<span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{vehicleAnalytics?.utilizationByVehicle.length ?? 0} vehicles</span>}
            >
              {fleetBarData.length ? (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fleetBarData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#64748b" />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} stroke="#64748b" />
                      <Tooltip formatter={(value) => typeof value === 'number' ? `${value.toFixed(1)}%` : value} />
                      <Bar dataKey="utilizationPercent" name="Utilization" fill="#2563eb" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Fleet utilization" message="Vehicle utilization will appear once the selected scope contains trip activity." />
              )}
            </SectionCard>

            <SectionCard
              eyebrow="Maintenance pressure"
              title="Availability and service blockers"
              subtitle="A small watchlist for the vehicles that are currently limiting dispatch capacity."
              meta={<span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">{blockedVehicles} blocked</span>}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Available</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">{availableVehicles}</p>
                    <p className="mt-1 text-sm text-slate-500">Dispatch-ready vehicles</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Blocked</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">{blockedVehicles}</p>
                    <p className="mt-1 text-sm text-slate-500">Maintenance or operational hold</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {maintenanceTrends.length ? maintenanceTrends.slice(0, 4).map((item) => (
                    <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <p className="mt-1 text-sm text-slate-500">{item.note}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <EmptyState title="Maintenance" message="No maintenance schedules matched the selected region and date range." />
                  )}
                </div>
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard
              eyebrow="Driver performance"
              title="Productivity leaderboard"
              subtitle="See which drivers are converting assigned work into completed deliveries most effectively."
              meta={<span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">{driverAnalytics?.productivityByDriver.length ?? 0} drivers</span>}
            >
              {driverBarData.length ? (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={driverBarData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#64748b" />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} stroke="#64748b" />
                      <Tooltip formatter={(value) => typeof value === 'number' ? `${value.toFixed(1)}%` : value} />
                      <Bar dataKey="productivityPercent" name="Productivity" fill="#f59e0b" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Driver performance" message="Driver productivity bars appear once assigned trips are present in the selected scope." />
              )}
            </SectionCard>

            <SectionCard
              eyebrow="Driver scoreboard"
              title="Who is carrying the load"
              subtitle="A compact list of the most productive drivers with workload context."
              meta={<span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{formatPercent(driverAnalytics?.averageProductivityPercent ?? 0)} avg</span>}
            >
              <div className="space-y-3">
                {topDrivers.length ? topDrivers.map((driver) => (
                  <div key={driver.driverId} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{driver.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {driver.licenseType} · {driver.status}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">{driver.note}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                        {formatPercent(driver.productivityPercent)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Completed</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{driver.completedTrips}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Assigned</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{driver.totalTrips}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Hours today</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{formatNumber(driver.hoursDrivenToday)} h</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <EmptyState title="Driver scoreboard" message="The leaderboard fills in when region-scoped driver assignments are available." />
                )}
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              eyebrow="Trip analytics"
              title="Trip flow over time"
              subtitle="Line trends help surface whether output is rising while delay pressure stays controlled."
              meta={<span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">{tripAnalytics?.completedTrips ?? 0} completed</span>}
            >
              {tripTrendData.length ? (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tripTrendData} margin={{ top: 8, right: 16, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#64748b" />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="#64748b" />
                      <Tooltip />
                      <Line type="monotone" dataKey="completedTrips" name="Completed trips" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="delayedTrips" name="Delayed trips" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Trip flow" message="Trip trend lines appear once the filtered range includes dated trip activity." />
              )}
            </SectionCard>

            <SectionCard
              eyebrow="Delay analysis"
              title="Where lateness is concentrating"
              subtitle="Delay buckets help separate small slips from genuinely severe trip timing issues."
              meta={<span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">{tripAnalytics?.delayedTrips ?? 0} delayed</span>}
            >
              {delayData.length ? (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={delayData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#64748b" />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="#64748b" />
                      <Tooltip />
                      <Bar dataKey="count" name="Trips" fill="#0f766e" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Delay buckets" message="Delay buckets become visible once late trips exist in the filtered range." />
              )}
            </SectionCard>
          </section>

          <SectionCard
            eyebrow="Recent trip rows"
            title="Latest delivery outcomes"
            subtitle="A short ledger keeps the dashboard grounded in real trip records without turning the view into a noisy report dump."
            meta={<span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{recentTrips.length} rows</span>}
          >
            <div className="overflow-hidden rounded-[28px] border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50">
                    <tr className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      <th className="px-5 py-4">Trip</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Distance</th>
                      <th className="px-5 py-4">Delay</th>
                      <th className="px-5 py-4">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {recentTrips.length ? recentTrips.map((trip) => (
                      <tr key={trip.tripId} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{trip.tripId}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {trip.routeId} · {trip.vehicleId}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone(trip.status)}`}>
                            {formatTripStatus(trip.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-900">{trip.actualDistance} km</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{trip.delayMinutes ?? 0} min</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{formatDateTime(trip.completionProcessedAt ?? trip.actualEndTime)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-5 py-12">
                          <EmptyState title="Recent trips" message="No trips matched the selected date and region filters." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
