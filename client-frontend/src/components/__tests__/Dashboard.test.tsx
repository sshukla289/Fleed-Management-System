import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '../../pages/Dashboard'

describe('Dashboard', () => {
  it('renders the fleet dashboard heading', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /fleet dashboard/i })).toBeInTheDocument()
    expect((await screen.findAllByText(/atlas prime/i)).length).toBeGreaterThan(0)
  })
})
