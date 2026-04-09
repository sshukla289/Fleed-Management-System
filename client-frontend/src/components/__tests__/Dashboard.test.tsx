import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../../pages/Dashboard'

const fetchDashboardAnalyticsMock = jest.fn()
const fetchDashboardActionQueueMock = jest.fn()
const fetchDashboardExceptionsMock = jest.fn()
const fetchMaintenanceSchedulesMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchDashboardAnalytics: () => fetchDashboardAnalyticsMock(),
  fetchDashboardActionQueue: () => fetchDashboardActionQueueMock(),
  fetchDashboardExceptions: () => fetchDashboardExceptionsMock(),
  fetchMaintenanceSchedules: () => fetchMaintenanceSchedulesMock(),
}))

describe('Dashboard', () => {
  beforeEach(() => {
    fetchDashboardAnalyticsMock.mockResolvedValue({
      generatedAt: '2026-04-09T09:00:00',
      kpis: [
        { key: 'active-trips', label: 'Active trips', value: '1', note: 'Trips currently in motion', tone: 'blue' },
        { key: 'delayed-trips', label: 'Delayed trips', value: '1', note: 'Trips beyond their planned window', tone: 'rose' },
        { key: 'critical-alerts', label: 'Critical alerts', value: '1', note: 'Open items requiring intervention', tone: 'amber' },
        { key: 'available-vehicles', label: 'Available vehicles', value: '2', note: 'Fleet units cleared for dispatch', tone: 'mint' },
        { key: 'blocked-vehicles', label: 'Blocked vehicles', value: '1', note: 'Vehicles under maintenance or hold', tone: 'violet' },
        { key: 'drivers-on-duty', label: 'Drivers on duty', value: '2', note: 'Available crew for active trips', tone: 'teal' },
      ],
      activeTrips: 1,
      delayedTrips: 1,
      criticalAlerts: 1,
      availableVehicles: 2,
      vehiclesInMaintenance: 1,
      driversOnDuty: 2,
      fleetReadinessPercent: 66.7,
      delayedTripsSummary: [
        {
          tripId: 'TRIP-1001',
          routeId: 'RT-501',
          vehicleId: 'VH-101',
          driverId: 'DR-201',
          status: 'IN_PROGRESS',
          minutesLate: 42,
          plannedEndTime: '2026-04-09T08:15:00',
          reason: 'Trip is still active beyond its planned end time.',
        },
      ],
      criticalAlertSummary: [
        {
          id: 'AL-1',
          category: 'MAINTENANCE',
          severity: 'CRITICAL',
          status: 'OPEN',
          title: 'Brake pad replacement',
          relatedTripId: null,
          relatedVehicleId: 'VH-103',
          createdAt: '2026-04-09T07:00:00',
        },
      ],
      blockedVehicles: [
        {
          id: 'VH-103',
          title: 'Northline Carrier',
          subtitle: 'Nagpur Service Bay',
          status: 'Maintenance',
          note: 'Blocked by maintenance schedule',
          actionPath: '/vehicles/VH-103',
        },
      ],
      driversOnDutySnapshot: [
        {
          id: 'DR-201',
          title: 'Aarav Sharma',
          subtitle: 'HMV',
          status: 'On Duty',
          note: 'Vehicle VH-101',
          actionPath: '/drivers',
        },
      ],
    })

    fetchDashboardActionQueueMock.mockResolvedValue([
      {
        id: 'TRIP-1001',
        category: 'TRIP',
        title: 'Monitor trip TRIP-1001',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        note: 'Trip is live and telemetry is available.',
        relatedTripId: 'TRIP-1001',
        relatedVehicleId: 'VH-101',
        actionLabel: 'View trip',
        actionPath: '/trips',
      },
    ])

    fetchDashboardExceptionsMock.mockResolvedValue([
      {
        id: 'AL-1',
        category: 'MAINTENANCE',
        severity: 'CRITICAL',
        title: 'Brake pad replacement',
        message: 'Brake wear threshold exceeded during latest inspection.',
        status: 'OPEN',
        relatedTripId: null,
        relatedVehicleId: 'VH-103',
        updatedAt: '2026-04-09T07:00:00',
      },
    ])

    fetchMaintenanceSchedulesMock.mockResolvedValue([
      {
        id: 'MS-1',
        vehicleId: 'VH-103',
        title: 'Brake inspection bay visit',
        status: 'PLANNED',
        plannedStartDate: '2026-04-09',
        plannedEndDate: '2026-04-10',
        blockDispatch: true,
        reasonCode: 'BRAKE_INSPECTION',
        notes: 'Blocks dispatch until brake system inspection is signed off.',
        createdAt: '2026-04-09T06:00:00',
        updatedAt: '2026-04-09T06:00:00',
      },
    ])
  })

  it('renders the operational control tower and KPI cards', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /fleet control tower/i })).toBeInTheDocument()
    expect(await screen.findByText('Active trips')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /dispatch holds/i })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /drivers on duty/i })).toBeInTheDocument()
  })

  it('renders the action queue, exception list, and maintenance visibility', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/monitor trip trip-1001/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /brake pad replacement/i })).toBeInTheDocument()
    expect(await screen.findByText(/northline carrier/i)).toBeInTheDocument()
    expect(await screen.findByText(/aarav sharma/i)).toBeInTheDocument()
  })
})
