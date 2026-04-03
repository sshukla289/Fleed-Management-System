import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  beforeEach(() => {
    fetchDriversMock.mockResolvedValue([
      {
        id: 'DR-201',
        name: 'Aarav Sharma',
        status: 'On Duty',
        licenseType: 'HMV',
        assignedVehicleId: 'VH-101',
        hoursDrivenToday: 5.2,
      },
      {
        id: 'DR-204',
        name: 'Ishita Mehra',
        status: 'On Duty',
        licenseType: 'Transport',
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
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/drivers']}
      >
        <DriverList />
      </MemoryRouter>,
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
})
