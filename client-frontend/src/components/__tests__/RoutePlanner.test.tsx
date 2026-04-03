import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RoutePlanner } from '../../pages/RoutePlanner'

const fetchRoutePlansMock = jest.fn()
const optimizeRoutesMock = jest.fn()
const createRoutePlanMock = jest.fn()
const updateRoutePlanMock = jest.fn()
const deleteRoutePlanMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchRoutePlans: () => fetchRoutePlansMock(),
  optimizeRoutes: (...args: unknown[]) => optimizeRoutesMock(...args),
  createRoutePlan: (...args: unknown[]) => createRoutePlanMock(...args),
  updateRoutePlan: (...args: unknown[]) => updateRoutePlanMock(...args),
  deleteRoutePlan: (...args: unknown[]) => deleteRoutePlanMock(...args),
}))

describe('RoutePlanner', () => {
  beforeEach(() => {
    fetchRoutePlansMock.mockResolvedValue([
      {
        id: 'RT-501',
        name: 'Western Corridor Morning Run',
        status: 'In Progress',
        distanceKm: 342,
        estimatedDuration: '6h 15m',
        stops: ['Mumbai Hub', 'Lonavala', 'Pune Depot'],
      },
      {
        id: 'RT-503',
        name: 'Southern Last-Mile Sweep',
        status: 'Completed',
        distanceKm: 96,
        estimatedDuration: '2h 10m',
        stops: ['Bengaluru Center', 'Whitefield'],
      },
    ])
    optimizeRoutesMock.mockReset()
    createRoutePlanMock.mockReset()
    updateRoutePlanMock.mockReset()
    deleteRoutePlanMock.mockReset()
  })

  it('deletes a route without using the browser confirm dialog', async () => {
    let resolveDelete: (() => void) | undefined
    deleteRoutePlanMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve
        }),
    )

    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true)

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/routes']}
      >
        <RoutePlanner />
      </MemoryRouter>,
    )

    const routeHeading = await screen.findByRole('heading', { name: /southern last-mile sweep/i })
    const routeCard = routeHeading.closest('article')

    expect(routeCard).not.toBeNull()

    fireEvent.click(within(routeCard as HTMLElement).getByRole('button', { name: /^delete$/i }))

    expect(deleteRoutePlanMock).toHaveBeenCalledWith('RT-503')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(within(routeCard as HTMLElement).getByRole('button', { name: /deleting/i })).toBeDisabled()

    resolveDelete?.()

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /southern last-mile sweep/i })).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })

  it('keeps a leading zero for single digits and removes it at ten', async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/routes']}
      >
        <RoutePlanner />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /add route/i }))

    const distanceInput = screen.getByLabelText(/distance \(km\)/i)

    expect(distanceInput).toHaveDisplayValue('0')

    fireEvent.change(distanceInput, { target: { value: '09' } })
    expect(distanceInput).toHaveDisplayValue('09')

    fireEvent.change(distanceInput, { target: { value: '010' } })
    expect(distanceInput).toHaveDisplayValue('10')
  })

  it('limits the distance input to two decimal places', async () => {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/routes']}
      >
        <RoutePlanner />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /add route/i }))

    const distanceInput = screen.getByLabelText(/distance \(km\)/i)

    fireEvent.change(distanceInput, { target: { value: '09.999' } })
    expect(distanceInput).toHaveDisplayValue('09.99')
  })

  it('applies route optimization results to the planner', async () => {
    optimizeRoutesMock.mockResolvedValue([
      {
        id: 'RT-501',
        name: 'Western Corridor Morning Run',
        status: 'In Progress',
        distanceKm: 315,
        estimatedDuration: '5h 41m',
        stops: ['Mumbai Hub', 'Lonavala', 'Pune Depot', 'Satara Crossdock'],
      },
      {
        id: 'RT-503',
        name: 'Southern Last-Mile Sweep',
        status: 'Completed',
        distanceKm: 88,
        estimatedDuration: '1h 45m',
        stops: ['Bengaluru Center', 'Indiranagar', 'Whitefield'],
      },
    ])

    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={['/routes']}
      >
        <RoutePlanner />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /optimize route/i }))

    expect(optimizeRoutesMock).toHaveBeenCalled()
    expect(
      await screen.findByText(/route optimization applied to 2 plans/i),
    ).toBeInTheDocument()
    expect(screen.getByText('315 km')).toBeInTheDocument()
    expect(screen.getByText('5h 41m')).toBeInTheDocument()
  })
})
