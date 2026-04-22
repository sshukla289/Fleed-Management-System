import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { ALL_ROLES, ROLE_LABELS } from '../security/permissions'
import {
  fetchNotificationBroadcasts,
  fetchSystemConfigEntries,
  sendNotificationBroadcast,
  updateSystemConfigEntries,
} from '../services/apiService'
import type {
  AppRole,
  CreateNotificationBroadcastInput,
  NotificationBroadcast,
  NotificationSeverity,
  SystemConfigEntry,
} from '../types'

const SETTINGS_KEY_ORDER = [
  'speed.limit.kph',
  'alerts.low-fuel-threshold-percent',
  'alerts.idle-threshold-seconds',
  'alerts.route-deviation-threshold-meters',
  'alerts.route-recovery-threshold-meters',
  'alerts.route-deviation-debounce-seconds',
]

function formatDateTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function severityTone(severity: NotificationSeverity) {
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

function orderedSettings(entries: SystemConfigEntry[]) {
  const order = new Map(SETTINGS_KEY_ORDER.map((key, index) => [key, index]))
  return [...entries].sort((left, right) => (order.get(left.key) ?? 999) - (order.get(right.key) ?? 999))
}

export function AdminSystemControlPage() {
  const [settings, setSettings] = useState<SystemConfigEntry[]>([])
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [broadcasts, setBroadcasts] = useState<NotificationBroadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [broadcastSaving, setBroadcastSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [broadcastForm, setBroadcastForm] = useState<CreateNotificationBroadcastInput>({
    title: '',
    message: '',
    severity: 'HIGH',
    targetRoles: ['OPERATIONS_MANAGER', 'DISPATCHER'],
  })

  const hydrateDrafts = useCallback((entries: SystemConfigEntry[]) => {
    setDraftValues(
      entries.reduce<Record<string, string>>((result, entry) => {
        result[entry.key] = entry.value
        return result
      }, {}),
    )
  }, [])

  const loadModule = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setError('')

    try {
      const [settingsResponse, broadcastsResponse] = await Promise.all([
        fetchSystemConfigEntries(),
        fetchNotificationBroadcasts(),
      ])

      const ordered = orderedSettings(settingsResponse)
      setSettings(ordered)
      hydrateDrafts(ordered)
      setBroadcasts(broadcastsResponse)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin control data.')
    } finally {
      if (showSpinner) {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }, [hydrateDrafts])

  useEffect(() => {
    void loadModule()
  }, [loadModule])

  const changedSettings = useMemo(
    () => settings.filter((entry) => draftValues[entry.key] !== entry.value),
    [draftValues, settings],
  )

  const selectedRoleCount = broadcastForm.targetRoles.length
  const settingsByKey = useMemo(
    () =>
      settings.reduce<Record<string, SystemConfigEntry>>((result, entry) => {
        result[entry.key] = entry
        return result
      }, {}),
    [settings],
  )

  const speedLimit = draftValues['speed.limit.kph'] ?? settingsByKey['speed.limit.kph']?.value ?? '--'
  const lowFuelThreshold = draftValues['alerts.low-fuel-threshold-percent'] ?? settingsByKey['alerts.low-fuel-threshold-percent']?.value ?? '--'
  const idleThreshold = draftValues['alerts.idle-threshold-seconds'] ?? settingsByKey['alerts.idle-threshold-seconds']?.value ?? '--'

  function updateFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(''), 3500)
  }

  function toggleRole(role: AppRole) {
    setBroadcastForm((current) => {
      const nextRoles = current.targetRoles.includes(role)
        ? current.targetRoles.filter((value) => value !== role)
        : [...current.targetRoles, role]

      return {
        ...current,
        targetRoles: nextRoles,
      }
    })
  }

  async function handleSaveSettings() {
    if (!changedSettings.length) {
      updateFeedback('No system setting changes to save.')
      return
    }

    setSettingsSaving(true)
    setError('')

    try {
      const updated = await updateSystemConfigEntries({
        entries: changedSettings.map((entry) => ({
          key: entry.key,
          value: draftValues[entry.key],
        })),
      })

      const ordered = orderedSettings(updated)
      setSettings(ordered)
      hydrateDrafts(ordered)
      updateFeedback('System configuration updated.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save system settings.')
    } finally {
      setSettingsSaving(false)
    }
  }

  async function handleSendBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      setError('Broadcast title and message are required.')
      return
    }

    if (!broadcastForm.targetRoles.length) {
      setError('Select at least one target role.')
      return
    }

    setBroadcastSaving(true)

    try {
      const created = await sendNotificationBroadcast({
        ...broadcastForm,
        title: broadcastForm.title.trim(),
        message: broadcastForm.message.trim(),
      })

      setBroadcasts((current) => [created, ...current])
      setBroadcastForm({
        title: '',
        message: '',
        severity: broadcastForm.severity,
        targetRoles: broadcastForm.targetRoles,
      })
      updateFeedback('Broadcast sent successfully.')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send the broadcast.')
    } finally {
      setBroadcastSaving(false)
    }
  }

  return (
    <div className="page-shell admin-system-control">
      <PageHeader
        actionDisabled={loading || refreshing || settingsSaving || broadcastSaving}
        actionLabel={refreshing ? 'Refreshing...' : 'Refresh module'}
        description="Manage admin broadcast notifications and live operational thresholds from one dynamic control surface."
        eyebrow="Admin control"
        onAction={() => { void loadModule(false) }}
        title="Notifications and system config"
      />

      {feedback ? <div className="admin-control-feedback admin-control-feedback--success">{feedback}</div> : null}
      {error ? <div className="admin-control-feedback admin-control-feedback--error">{error}</div> : null}

      <section className="dashboard-stats">
        <article className="stat-card">
          <span>Speed limit</span>
          <strong>{speedLimit} km/h</strong>
          <small>Live overspeed threshold</small>
        </article>
        <article className="stat-card">
          <span>Low fuel alert</span>
          <strong>{lowFuelThreshold}%</strong>
          <small>Threshold for fuel warnings</small>
        </article>
        <article className="stat-card">
          <span>Idle alert</span>
          <strong>{idleThreshold}s</strong>
          <small>Seconds before idle dispatch alert</small>
        </article>
        <article className="stat-card">
          <span>Broadcasts</span>
          <strong>{broadcasts.length}</strong>
          <small>{selectedRoleCount} roles selected in composer</small>
        </article>
      </section>

      <section className="admin-control-grid">
        <article className="table-container--flat admin-control-panel">
          <div className="panel__header">
            <div>
              <h3>Settings panel</h3>
              <p className="muted">These values are stored server-side and applied dynamically to telemetry and alert behavior.</p>
            </div>
            <span className="badge">{changedSettings.length} unsaved</span>
          </div>

          {loading ? (
            <p className="muted">Loading system settings...</p>
          ) : (
            <div className="admin-control-settings">
              {settings.map((entry) => (
                <label key={entry.key} className="admin-control-setting-card">
                  <span className="admin-control-setting-card__category">{entry.category}</span>
                  <strong>{entry.label}</strong>
                  <small>{entry.description}</small>
                  <input
                    onChange={(event) =>
                      setDraftValues((current) => ({
                        ...current,
                        [entry.key]: event.target.value,
                      }))
                    }
                    type="number"
                    value={draftValues[entry.key] ?? entry.value}
                  />
                  <span className="admin-control-setting-card__meta">
                    {entry.updatedBy ? `Updated by ${entry.updatedBy}` : 'System default'}{entry.updatedAt ? ` • ${formatDateTime(entry.updatedAt)}` : ''}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="form-actions">
            <button
              className="primary-button"
              disabled={settingsSaving || !changedSettings.length}
              onClick={() => { void handleSaveSettings() }}
              type="button"
            >
              {settingsSaving ? 'Saving...' : 'Save settings'}
            </button>
            <button
              className="secondary-button"
              disabled={settingsSaving}
              onClick={() => hydrateDrafts(settings)}
              type="button"
            >
              Reset changes
            </button>
          </div>
        </article>

        <article className="table-container--flat admin-control-panel">
          <div className="panel__header">
            <div>
              <h3>Notification composer</h3>
              <p className="muted">Broadcast an operational message to one or more roles without hardcoded recipient lists.</p>
            </div>
            <span className="badge">{broadcastForm.targetRoles.length} roles targeted</span>
          </div>

          <form className="admin-control-composer" onSubmit={handleSendBroadcast}>
            <label className="input-group">
              <span>Broadcast title</span>
              <input
                onChange={(event) => setBroadcastForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Dispatch advisory"
                type="text"
                value={broadcastForm.title}
              />
            </label>

            <label className="input-group">
              <span>Severity</span>
              <select
                onChange={(event) => setBroadcastForm((current) => ({ ...current, severity: event.target.value as NotificationSeverity }))}
                value={broadcastForm.severity}
              >
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as NotificationSeverity[]).map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>

            <label className="input-group admin-control-composer__message">
              <span>Message</span>
              <textarea
                onChange={(event) => setBroadcastForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Explain what changed, who should react, and any immediate next step."
                rows={5}
                value={broadcastForm.message}
              />
            </label>

            <div className="admin-control-role-picker">
              <span>Target roles</span>
              <div className="admin-control-role-picker__grid">
                {ALL_ROLES.filter((role) => role !== 'DRIVER').map((role) => {
                  const selected = broadcastForm.targetRoles.includes(role)
                  return (
                    <button
                      key={role}
                      className={`dashboard-chip${selected ? ' dashboard-chip--warn' : ''}`}
                      onClick={() => toggleRole(role)}
                      type="button"
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  )
                })}
                <button
                  className={`dashboard-chip${broadcastForm.targetRoles.includes('DRIVER') ? ' dashboard-chip--warn' : ''}`}
                  onClick={() => toggleRole('DRIVER')}
                  type="button"
                >
                  {ROLE_LABELS.DRIVER}
                </button>
              </div>
            </div>

            <div className="form-actions">
              <button className="primary-button" disabled={broadcastSaving} type="submit">
                {broadcastSaving ? 'Sending...' : 'Send broadcast'}
              </button>
            </div>
          </form>
        </article>
      </section>

      <section className="table-container--flat admin-control-panel">
        <div className="panel__header">
          <div>
            <h3>Broadcast history</h3>
            <p className="muted">Recent admin broadcasts with recipient counts and target-role coverage.</p>
          </div>
        </div>

        <div className="trip-table">
          <div className="trip-table__head" style={{ gridTemplateColumns: '1fr 0.8fr 1.1fr 0.7fr 1.7fr' }}>
            <span>Created</span>
            <span>Severity</span>
            <span>Roles</span>
            <span>Recipients</span>
            <span>Message</span>
          </div>
          {broadcasts.length ? (
            broadcasts.map((broadcast) => (
              <div key={broadcast.id} className="trip-table__row trip-table__row--static" style={{ gridTemplateColumns: '1fr 0.8fr 1.1fr 0.7fr 1.7fr' }}>
                <span>
                  <strong>{formatDateTime(broadcast.createdAt)}</strong>
                  <small>{broadcast.createdBy}</small>
                </span>
                <span>
                  <strong className={severityTone(broadcast.severity)}>{broadcast.severity}</strong>
                  <small>{broadcast.id}</small>
                </span>
                <span>
                  <strong>{broadcast.targetRoles.map((role) => ROLE_LABELS[role]).join(', ')}</strong>
                  <small>Role-based audience</small>
                </span>
                <span>
                  <strong>{broadcast.recipientCount}</strong>
                  <small>Active recipients</small>
                </span>
                <span>
                  <strong>{broadcast.title}</strong>
                  <small>{broadcast.message}</small>
                </span>
              </div>
            ))
          ) : (
            <p className="muted">{loading ? 'Loading broadcast history...' : 'No broadcasts have been sent yet.'}</p>
          )}
        </div>
      </section>
    </div>
  )
}
