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
})
