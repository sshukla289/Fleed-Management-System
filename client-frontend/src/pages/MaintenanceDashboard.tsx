import { useEffect, useState } from 'react'
import {
  fetchVehicles,
  fetchMaintenanceSchedules,
  fetchMaintenanceAlerts,
  createMaintenanceSchedule,
} from '../services/apiService'
import type { 
  Vehicle, 
  MaintenanceSchedule, 
  MaintenanceAlert,
  CreateMaintenanceScheduleInput 
} from '../types'

export function MaintenanceDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([])
  const [issues, setIssues] = useState<MaintenanceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  
  // Schedule Form State
  const [schedForm, setSchedForm] = useState<CreateMaintenanceScheduleInput>({
    vehicleId: '',
    title: '',
    status: 'PLANNED',
    plannedStartDate: new Date().toISOString().split('T')[0],
    plannedEndDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    blockDispatch: true,
    reasonCode: 'ROUTINE',
    notes: ''
  })

  async function loadData() {
    setLoading(true)
    try {
      const [v, s, i] = await Promise.all([
        fetchVehicles(),
        fetchMaintenanceSchedules(),
        fetchMaintenanceAlerts()
      ])
      setVehicles(v)
      setSchedules(s)
      setIssues(i)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load maintenance cockpit')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleCreateSchedule = async () => {
    if (!schedForm.vehicleId || !schedForm.title) return
    setWorking(true)
    try {
      await createMaintenanceSchedule(schedForm)
      await loadData()
      setMessage('Maintenance task scheduled successfully.')
      setSchedForm(prev => ({ ...prev, title: '', notes: '' }))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to schedule task')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return <div className="dd-loading">Syncing service bay records...</div>

  return (
    <div className="dd">
      {message && <div className="dd-toast">{message}</div>}

      <div className="dd-grid dd-grid--maintenance">
        {/* Left: Vehicle List (Health Board) */}
        <aside className="dd-grid__side" style={{ flex: '0 0 350px' }}>
          <div className="dd-block">
            <h4 className="dd-block__title">Fleet Health Board</h4>
            <div className="dd-vehicle-health-list" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {vehicles.map(v => (
                <button 
                  key={v.id} 
                  className={`dd-v-card ${selectedVehicleId === v.id ? 'dd-v-card--sel' : ''}`}
                  onClick={() => {
                    setSelectedVehicleId(v.id)
                    setSchedForm(prev => ({ ...prev, vehicleId: v.id }))
                  }}
                  style={{ 
                    width: '100%', 
                    textAlign: 'left', 
                    padding: '12px', 
                    marginBottom: '10px', 
                    borderRadius: '8px', 
                    border: '1px solid #e5e7eb',
                    background: selectedVehicleId === v.id ? '#f3f4f6' : '#fff',
                    display: 'block'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{v.id}</strong>
                    <span className={`dd-pill ${v.status === 'Maintenance' ? 'dd-pill--rose' : (v.fuelLevel < 40 ? 'dd-pill--amber' : 'dd-pill--green')}`} style={{ fontSize: '0.65rem' }}>
                      {v.status}
                    </span>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#6b7280' }}>
                    Type: {v.type} | Mileage: {v.mileage.toLocaleString()} km
                  </div>
                  <div className="dd-health-bar" style={{ height: '4px', background: '#f3f4f6', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${v.fuelLevel}%`, background: v.fuelLevel < 30 ? '#ef4444' : '#10b981', height: '100%' }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right: Operations & Issues */}
        <main className="dd-grid__main">
          {/* Top: Maintenance Schedule */}
          <section className="dd-card">
            <div className="dd-card__head">
              <h4>Active Service Orders</h4>
              <span className="dd-pill dd-pill--blue">{schedules.filter(s => s.status === 'IN_PROGRESS').length} In Progress</span>
            </div>
            <div className="dd-tbl">
              <div className="dd-tbl__head">
                <span>Vehicle</span>
                <span>Task</span>
                <span>Reason</span>
                <span>Dates</span>
                <span>Status</span>
              </div>
              {schedules.slice(0, 8).map(s => (
                <div key={s.id} className="dd-tbl__row">
                  <span><strong>{s.vehicleId}</strong></span>
                  <span>{s.title}</span>
                  <span><small>{s.reasonCode}</small></span>
                  <span><small>{s.plannedStartDate} → {s.plannedEndDate}</small></span>
                  <span><span className={`dd-pill ${s.status === 'COMPLETED' ? 'dd-pill--green' : (s.status === 'IN_PROGRESS' ? 'dd-pill--blue' : 'dd-pill--amber')}`}>{s.status}</span></span>
                </div>
              ))}
              {schedules.length === 0 && <p className="muted" style={{ padding: '20px', textAlign: 'center' }}>No active service orders found.</p>}
            </div>
          </section>

          {/* New Task + Issue Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
            {/* Create Task Form */}
            <section className="dd-card">
              <div className="dd-card__head"><h4>Schedule Maintenance</h4></div>
              <div className="dd-form" style={{ padding: '20px' }}>
                <label className="dd-form__field" style={{ marginBottom: '12px' }}>
                  <small>Target Vehicle</small>
                  <input type="text" value={schedForm.vehicleId} readOnly placeholder="Select a vehicle from left" style={{ background: '#f9fafb' }} />
                </label>
                <label className="dd-form__field" style={{ marginBottom: '12px' }}>
                  <small>Task Title</small>
                  <input type="text" value={schedForm.title} onChange={e => setSchedForm({...schedForm, title: e.target.value})} placeholder="e.g. Engine Overhaul" />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <label className="dd-form__field">
                    <small>Start Date</small>
                    <input type="date" value={schedForm.plannedStartDate} onChange={e => setSchedForm({...schedForm, plannedStartDate: e.target.value})} />
                  </label>
                  <label className="dd-form__field">
                    <small>End Date</small>
                    <input type="date" value={schedForm.plannedEndDate} onChange={e => setSchedForm({...schedForm, plannedEndDate: e.target.value})} />
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <input type="checkbox" id="blockDispatch" checked={schedForm.blockDispatch} onChange={e => setSchedForm({...schedForm, blockDispatch: e.target.checked})} />
                  <label htmlFor="blockDispatch"><small>Block Dispatch for this vehicle</small></label>
                </div>
                <button className="dd-btn dd-btn--primary" style={{ width: '100%' }} onClick={handleCreateSchedule} disabled={working || !schedForm.vehicleId}>
                  Submit Service Order
                </button>
              </div>
            </section>

            {/* Issue Panel (Maintenance Alerts) */}
            <section className="dd-card">
              <div className="dd-card__head">
                <h4>System Issues & Alerts</h4>
                <span className="dd-pill dd-pill--amber">{issues.length} Alert Items</span>
              </div>
              <div className="dd-issues-list" style={{ padding: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                {issues.map(issue => (
                  <div key={issue.id} style={{ padding: '12px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong>{issue.title}</strong>
                      <span className={`dd-pill ${issue.severity === 'Critical' ? 'dd-pill--rose' : 'dd-pill--amber'}`} style={{ fontSize: '0.6rem' }}>{issue.severity}</span>
                    </div>
                    <p className="muted" style={{ fontSize: '0.75rem' }}>{issue.description}</p>
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <small style={{ color: '#0ea5e9' }}>{issue.vehicleId}</small>
                      <small>Due: {issue.dueDate}</small>
                    </div>
                  </div>
                ))}
                {issues.length === 0 && <p className="muted" style={{ padding: '40px', textAlign: 'center' }}>✅ No pending maintenance alerts.</p>}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
