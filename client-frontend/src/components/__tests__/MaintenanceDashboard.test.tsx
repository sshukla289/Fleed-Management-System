import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { MaintenanceDashboard } from '../../pages/MaintenanceDashboard'

const fetchVehiclesMock = jest.fn()
const fetchMaintenanceSchedulesMock = jest.fn()
const fetchMaintenanceAlertsMock = jest.fn()
const createMaintenanceScheduleMock = jest.fn()
const updateMaintenanceScheduleStatusMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchVehicles: () => fetchVehiclesMock(),
  fetchMaintenanceSchedules: () => fetchMaintenanceSchedulesMock(),
  fetchMaintenanceAlerts: () => fetchMaintenanceAlertsMock(),
  createMaintenanceSchedule: (...args: unknown[]) => createMaintenanceScheduleMock(...args),
  updateMaintenanceScheduleStatus: (...args: unknown[]) => updateMaintenanceScheduleStatusMock(...args),
}))

jest.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    session: {
      token: 'test-token',
      profile: {
        id: 'user-admin',
        name: 'Admin User',
        role: 'ADMIN',
        email: 'admin@example.com',
        assignedRegion: 'HQ',
      },
    },
  }),
}))

describe('MaintenanceDashboard', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    fetchVehiclesMock.mockResolvedValue([
      {
        id: 'VH-101',
        name: 'Atlas Prime',
        type: 'Heavy Truck',
        status: 'Active',
        location: 'Mumbai Hub',
        fuelLevel: 72,
        mileage: 128540,
        driverId: 'DR-201',
      },
      {
        id: 'VH-102',
        name: 'Coastal Runner',
        type: 'Reefer Van',
        status: 'Idle',
        location: 'Pune Depot',
        fuelLevel: 54,
        mileage: 87920,
        driverId: 'DR-202',
      },
    ])
    fetchMaintenanceSchedulesMock.mockResolvedValue([])
    fetchMaintenanceAlertsMock.mockResolvedValue([
      {
        id: 'MA-1',
        vehicleId: 'VH-101',
        title: 'Brake pad replacement',
        severity: 'Critical',
        dueDate: '2026-04-24',
        description: 'Brake wear threshold exceeded during latest inspection.',
      },
    ])
    createMaintenanceScheduleMock.mockResolvedValue({
      id: 'MS-99',
      vehicleId: 'VH-101',
      title: 'Brake pad replacement',
      status: 'IN_PROGRESS',
      plannedStartDate: '2026-04-22',
      plannedEndDate: '2026-04-23',
      blockDispatch: true,
      reasonCode: 'ALERT_RESPONSE',
      notes: 'Brake wear threshold exceeded during latest inspection.',
      createdAt: '2026-04-22T10:00:00',
      updatedAt: '2026-04-22T10:00:00',
    })
    updateMaintenanceScheduleStatusMock.mockReset()
  })

  it('blocks the selected vehicle from the quick action using alert context', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={['/maintenance?vehicleId=VH-101']}
        >
          <MaintenanceDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const quickActionButton = await screen.findByRole('button', { name: /block vehicle now/i })
    fireEvent.click(quickActionButton)

    await waitFor(() => {
      expect(createMaintenanceScheduleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicleId: 'VH-101',
          title: 'Brake pad replacement',
          status: 'IN_PROGRESS',
          blockDispatch: true,
          reasonCode: 'ALERT_RESPONSE',
          notes: 'Brake wear threshold exceeded during latest inspection.',
        }),
      )
    })
  })
})
