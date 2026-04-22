import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { fetchAuditLogs, fetchAuditLogsByEntity } from '../services/apiService'
import type { AuditLogEntry } from '../types'

const defaultFrom = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
const defaultTo = new Date().toISOString().slice(0, 16)
const tableGridStyle = { gridTemplateColumns: '1fr 1fr 1.35fr 1fr' } as const

function formatDateTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatEntity(item: AuditLogEntry) {
  return item.entityId ? `${item.entityType} / ${item.entityId}` : item.entityType
}

export function AuditLogs() {
  const [items, setItems] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')

  const loadAuditLogs = useCallback(
    async (filters: { from: string; to: string; entityType: string; entityId: string }) => {
      setLoading(true)
      setError('')

      try {
        const data =
          filters.entityType.trim() && filters.entityId.trim()
            ? await fetchAuditLogsByEntity(filters.entityType.trim(), filters.entityId.trim())
            : await fetchAuditLogs({ from: filters.from, to: filters.to })
        setItems(data)
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unable to load audit logs.'
        setItems([])
        setError(message)
      } finally {
        setLoading(false)
        setWorking(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadAuditLogs({ from: defaultFrom, to: defaultTo, entityType: '', entityId: '' })
  }, [loadAuditLogs])

  const actionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    items.forEach((item) => {
      counts.set(item.action, (counts.get(item.action) ?? 0) + 1)
    })
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 4)
  }, [items])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    await loadAuditLogs({ from, to, entityType, entityId })
  }

  function handleRefresh() {
    setWorking(true)
    void loadAuditLogs({ from, to, entityType, entityId })
  }

  function handleReset() {
    setFrom(defaultFrom)
    setTo(defaultTo)
    setEntityType('')
    setEntityId('')
    setWorking(true)
    void loadAuditLogs({ from: defaultFrom, to: defaultTo, entityType: '', entityId: '' })
  }

  return (
    <div className="page-shell">
      <PageHeader
        actionDisabled={loading || working}
        actionLabel="Refresh logs"
        description="Read-only history for user actions and entity changes. Audit entries can be filtered, but never edited or deleted."
        eyebrow="Audit trail"
        onAction={handleRefresh}
        title="Immutable audit logs"
      />

      <section className="analytics-filter-container">
        <form className="analytics-filter" onSubmit={handleSubmit}>
          <label>
            <span>From</span>
            <input value={from} onChange={(event) => setFrom(event.target.value)} type="datetime-local" />
          </label>
          <label>
            <span>To</span>
            <input value={to} onChange={(event) => setTo(event.target.value)} type="datetime-local" />
          </label>
          <label>
            <span>Entity type</span>
            <input
              placeholder="TRIP, ALERT, MAINTENANCE_SCHEDULE"
              type="text"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            />
          </label>
          <label>
            <span>Entity id</span>
            <input
              placeholder="TRIP-1001"
              type="text"
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
            />
          </label>
          <div className="analytics-filter__actions">
            <button className="primary-button" disabled={loading || working} type="submit">
              Apply filters
            </button>
            <button className="secondary-button" disabled={loading || working} onClick={handleReset} type="button">
              Reset
            </button>
            <span className="badge">{items.length} records</span>
          </div>
        </form>
      </section>

      <section className="dashboard-stats">
        <article className="stat-card">
          <span>Total records</span>
          <strong>{items.length}</strong>
          <small>Returned by the active filter window</small>
        </article>
        <article className="stat-card">
          <span>Write policy</span>
          <strong>Append only</strong>
          <small>No edit or delete actions are available</small>
        </article>
        {actionCounts.map(([action, count]) => (
          <article key={action} className="stat-card">
            <span>{action}</span>
            <strong>{count}</strong>
            <small>Occurrences in current result set</small>
          </article>
        ))}
      </section>

      <section className="table-container--flat">
        <div className="panel__header">
          <div>
            <h3>Event stream</h3>
            <p className="muted">Most recent audit records first, with the required user, action, entity, and timestamp fields.</p>
          </div>
          <span className="badge">Immutable</span>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="trip-table">
          <div className="trip-table__head" style={tableGridStyle}>
            <span>User</span>
            <span>Action</span>
            <span>Entity</span>
            <span>Timestamp</span>
          </div>
          {items.length ? (
            items.map((item) => (
              <div key={item.id} className="trip-table__row trip-table__row--static" style={tableGridStyle}>
                <span>
                  <strong>{item.actor}</strong>
                  <small>{item.id}</small>
                </span>
                <span>
                  <strong>{item.action}</strong>
                  <small>{item.summary}</small>
                </span>
                <span>
                  <strong>{formatEntity(item)}</strong>
                  <small>{item.entityType}</small>
                </span>
                <span>
                  <strong>{formatDateTime(item.createdAt)}</strong>
                  <small>{item.detailsJson ? 'Details captured' : 'Summary only'}</small>
                </span>
              </div>
            ))
          ) : (
            <p className="muted">{loading ? 'Loading audit logs...' : 'No audit records matched the current filter.'}</p>
          )}
        </div>
      </section>
    </div>
  )
}
