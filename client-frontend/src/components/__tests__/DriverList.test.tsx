import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DriverList } from '../../pages/DriverList'

const fetchDriversMock = jest.fn()
const fetchVehiclesMock = jest.fn()
const createDriverMock = jest.fn()
const updateDriverMock = jest.fn()
const deleteDriverMock = jest.fn()
const assignShiftMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchDrivers: () => fetchDriversMock(),
  fetchVehicles: () => fetchVehiclesMock(),
  createDriver: (...args: unknown[]) => createDriverMock(...args),
  updateDriver: (...args: unknown[]) => updateDriverMock(...args),
  deleteDriver: (...args: unknown[]) => deleteDriverMock(...args),
  assignShift: (...args: unknown[]) => assignShiftMock(...args),
}))

describe('DriverList', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    fetchDriversMock.mockResolvedValue([
      {
        id: 'DR-201',
        name: 'Aarav Sharma',
        status: 'On Duty',
        licenseType: 'HMV',
        licenseNumber: 'MH-14-DR-9087',
        licenseExpiryDate: '2027-08-30',
        assignedShift: 'Morning',
        phone: '+91 98765 43210',
        assignedVehicleId: 'VH-101',
        hoursDrivenToday: 5.2,
      },
      {
        id: 'DR-204',
        name: 'Ishita Mehra',
        status: 'On Duty',
        licenseType: 'Transport',
        licenseNumber: 'KA-03-DR-4412',
        licenseExpiryDate: '2027-05-19',
        assignedShift: 'Night',
        phone: '+91 98765 43213',
        assignedVehicleId: 'VH-104',
        hoursDrivenToday: 6.1,
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
    ])
    createDriverMock.mockReset()
    updateDriverMock.mockReset()
    deleteDriverMock.mockReset()
    assignShiftMock.mockReset()
  })

  it('deletes a driver without using the browser confirm dialog', async () => {
    let resolveDelete: (() => void) | undefined
    deleteDriverMock.mockImplementation(
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
          initialEntries={['/drivers']}
        >
          <DriverList />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const driverHeading = await screen.findByRole('heading', { name: /ishita mehra/i })
    const driverCard = driverHeading.closest('article')

    expect(driverCard).not.toBeNull()

    fireEvent.click(within(driverCard as HTMLElement).getByRole('button', { name: /^delete$/i }))

    expect(deleteDriverMock).toHaveBeenCalledWith('DR-204')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(within(driverCard as HTMLElement).getByRole('button', { name: /deleting/i })).toBeDisabled()

    resolveDelete?.()

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /ishita mehra/i })).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })

  it('formats hours driven today using the same route-style numeric behavior', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={['/drivers']}
        >
          <DriverList />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /add driver/i }))

    const hoursDrivenInput = screen.getByLabelText(/hours driven today/i)

    expect(hoursDrivenInput).toHaveDisplayValue('0')

    fireEvent.change(hoursDrivenInput, { target: { value: '09.999' } })
    expect(hoursDrivenInput).toHaveDisplayValue('09.99')

    fireEvent.change(hoursDrivenInput, { target: { value: '010' } })
    expect(hoursDrivenInput).toHaveDisplayValue('10')
  })

  it('preserves optional driver metadata while allowing manual unassign on edit', async () => {
    updateDriverMock.mockResolvedValue({
      id: 'DR-204',
      name: 'Ishita Mehra',
      status: 'On Duty',
      licenseType: 'Transport',
      licenseNumber: 'KA-03-DR-4412',
      licenseExpiryDate: '2027-05-19',
      assignedShift: 'Night',
      phone: '+91 98765 43213',
      assignedVehicleId: '',
      hoursDrivenToday: 6.1,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={['/drivers']}
        >
          <DriverList />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const driverHeading = await screen.findByRole('heading', { name: /ishita mehra/i })
    const driverCard = driverHeading.closest('article')

    expect(driverCard).not.toBeNull()

    fireEvent.click(within(driverCard as HTMLElement).getByRole('button', { name: /edit/i }))

    expect(screen.getByLabelText(/license number/i)).toHaveValue('KA-03-DR-4412')
    expect(screen.getByLabelText(/license expiry/i)).toHaveValue('2027-05-19')
    expect(screen.getByLabelText(/assigned shift/i)).toHaveValue('Night')
    expect(screen.getByLabelText(/phone/i)).toHaveValue('+91 98765 43213')

    fireEvent.change(screen.getByLabelText(/assigned vehicle/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(updateDriverMock).toHaveBeenCalledWith('DR-204', {
        name: 'Ishita Mehra',
        status: 'On Duty',
        licenseType: 'Transport',
        licenseNumber: 'KA-03-DR-4412',
        licenseExpiryDate: '2027-05-19',
        assignedShift: 'Night',
        phone: '+91 98765 43213',
        assignedVehicleId: '',
        hoursDrivenToday: 6.1,
      })
    })
  })

  it('allows unassigning a vehicle from the shift form', async () => {
    assignShiftMock.mockResolvedValue({
      id: 'DR-201',
      name: 'Aarav Sharma',
      status: 'On Duty',
      licenseType: 'HMV',
      licenseNumber: 'MH-14-DR-9087',
      licenseExpiryDate: '2027-08-30',
      assignedShift: 'Morning',
      phone: '+91 98765 43210',
      assignedVehicleId: '',
      hoursDrivenToday: 5.2,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          initialEntries={['/drivers']}
        >
          <DriverList />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /assign shift/i }))

    fireEvent.change(screen.getByLabelText(/^vehicle$/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /update shift/i }))

    await waitFor(() => {
      expect(assignShiftMock).toHaveBeenCalledWith({
        driverId: 'DR-201',
        assignedVehicleId: '',
        status: 'On Duty',
        assignedShift: 'Morning',
      })
    })
  })
})
