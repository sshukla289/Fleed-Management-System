import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuditLogs } from '../../pages/AuditLogs'

const fetchAuditLogsMock = jest.fn()
const fetchAuditLogsByEntityMock = jest.fn()

jest.mock('../../services/apiService', () => ({
  fetchAuditLogs: (...args: unknown[]) => fetchAuditLogsMock(...args),
  fetchAuditLogsByEntity: (...args: unknown[]) => fetchAuditLogsByEntityMock(...args),
}))

describe('AuditLogs', () => {
  beforeEach(() => {
    fetchAuditLogsMock.mockResolvedValue([
      {
        id: 'AU-ABC123',
        actor: 'ops.manager@example.com',
        action: 'TRIP_DISPATCHED',
        entityType: 'TRIP',
        entityId: 'TRIP-1001',
        summary: 'Trip dispatched.',
        detailsJson: '{"vehicleId":"VH-101"}',
        createdAt: '2026-04-22T10:00:00',
      },
    ])
    fetchAuditLogsByEntityMock.mockResolvedValue([])
  })

  it('renders an immutable audit table with the required columns', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AuditLogs />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/immutable audit logs/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchAuditLogsMock).toHaveBeenCalled()
    })

    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText('Entity')).toBeInTheDocument()
    expect(screen.getByText('Timestamp')).toBeInTheDocument()
    expect(screen.getByText('ops.manager@example.com')).toBeInTheDocument()
    expect(screen.getByText('TRIP / TRIP-1001')).toBeInTheDocument()
    expect(screen.getByText(/append only/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })
})
