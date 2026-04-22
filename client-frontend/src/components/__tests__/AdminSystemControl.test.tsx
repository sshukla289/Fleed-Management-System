import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminSystemControlPage } from '../../pages/AdminSystemControl'

const fetchSystemConfigEntriesMock = jest.fn()
const updateSystemConfigEntriesMock = jest.fn()
const fetchNotificationBroadcastsMock = jest.fn()
const sendNotificationBroadcastMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchSystemConfigEntries: (...args: unknown[]) => fetchSystemConfigEntriesMock(...args),
  updateSystemConfigEntries: (...args: unknown[]) => updateSystemConfigEntriesMock(...args),
  fetchNotificationBroadcasts: (...args: unknown[]) => fetchNotificationBroadcastsMock(...args),
  sendNotificationBroadcast: (...args: unknown[]) => sendNotificationBroadcastMock(...args),
}))

describe('AdminSystemControlPage', () => {
  beforeEach(() => {
    fetchSystemConfigEntriesMock.mockResolvedValue([
      {
        key: 'speed.limit.kph',
        category: 'Speed',
        label: 'Fleet speed limit',
        description: 'Maximum allowed vehicle speed before an overspeed alert is raised.',
        value: '80',
        updatedAt: '2026-04-22T10:00:00',
        updatedBy: 'system',
      },
      {
        key: 'alerts.low-fuel-threshold-percent',
        category: 'Alerts',
        label: 'Low fuel threshold',
        description: 'Raise a low-fuel notification when telemetry drops below this percentage.',
        value: '10',
        updatedAt: '2026-04-22T10:05:00',
        updatedBy: 'ops.admin@example.com',
      },
    ])

    fetchNotificationBroadcastsMock.mockResolvedValue([
      {
        id: 'BC-1001',
        title: 'Weather advisory',
        message: 'Regional weather watch for north corridor routes.',
        severity: 'HIGH',
        targetRoles: ['DISPATCHER', 'OPERATIONS_MANAGER'],
        recipientCount: 6,
        createdBy: 'ops.admin@example.com',
        createdAt: '2026-04-22T11:00:00',
      },
    ])

    updateSystemConfigEntriesMock.mockResolvedValue([
      {
        key: 'speed.limit.kph',
        category: 'Speed',
        label: 'Fleet speed limit',
        description: 'Maximum allowed vehicle speed before an overspeed alert is raised.',
        value: '85',
        updatedAt: '2026-04-22T12:00:00',
        updatedBy: 'ops.admin@example.com',
      },
      {
        key: 'alerts.low-fuel-threshold-percent',
        category: 'Alerts',
        label: 'Low fuel threshold',
        description: 'Raise a low-fuel notification when telemetry drops below this percentage.',
        value: '10',
        updatedAt: '2026-04-22T10:05:00',
        updatedBy: 'ops.admin@example.com',
      },
    ])

    sendNotificationBroadcastMock.mockResolvedValue({
      id: 'BC-1002',
      title: 'Dispatch advisory',
      message: 'Use the alternate east gate for the next two hours.',
      severity: 'CRITICAL',
      targetRoles: ['DISPATCHER', 'OPERATIONS_MANAGER'],
      recipientCount: 4,
      createdBy: 'ops.admin@example.com',
      createdAt: '2026-04-22T12:15:00',
    })
  })

  it('renders dynamic settings and submits both admin workflows', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AdminSystemControlPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/notifications and system config/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchSystemConfigEntriesMock).toHaveBeenCalledTimes(1)
      expect(fetchNotificationBroadcastsMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByDisplayValue('80'), {
      target: { value: '85' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))

    await waitFor(() => {
      expect(updateSystemConfigEntriesMock).toHaveBeenCalledWith({
        entries: [{ key: 'speed.limit.kph', value: '85' }],
      })
    })

    fireEvent.change(screen.getByLabelText(/broadcast title/i), {
      target: { value: ' Dispatch advisory ' },
    })
    fireEvent.change(screen.getByLabelText(/severity/i), {
      target: { value: 'CRITICAL' },
    })
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: ' Use the alternate east gate for the next two hours. ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send broadcast/i }))

    await waitFor(() => {
      expect(sendNotificationBroadcastMock).toHaveBeenCalledWith({
        title: 'Dispatch advisory',
        message: 'Use the alternate east gate for the next two hours.',
        severity: 'CRITICAL',
        targetRoles: ['OPERATIONS_MANAGER', 'DISPATCHER'],
      })
    })

    expect(screen.getByDisplayValue('85')).toBeInTheDocument()
    expect(screen.getByText(/broadcast sent successfully/i)).toBeInTheDocument()
    expect(screen.getAllByText(/dispatch advisory/i).length).toBeGreaterThan(0)
  })
})
