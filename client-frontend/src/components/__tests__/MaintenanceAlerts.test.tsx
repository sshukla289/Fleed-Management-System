import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { MaintenanceAlerts } from '../../pages/MaintenanceAlerts'

const fetchMaintenanceAlertsMock = jest.fn()
const fetchVehiclesMock = jest.fn()
const createMaintenanceAlertMock = jest.fn()
const updateMaintenanceAlertMock = jest.fn()
const deleteMaintenanceAlertMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchMaintenanceAlerts: () => fetchMaintenanceAlertsMock(),
  fetchVehicles: () => fetchVehiclesMock(),
  createMaintenanceAlert: (...args: unknown[]) => createMaintenanceAlertMock(...args),
  updateMaintenanceAlert: (...args: unknown[]) => updateMaintenanceAlertMock(...args),
  deleteMaintenanceAlert: (...args: unknown[]) => deleteMaintenanceAlertMock(...args),
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

describe('MaintenanceAlerts', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    fetchMaintenanceAlertsMock.mockResolvedValue([
      {
        id: 'MA-1',
        vehicleId: 'VH-103',
        title: 'Brake pad replacement',
        severity: 'Critical',
        dueDate: '2026-04-04',
        description: 'Brake wear threshold exceeded during latest inspection.',
      },
      {
        id: 'MA-2',
        vehicleId: 'VH-101',
        title: 'Oil pressure inspection',
        severity: 'Medium',
        dueDate: '2026-04-06',
        description: 'Oil pressure trend dipped below preferred baseline.',
      },
    ])
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
        id: 'VH-103',
        name: 'Northline Carrier',
        type: 'Flatbed',
        status: 'Maintenance',
        location: 'Nagpur Service Bay',
        fuelLevel: 31,
        mileage: 165210,
        driverId: 'DR-203',
      },
    ])
    createMaintenanceAlertMock.mockReset()
    updateMaintenanceAlertMock.mockReset()
    deleteMaintenanceAlertMock.mockReset()
  })

  it('deletes an alert without using the browser confirm dialog', async () => {
    let resolveDelete: (() => void) | undefined
    deleteMaintenanceAlertMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve
        }),
    )

    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true)

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={['/maintenance']}
        >
          <MaintenanceAlerts />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const alertHeading = await screen.findByRole('heading', { name: /oil pressure inspection/i })
    const alertCard = alertHeading.closest('article')

    expect(alertCard).not.toBeNull()

    fireEvent.click(within(alertCard as HTMLElement).getByRole('button', { name: /^delete$/i }))

    expect(deleteMaintenanceAlertMock).toHaveBeenCalledWith('MA-2')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(within(alertCard as HTMLElement).getByRole('button', { name: /deleting/i })).toBeDisabled()

    resolveDelete?.()

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /oil pressure inspection/i })).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })
})
