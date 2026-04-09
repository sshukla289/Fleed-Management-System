import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('deletes a vehicle from the tracking detail panel without using the browser confirm dialog', async () => {
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

    const urbanSprintCard = await screen.findByText(/urban sprint/i)
    const urbanSprintButton = urbanSprintCard.closest('[role="button"]')

    expect(urbanSprintButton).not.toBeNull()

    fireEvent.click(urbanSprintButton as HTMLElement)

    const detailDeleteButton = await screen.findByRole('button', { name: /^delete$/i })
    fireEvent.click(detailDeleteButton)

    expect(deleteVehicleMock).toHaveBeenCalledWith('VH-104')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(detailDeleteButton).toBeDisabled()

    resolveDelete?.()

    await waitFor(() => {
      expect(screen.queryByText(/urban sprint/i)).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })

  it('formats fuel level as a percentage input and applies route-style number behavior', async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/vehicles']}
      >
        <VehicleList />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /create vehicle/i }))

    const fuelLevelInput = screen.getByLabelText(/fuel level \(%\)/i)
    const mileageInput = screen.getByLabelText(/mileage/i)

    expect(fuelLevelInput).toHaveDisplayValue('50')
    expect(mileageInput).toHaveDisplayValue('0')

    fireEvent.change(fuelLevelInput, { target: { value: '09.999' } })
    expect(fuelLevelInput).toHaveDisplayValue('09.99')

    fireEvent.change(fuelLevelInput, { target: { value: '010' } })
    expect(fuelLevelInput).toHaveDisplayValue('10')

    fireEvent.change(fuelLevelInput, { target: { value: '150' } })
    expect(fuelLevelInput).toHaveDisplayValue('100')

    fireEvent.change(mileageInput, { target: { value: '09.999' } })
    expect(mileageInput).toHaveDisplayValue('09.99')

    fireEvent.change(mileageInput, { target: { value: '010' } })
    expect(mileageInput).toHaveDisplayValue('10')
  })

  it('renders the tracking layout with the selected vehicle board', async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/vehicles']}
      >
        <VehicleList />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /tracking/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /atlas prime/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/current truck capacity/i)).toBeInTheDocument()
    expect(screen.getByText(/cargo photo reports/i)).toBeInTheDocument()
  })
})
