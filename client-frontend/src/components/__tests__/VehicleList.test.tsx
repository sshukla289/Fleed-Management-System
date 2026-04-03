import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VehicleList } from '../../pages/VehicleList'

const fetchVehiclesMock = jest.fn()
const createVehicleMock = jest.fn()
const updateVehicleMock = jest.fn()
const deleteVehicleMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchVehicles: () => fetchVehiclesMock(),
  createVehicle: (...args: unknown[]) => createVehicleMock(...args),
  updateVehicle: (...args: unknown[]) => updateVehicleMock(...args),
  deleteVehicle: (...args: unknown[]) => deleteVehicleMock(...args),
}))

describe('VehicleList', () => {
  beforeEach(() => {
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
        id: 'VH-104',
        name: 'Urban Sprint',
        type: 'Light Commercial',
        status: 'Active',
        location: 'Bengaluru Last-Mile Center',
        fuelLevel: 81,
        mileage: 43180,
        driverId: 'DR-204',
      },
    ])
    createVehicleMock.mockReset()
    updateVehicleMock.mockReset()
    deleteVehicleMock.mockReset()
  })

  it('deletes a vehicle without using the browser confirm dialog', async () => {
    let resolveDelete: (() => void) | undefined
    deleteVehicleMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve
        }),
    )

    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true)

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/vehicles']}
      >
        <VehicleList />
      </MemoryRouter>,
    )

    const urbanSprintHeading = await screen.findByRole('heading', { name: /urban sprint/i })
    const urbanSprintCard = urbanSprintHeading.closest('article')

    expect(urbanSprintCard).not.toBeNull()

    fireEvent.click(within(urbanSprintCard as HTMLElement).getByRole('button', { name: /^delete$/i }))

    expect(deleteVehicleMock).toHaveBeenCalledWith('VH-104')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(within(urbanSprintCard as HTMLElement).getByRole('button', { name: /deleting/i })).toBeDisabled()

    resolveDelete?.()

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /urban sprint/i })).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })
})
