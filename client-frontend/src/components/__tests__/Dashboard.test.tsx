import { fireEvent, render, screen } from '@testing-library/react'
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

  it('allows latitude and longitude fields to stay blank while editing', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /speed profile/i })

    const latitudeInput = await screen.findByLabelText(/latitude/i)
    const longitudeInput = screen.getByLabelText(/longitude/i)

    fireEvent.change(latitudeInput, { target: { value: '' } })
    fireEvent.change(longitudeInput, { target: { value: '' } })

    expect(latitudeInput).toHaveDisplayValue('')
    expect(longitudeInput).toHaveDisplayValue('')
  })

  it('formats speed and fuel level like the route-style numeric inputs', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /speed profile/i })

    const speedInput = screen.getByLabelText(/speed \(km\/h\)/i)
    const fuelLevelInput = screen.getByLabelText(/fuel level \(%\)/i)

    fireEvent.change(speedInput, { target: { value: '09.999' } })
    expect(speedInput).toHaveDisplayValue('09.99')

    fireEvent.change(speedInput, { target: { value: '010' } })
    expect(speedInput).toHaveDisplayValue('10')

    fireEvent.change(fuelLevelInput, { target: { value: '09.999' } })
    expect(fuelLevelInput).toHaveDisplayValue('09.99')

    fireEvent.change(fuelLevelInput, { target: { value: '010' } })
    expect(fuelLevelInput).toHaveDisplayValue('10')

    fireEvent.change(fuelLevelInput, { target: { value: '150' } })
    expect(fuelLevelInput).toHaveDisplayValue('100')
  })

  it('renders the drivers and routes sub dashboards', async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /^drivers$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^routes$/i })).toBeInTheDocument()
    expect(screen.getByText('DR-201')).toBeInTheDocument()
    expect(screen.getByText('RT-501')).toBeInTheDocument()
  })
})
