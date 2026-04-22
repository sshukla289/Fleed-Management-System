import { fireEvent, render, screen } from '@testing-library/react'
import { ProofOfDeliveryPanel } from '../TripExecution/ProofOfDeliveryPanel'
import type { ExecutionTrip } from '../../types/tripExecution'

const baseTrip: ExecutionTrip = {
  id: 'TRIP-1001',
  status: 'IN_PROGRESS',
  vehicleNumber: 'VH-101',
  driverName: 'DR-201',
  eta: new Date().toISOString(),
  distanceRemaining: 10,
  totalDistance: 100,
  source: 'Mumbai Hub',
  destination: 'Pune Depot',
  stops: [],
  otp: {
    id: 'OTP-1',
    tripId: 'TRIP-1001',
    status: 'SENT',
    issuedAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    verifiedAt: null,
    resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
    nextRetryAt: null,
    cooldownSecondsRemaining: 30,
    requestsInLastHour: 1,
    requestLimitPerHour: 3,
    canResend: false,
    verified: false,
    failureReason: null,
  },
  pod: null,
}

describe('ProofOfDeliveryPanel', () => {
  test('shows read-only summary for non-driver roles', () => {
    render(
      <ProofOfDeliveryPanel
        trip={baseTrip}
        pod={{
          id: 'POD-1',
          tripId: 'TRIP-1001',
          signatureUrl: null,
          photoUrl: null,
          otpVerified: true,
          timestamp: new Date().toISOString(),
          signatureCaptured: true,
          photoCaptured: true,
          readyForCompletion: true,
          redacted: true,
        }}
        otp={baseTrip.otp}
        isDriver={false}
        submitting={false}
        onSubmit={() => undefined}
        onOpenOtpModal={() => undefined}
      />,
    )

    expect(screen.getByText(/Read-only POD access is enabled/i)).toBeInTheDocument()
    expect(screen.queryByText(/Submit proof package/i)).not.toBeInTheDocument()
  })

  test('opens OTP review flow from the verification button', () => {
    const handleOpenOtpModal = jest.fn()

    render(
      <ProofOfDeliveryPanel
        trip={baseTrip}
        pod={null}
        otp={baseTrip.otp}
        isDriver
        submitting={false}
        onSubmit={() => undefined}
        onOpenOtpModal={handleOpenOtpModal}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Verify OTP/i }))

    expect(handleOpenOtpModal).toHaveBeenCalledTimes(1)
  })
})
