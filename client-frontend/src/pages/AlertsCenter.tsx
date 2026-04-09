import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { acknowledgeAlert, fetchAlerts, resolveAlert } from '../services/apiService'
import type { Alert, AlertLifecycleStatus, AlertSeverity } from '../types'

type StatusFilter = AlertLifecycleStatus | 'ALL'
type SeverityFilter = AlertSeverity | 'ALL'

function severityClass(severity: AlertSeverity) {
  switch (severity) {
    case 'CRITICAL':
      return 'status-pill status-pill--rose'
    case 'HIGH':
      return 'status-pill status-pill--amber'
    case 'MEDIUM':
      return 'status-pill status-pill--blue'
    default:
      return 'status-pill status-pill--mint'
  }
}

function statusClass(status: AlertLifecycleStatus) {
  switch (status) {
    case 'OPEN':
      return 'status-pill status-pill--rose'
    case 'ACKNOWLEDGED':
      return 'status-pill status-pill--amber'
    case 'IN_PROGRESS':
      return 'status-pill status-pill--blue'
    case 'RESOLVED':
      return 'status-pill status-pill--mint'
    default:
      return 'status-pill'
  }
}

function formatTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

export function AlertsCenter() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadAlerts() {
    setLoading(true)
    setMessage(null)

    try {
      setAlerts(await fetchAlerts())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load alerts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAlerts()
  }, [])

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        const matchesStatus = statusFilter === 'ALL' || alert.status === statusFilter
        const matchesSeverity = severityFilter === 'ALL' || alert.severity === severityFilter
        return matchesStatus && matchesSeverity
      }),
    [alerts, severityFilter, statusFilter],
  )

  async function handleAlertAction(id: string, action: 'acknowledge' | 'resolve') {
    setWorkingId(id)
    setMessage(null)

    try {
      if (action === 'acknowledge') {
        await acknowledgeAlert(id)
      } else {
        await resolveAlert(id)
      }
      await loadAlerts()
      setMessage(`Alert ${action}d successfully.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Alert action failed.')
    } finally {
      setWorkingId(null)
    }
  }

  const criticalAlerts = alerts.filter((alert) => alert.severity === 'CRITICAL').length
  const openAlerts = alerts.filter((alert) => alert.status === 'OPEN').length
  const acknowledgedAlerts = alerts.filter((alert) => alert.status === 'ACKNOWLEDGED').length

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Alert center"
        title="Alerts Center"
        description="Track maintenance, compliance, dispatch exceptions, and live telemetry alerts from one operational board."
        actionLabel="Refresh alerts"
        actionDisabled={loading}
        onAction={() => {
          void loadAlerts()
        }}
      />

      {message ? <div className="notice">{message}</div> : null}

      <section className="dashboard-stats">
        {[
          { label: 'Alerts', value: alerts.length, note: 'Total records in the alert engine' },
          { label: 'Open', value: openAlerts, note: 'Alerts waiting on action' },
          { label: 'Critical', value: criticalAlerts, note: 'Requires immediate attention' },
          { label: 'Acknowledged', value: acknowledgedAlerts, note: 'Alerts already reviewed' },
        ].map((stat) => (
          <article key={stat.label} className="stat-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.note}</small>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Alert filters</h3>
            <p className="muted">Filter by lifecycle state and severity to focus on the queue that matters right now.</p>
          </div>
        </div>

        <div className="inline-filters">
          {(['ALL', 'OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              className={`filter-chip${statusFilter === status ? ' filter-chip--active' : ''}`}
              type="button"
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="inline-filters">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as SeverityFilter[]).map((severity) => (
            <button
              key={severity}
              className={`filter-chip${severityFilter === severity ? ' filter-chip--active' : ''}`}
              type="button"
              onClick={() => setSeverityFilter(severity)}
            >
              {severity}
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <span className="dashboard-section__eyebrow">Queue</span>
            <h2 className="dashboard-section__title">Operational alerts</h2>
          </div>
          <span className="dashboard-section__counter">{filteredAlerts.length} visible</span>
        </div>

        <div className="alerts-grid">
          {loading ? (
            <article className="panel">
              <p className="muted">Loading alerts...</p>
            </article>
          ) : filteredAlerts.length ? (
            filteredAlerts.map((alert) => (
              <article key={alert.id} className="alert-card">
                <div className="alert-card__header">
                  <div>
                    <span className="dashboard-card-header__eyebrow">{alert.category}</span>
                    <h3>{alert.title}</h3>
                  </div>
                  <div className="alert-card__chips">
                    <span className={severityClass(alert.severity)}>{alert.severity}</span>
                    <span className={statusClass(alert.status)}>{alert.status}</span>
                  </div>
                </div>

                <p className="muted">{alert.description}</p>

                <div className="alert-card__meta">
                  <span>{alert.relatedTripId ? `Trip ${alert.relatedTripId}` : 'No trip link'}</span>
                  <span>{alert.relatedVehicleId ? `Vehicle ${alert.relatedVehicleId}` : 'No vehicle link'}</span>
                  <span>{formatTime(alert.createdAt)}</span>
                </div>

                <div className="alert-card__actions">
                  <button
                    className="secondary-button"
                    disabled={workingId === alert.id || alert.status === 'CLOSED' || alert.status === 'RESOLVED'}
                    type="button"
                    onClick={() => void handleAlertAction(alert.id, 'acknowledge')}
                  >
                    {workingId === alert.id ? 'Working...' : 'Acknowledge'}
                  </button>
                  <button
                    className="primary-button"
                    disabled={workingId === alert.id || alert.status === 'CLOSED' || alert.status === 'RESOLVED'}
                    type="button"
                    onClick={() => void handleAlertAction(alert.id, 'resolve')}
                  >
                    {workingId === alert.id ? 'Working...' : 'Resolve'}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <article className="panel">
              <p className="muted">No alerts match the current filters.</p>
            </article>
          )}
        </div>
      </section>
    </div>
  )
}
