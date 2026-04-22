import { startTransition, useDeferredValue, useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchDriverPerformance, fetchDriverTripHistory } from '../services/apiService'
import type {
  DriverPerformanceDashboard,
  DriverTripHistoryRow,
  TripStatus,
} from '../types'

type FilterState = {
  from: string
  to: string
  status: 'ALL' | TripStatus
}

type TrendSummary = {
  direction: 'up' | 'down' | 'flat'
  label: string
}

const performanceStatusOptions: Array<'ALL' | TripStatus> = [
  'ALL',
  'COMPLETED',
  'IN_PROGRESS',
  'PAUSED',
  'DISPATCHED',
  'BLOCKED',
  'CANCELLED',
]

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
    status: 'ALL',
  }
}

function toApiFilters(filters: FilterState) {
  return {
    startDate: `${filters.from}T00:00:00`,
    endDate: `${filters.to}T23:59:59`,
    status: filters.status === 'ALL' ? undefined : filters.status,
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Unavailable'
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDurationMinutes(minutes?: number | null) {
  if (!minutes || minutes <= 0) {
    return '0 min'
  }

  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const remainingMinutes = rounded % 60

  if (hours === 0) {
    return `${remainingMinutes} min`
  }

  return `${hours}h ${remainingMinutes}m`
}

function formatTripStatus(status: TripStatus) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatNumber(value?: number | null, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return '0.0'
  }

  return value.toFixed(digits)
}

function formatPercent(value?: number | null) {
  return `${formatNumber(value, 1)}%`
}

function formatDistance(value?: number | null) {
  return `${formatNumber(value, 1)} km`
}

function formatFuelRate(value?: number | null) {
  return `${formatNumber(value, 1)} L/100 km`
}

function formatFuelEfficiency(value?: number | null) {
  return `${formatNumber(value, 2)} km/unit`
}

function formatSignedDelta(value: number, suffix = '%') {
  const absolute = Math.abs(value).toFixed(1)
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${absolute}${suffix}`
}

function average(values: number[]) {
  if (!values.length) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function trendFromSeries(values: number[], invert = false): TrendSummary | null {
  if (values.length < 2) {
    return null
  }

  const midpoint = Math.floor(values.length / 2)
  const previous = average(values.slice(0, midpoint || 1))
  const current = average(values.slice(midpoint))
  const delta = current - previous

  if (Math.abs(delta) < 0.1) {
    return { direction: 'flat', label: 'Stable' }
  }

  const isPositive = invert ? delta < 0 : delta > 0
  return {
    direction: isPositive ? 'up' : 'down',
    label: `${isPositive ? 'Up' : 'Down'} ${formatSignedDelta(delta, '')}`,
  }
}

function escapeCsvCell(value: unknown) {
  const normalized = value == null ? '' : String(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

function buildTripHistoryCsv(history: DriverTripHistoryRow[]) {
  const header = [
    'trip_id',
    'date',
    'status',
    'distance_km',
    'duration_minutes',
    'planned_duration_minutes',
    'actual_duration_minutes',
    'delay_minutes',
    'fuel_used',
  ]

  const rows = history.map((trip) => [
    trip.tripId,
    trip.tripDate,
    trip.status,
    trip.distanceKm,
    trip.durationMinutes,
    trip.plannedDurationMinutes,
    trip.actualDurationMinutes,
    trip.delayMinutes,
    trip.fuelUsed ?? '',
  ])

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n')
}

function performanceMetricBars(performance: DriverPerformanceDashboard) {
  return [
    { label: 'On-time', value: performance.fleetOnTimePercent, color: '#2563eb' },
    { label: 'Safety', value: performance.averageSafetyScore, color: '#0f766e' },
    { label: 'Delay control', value: Math.max(0, 100 - performance.delayFrequencyPercent), color: '#f59e0b' },
    { label: 'Fuel score', value: Math.min(100, Math.max(0, performance.averageFuelEfficiencyKmPerUnit * 10)), color: '#7c3aed' },
  ]
}

function safetyTone(status: DriverPerformanceDashboard['safetyStatus']) {
  switch (status) {
    case 'Excellent':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
    case 'Good':
      return 'bg-amber-100 text-amber-700 ring-amber-200'
    default:
      return 'bg-rose-100 text-rose-700 ring-rose-200'
  }
}

function trendTone(direction: TrendSummary['direction']) {
  switch (direction) {
    case 'up':
      return 'text-emerald-600'
    case 'down':
      return 'text-rose-600'
    default:
      return 'text-slate-500'
  }
}

function statusPillTone(status: TripStatus) {
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
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <p className="mt-3 max-w-sm text-sm text-slate-600">{message}</p>
    </div>
  )
}

function LoadingBlock() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-4 h-9 w-28 rounded bg-slate-200" />
          <div className="mt-6 h-3 w-40 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export function DriverPerformance() {
  const [draftFilters, setDraftFilters] = useState<FilterState>(() => defaultFilters())
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() => defaultFilters())
  const deferredFilters = useDeferredValue(appliedFilters)

  const performanceQuery = useQuery({
    queryKey: ['driver-performance-page', deferredFilters],
    queryFn: () => fetchDriverPerformance(toApiFilters(deferredFilters)),
  })

  const historyQuery = useQuery({
    queryKey: ['driver-performance-history', deferredFilters],
    queryFn: () => fetchDriverTripHistory(toApiFilters(deferredFilters)),
  })

  const isLoading = performanceQuery.isPending || historyQuery.isPending
  const isFetching = performanceQuery.isFetching || historyQuery.isFetching
  const performance = performanceQuery.data
  const history = historyQuery.data

  const summaryCards = useMemo(() => {
    if (!performance || !history) {
      return []
    }

    const distanceTrend = trendFromSeries(performance.tripsOverTime.map((point) => point.distanceKm))
    const tripTrend = trendFromSeries(performance.tripsOverTime.map((point) => point.tripsCompleted))
    const onTimeTrend = trendFromSeries(performance.tripsOverTime.map((point) => point.onTimePercent))
    const durationTrend = trendFromSeries(history.trips.map((trip) => trip.durationMinutes), true)

    return performance.kpis.map((kpi) => {
      const trend = (() => {
        switch (kpi.key) {
          case 'driver-performance-trips-completed':
            return tripTrend
          case 'driver-performance-on-time':
            return onTimeTrend
          case 'driver-performance-distance':
            return distanceTrend
          case 'driver-performance-duration':
            return durationTrend
          default:
            return null
        }
      })()

      return { ...kpi, trend }
    })
  }, [history, performance])

  const metricBars = useMemo(
    () => (performance ? performanceMetricBars(performance) : []),
    [performance],
  )

  const requestError = performanceQuery.error ?? historyQuery.error

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(() => setAppliedFilters(draftFilters))
  }

  function handleExportCsv() {
    if (!history?.trips.length) {
      return
    }

    const csv = buildTripHistoryCsv(history.trips)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    link.href = url
    link.download = `driver-performance-${stamp}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.18),_transparent_42%),linear-gradient(135deg,_#ffffff,_#f8fafc)] px-6 py-8 md:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-teal-700">Driver Performance Analytics</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Historical performance, efficiency, and behavior insights
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
                Review completed-trip trends, delivery punctuality, safety behavior, fuel efficiency, and time discipline in one dedicated historical view.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void performanceQuery.refetch()
                  void historyQuery.refetch()
                }}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                {isFetching ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!history?.trips.length}
                className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr_auto]" onSubmit={handleApplyFilters}>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">From</span>
            <input
              type="date"
              value={draftFilters.from}
              onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">To</span>
            <input
              type="date"
              value={draftFilters.to}
              onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value as FilterState['status'] }))}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            >
              {performanceStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All statuses' : formatTripStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            Apply filters
          </button>
        </form>
      </section>

      {requestError ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
          {requestError instanceof Error ? requestError.message : 'Unable to load driver performance analytics.'}
        </section>
      ) : null}

      {isLoading ? (
        <LoadingBlock />
      ) : performance && history ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <article key={card.key} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{card.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{card.value}</p>
                  </div>
                  {card.trend ? (
                    <span className={`inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold ${trendTone(card.trend.direction)}`}>
                      {card.trend.direction === 'up' ? '↑' : card.trend.direction === 'down' ? '↓' : '→'} {card.trend.label}
                    </span>
                  ) : null}
                </div>
                <p className="mt-5 text-sm leading-6 text-slate-500">{card.note}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Safety Score</p>
                  <div className="mt-4 flex items-end gap-3">
                    <span className="text-5xl font-semibold tracking-tight text-slate-900">{formatNumber(performance.averageSafetyScore)}</span>
                    <span className="pb-2 text-sm font-medium text-slate-500">/ 100</span>
                  </div>
                  <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${safetyTone(performance.safetyStatus)}`}>
                    {performance.safetyStatus}
                  </span>
                </div>

                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Overspeeding</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">{performance.totalOverspeedEvents}</p>
                    <p className="mt-1 text-sm text-slate-500">events</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Route deviation</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">{performance.totalRouteDeviationEvents}</p>
                    <p className="mt-1 text-sm text-slate-500">alerts</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Idle time</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">{performance.totalIdleMinutes}</p>
                    <p className="mt-1 text-sm text-slate-500">minutes</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <p className="text-sm font-medium text-slate-500">Avg fuel consumption</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{formatFuelRate(performance.averageFuelConsumptionPer100Km)}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <p className="text-sm font-medium text-slate-500">Fuel efficiency</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{formatFuelEfficiency(performance.averageFuelEfficiencyKmPerUnit)}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <p className="text-sm font-medium text-slate-500">Delay frequency</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{formatPercent(performance.delayFrequencyPercent)}</p>
                </div>
              </div>
            </article>

            <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Behavior Insights</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">What changed in your driving pattern</h2>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {performance.insights.length ? performance.insights.map((insight) => (
                  <div key={insight.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        insight.tone === 'emerald' ? 'bg-emerald-500'
                          : insight.tone === 'teal' ? 'bg-teal-500'
                            : insight.tone === 'amber' ? 'bg-amber-500'
                              : insight.tone === 'rose' ? 'bg-rose-500'
                                : insight.tone === 'violet' ? 'bg-violet-500'
                                  : 'bg-slate-400'
                      }`} />
                      <p className="text-sm leading-6 text-slate-700">{insight.message}</p>
                    </div>
                  </div>
                )) : (
                  <EmptyState title="Insights" message="Insights will appear once the selected date range contains enough completed-trip history." />
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Trips Over Time</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Completion trend</h2>
                </div>
              </div>

              {performance.tripsOverTime.length ? (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performance.tripsOverTime} margin={{ top: 8, right: 16, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#64748b" />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="#64748b" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="tripsCompleted" name="Trips completed" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Trips over time" message="Completed-trip trend lines will appear once the selected range includes historical deliveries." />
              )}
            </article>

            <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Performance Metrics</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Scorecard bar view</h2>
                </div>
              </div>

              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metricBars} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#64748b" />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} stroke="#64748b" />
                      <Tooltip formatter={(value) => typeof value === 'number' ? value.toFixed(1) : value} />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {metricBars.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Fuel Efficiency</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Distance vs fuel usage</h2>
                </div>
              </div>

              {performance.distanceVsFuel.length ? (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performance.distanceVsFuel} margin={{ top: 8, right: 12, left: -18, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                      <XAxis dataKey="label" angle={-18} textAnchor="end" height={60} tickLine={false} axisLine={false} stroke="#64748b" />
                      <YAxis yAxisId="distance" tickLine={false} axisLine={false} stroke="#64748b" />
                      <YAxis yAxisId="fuel" orientation="right" tickLine={false} axisLine={false} stroke="#f59e0b" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="distance" dataKey="distanceKm" name="Distance km" fill="#2563eb" radius={[10, 10, 0, 0]} />
                      <Bar yAxisId="fuel" dataKey="fuelUsed" name="Fuel used" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Fuel efficiency" message="Fuel efficiency charts will appear when completed trips include enough fuel usage data." />
              )}
            </article>

            <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Time Efficiency</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Planned vs actual duration</h2>
                </div>
              </div>

              {performance.plannedVsActualTime.length ? (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performance.plannedVsActualTime} margin={{ top: 8, right: 12, left: -18, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                      <XAxis dataKey="label" angle={-18} textAnchor="end" height={60} tickLine={false} axisLine={false} stroke="#64748b" />
                      <YAxis tickLine={false} axisLine={false} stroke="#64748b" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="plannedDurationMinutes" name="Planned minutes" fill="#cbd5e1" radius={[10, 10, 0, 0]} />
                      <Bar dataKey="actualDurationMinutes" name="Actual minutes" fill="#0f766e" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Time efficiency" message="Planned-versus-actual duration charts appear when historical completed trips are available in the selected range." />
              )}
            </article>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Trip History</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Historical trip ledger</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Filtered trip history is scoped to the authenticated driver and focuses only on historical records, with no live tracking or execution controls.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Trips</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{history.totalTrips}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Distance</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{formatDistance(history.totalDistanceCoveredKm)}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Avg duration</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{formatDurationMinutes(history.averageTripDurationMinutes)}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-[28px] border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50">
                    <tr className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      <th className="px-5 py-4">Trip ID</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Distance</th>
                      <th className="px-5 py-4">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {history.trips.length ? history.trips.map((trip) => (
                      <tr key={trip.tripId} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{trip.tripId}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{formatDateTime(trip.tripDate)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusPillTone(trip.status)}`}>
                            {formatTripStatus(trip.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-900">{trip.distanceKm} km</td>
                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-slate-900">{formatDurationMinutes(trip.durationMinutes)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Planned {formatDurationMinutes(trip.plannedDurationMinutes)} · Delay {trip.delayMinutes}m
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-5 py-12">
                          <EmptyState title="Trip history" message="No historical trips matched the current filters." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
