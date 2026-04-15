import { useEffect, useState } from 'react'
import {
  fetchAdminUsers,
  fetchAuditLogs,
  updateUserRole,
} from '../services/apiService'
import type { 
  AdminUser, 
  AuditLogEntry, 
  AppRole 
} from '../types'

const ROLES: AppRole[] = [
  'ADMIN',
  'DRIVER',
  'DISPATCHER',
  'PLANNER',
  'OPERATIONS_MANAGER',
  'MAINTENANCE_MANAGER'
]

export function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const [u, logs] = await Promise.all([
        fetchAdminUsers(),
        fetchAuditLogs()
      ])
      setUsers(u)
      setAuditLogs(logs.slice(0, 15)) // Show recent logs
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load system administration data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setWorking(true)
    try {
      await updateUserRole(userId, { role: newRole })
      await loadData()
      setMessage(`Updated user ${userId} to role ${newRole}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update user role')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return <div className="dd-loading">Accessing systemic control layer...</div>

  return (
    <div className="dd">
      {message && <div className="dd-toast">{message}</div>}

      {/* Top: System Stats */}
      <section className="dd-topbar">
        <div className="dd-stats-row">
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#253B80' }}>{users.length}</span>
            <span className="dd-stat__l">System Users</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#7c3aed' }}>{ROLES.length}</span>
            <span className="dd-stat__l">Defined Roles</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#059669' }}>{auditLogs.length}</span>
            <span className="dd-stat__l">Recent Activity</span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat__n" style={{ color: '#0ea5e9' }}>{users.filter(u => u.assignedRegion === 'HQ').length}</span>
            <span className="dd-stat__l">HQ Personnel</span>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <div className="dd-grid" style={{ marginTop: '24px' }}>
        <div className="dd-grid__main">
          {/* Users Table */}
          <section className="dd-card">
            <div className="dd-card__head">
              <h4>System User Management</h4>
              <button className="dd-btn dd-btn--ghost" onClick={() => void loadData()}>Refresh Records</button>
            </div>
            <div className="dd-tbl">
              <div className="dd-tbl__head">
                <span>User Name</span>
                <span>Login Email</span>
                <span>Region</span>
                <span>System Role</span>
              </div>
              {users.map(u => (
                <div key={u.id} className="dd-tbl__row">
                  <span><strong>{u.name}</strong></span>
                  <span>{u.loginEmail}</span>
                  <span>{u.assignedRegion}</span>
                  <span>
                    <select 
                      value={u.role} 
                      onChange={e => handleRoleChange(u.id, e.target.value as AppRole)}
                      disabled={working}
                      style={{ 
                        background: '#f9fafb', 
                        border: '1px solid #e5e7eb', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}
                    >
                      {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom: Audit Logs */}
          <section className="dd-card" style={{ marginTop: '24px' }}>
            <div className="dd-card__head"><h4>System Audit Trail</h4></div>
            <div className="dd-tbl dd-tbl--audit">
              <div className="dd-tbl__head">
                <span>Timestamp</span>
                <span>Actor</span>
                <span>Action</span>
                <span>Summary</span>
              </div>
              {auditLogs.map(log => (
                <div key={log.id} className="dd-tbl__row" style={{ fontSize: '0.75rem' }}>
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                  <span><strong>{log.actor}</strong></span>
                  <span><span className="dd-pill dd-pill--blue" style={{ fontSize: '0.6rem' }}>{log.action}</span></span>
                  <span>{log.summary}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Sidebar: Roles & Permissions */}
        <aside className="dd-grid__side">
          <div className="dd-block">
            <h4 className="dd-block__title">System Roles Reference</h4>
            <div className="dd-roles-reference">
              <div className="dd-role-item" style={{ marginBottom: '16px' }}>
                <strong>ADMIN</strong>
                <p className="muted" style={{ fontSize: '0.75rem' }}>Full systemic control, user management, and global audit oversight.</p>
              </div>
              <div className="dd-role-item" style={{ marginBottom: '16px' }}>
                <strong>OPERATIONS_MANAGER</strong>
                <p className="muted" style={{ fontSize: '0.75rem' }}>Strategic oversight of fleet performance, trends, and lifecycle analytics.</p>
              </div>
              <div className="dd-role-item" style={{ marginBottom: '16px' }}>
                <strong>DISPATCHER</strong>
                <p className="muted" style={{ fontSize: '0.75rem' }}>Tactical execution, driver-trip assignments, and live monitoring.</p>
              </div>
              <div className="dd-role-item" style={{ marginBottom: '16px' }}>
                <strong>MAINTENANCE_MANAGER</strong>
                <p className="muted" style={{ fontSize: '0.75rem' }}>Workshop bay control, service scheduling, and vehicle health.</p>
              </div>
              <div className="dd-role-item" style={{ marginBottom: '16px' }}>
                <strong>PLANNER</strong>
                <p className="muted" style={{ fontSize: '0.75rem' }}>Route construction, stop sequencing, and dispatch preparation.</p>
              </div>
              <div className="dd-role-item">
                <strong>DRIVER</strong>
                <p className="muted" style={{ fontSize: '0.75rem' }}>Field execution, trip lifecycle actions, and telemetric updates.</p>
              </div>
            </div>
          </div>

          <div className="dd-block">
            <h4 className="dd-block__title">Security Policy</h4>
            <p className="muted" style={{ fontSize: '0.8rem' }}>
              All systemic actions are recorded in the immutable audit trail. Role changes trigger immediate session re-evaluation on next client synchronization.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
