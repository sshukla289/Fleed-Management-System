import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AdminAnalytics } from '../../pages/AdminAnalytics'

const fetchVehiclesMock = jest.fn()
const fetchTripAnalyticsMock = jest.fn()
const fetchVehicleAnalyticsMock = jest.fn()
const fetchDriverAnalyticsMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchVehicles: () => fetchVehiclesMock(),
  fetchTripAnalytics: (...args: unknown[]) => fetchTripAnalyticsMock(...args),
  fetchVehicleAnalytics: (...args: unknown[]) => fetchVehicleAnalyticsMock(...args),
  fetchDriverAnalytics: (...args: unknown[]) => fetchDriverAnalyticsMock(...args),
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

describe('AdminAnalytics', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    fetchVehiclesMock.mockResolvedValue([
      {
        id: 'VH-101',
        name: 'Atlas Prime',
        type: 'Heavy Truck',
        status: 'Active',
        location: 'Mumbai Hub',
        assignedRegion: 'West India',
        fuelLevel: 70,
        mileage: 120000,
        driverId: 'DR-201',
      },
      {
        id: 'VH-102',
        name: 'Urban Sprint',
        type: 'LCV',
        status: 'Idle',
        location: 'Bengaluru Center',
        assignedRegion: 'South India',
        fuelLevel: 62,
        mileage: 86000,
        driverId: 'DR-204',
      },
    ])

    fetchTripAnalyticsMock.mockResolvedValue({
      generatedAt: '2026-04-22T10:00:00',
      startDate: '2026-03-24T00:00:00',
      endDate: '2026-04-22T23:59:59',
      statusFilter: 'ALL',
      kpis: [],
      onTimeDeliveryRate: 82.5,
      tripSuccessRate: 90.1,
      averageDelayMinutes: 18.2,
      fuelEfficiencyKmPerFuelUnit: 11.4,
      completedTrips: 12,
      cancelledTrips: 1,
      delayedTrips: 3,
      tripVolumeTrend: [
        { label: '15 Apr', totalTrips: 3, completedTrips: 2, delayedTrips: 1 },
      ],
      delayTrends: [
        { label: '0-15 min', count: 2, note: 'Short delays' },
      ],
      alertFrequencyByCategory: [],
      recentTrips: [],
    })

    fetchVehicleAnalyticsMock.mockResolvedValue({
      generatedAt: '2026-04-22T10:00:00',
      startDate: '2026-03-24T00:00:00',
      endDate: '2026-04-22T23:59:59',
      kpis: [],
      averageUtilizationPercent: 61.3,
      utilizationByVehicle: [
        {
          vehicleId: 'VH-101',
          name: 'Atlas Prime',
          status: 'Active',
          location: 'Mumbai Hub',
          mileage: 120000,
          maintenanceDue: false,
          totalTrips: 10,
          completedTrips: 8,
          activeTrips: 2,
          utilizationPercent: 80,
          note: 'Fleet-ready',
        },
      ],
      maintenanceTrends: [],
    })

    fetchDriverAnalyticsMock.mockResolvedValue({
      generatedAt: '2026-04-22T10:00:00',
      startDate: '2026-03-24T00:00:00',
      endDate: '2026-04-22T23:59:59',
      kpis: [],
      averageProductivityPercent: 74.5,
      productivityByDriver: [
        {
          driverId: 'DR-201',
          name: 'Aarav Sharma',
          status: 'On Duty',
          licenseType: 'HMV',
          assignedVehicleId: 'VH-101',
          hoursDrivenToday: 5.2,
          totalTrips: 9,
          completedTrips: 7,
          productivityPercent: 77.8,
          note: 'Completed in selected range',
        },
      ],
      dutyTrend: [],
    })
  })

  it('applies the selected region to analytics requests', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <AdminAnalytics />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText(/admin analytics module/i)).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'West India' })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: /region/i }), { target: { value: 'West India' } })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() => {
      expect(fetchTripAnalyticsMock).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'West India' }))
      expect(fetchVehicleAnalyticsMock).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'West India' }))
      expect(fetchDriverAnalyticsMock).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'West India' }))
    })
  })
})
