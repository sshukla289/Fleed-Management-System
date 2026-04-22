import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import { resolveApiAssetUrl } from '../../services/apiService'
import type { ProofOfDelivery, TripOtpSummary } from '../../types'
import type { ExecutionTrip } from '../../types/tripExecution'

interface ProofOfDeliveryPanelProps {
  trip: ExecutionTrip
  pod: ProofOfDelivery | null | undefined
  otp: TripOtpSummary | null | undefined
  isDriver: boolean
  submitting: boolean
  submitError?: string | null
  onSubmit: (payload: { signatureDataUrl: string; photo: File }) => void
  onOpenOtpModal: () => void
}

function formatEvidenceTime(value?: string | null) {
  if (!value) {
    return 'Not captured yet'
  }

  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProofOfDeliveryPanel({
  trip,
  pod,
  otp,
  isDriver,
  submitting,
  submitError,
  onSubmit,
  onOpenOtpModal,
}: ProofOfDeliveryPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const photoPreviewUrlRef = useRef<string | null>(null)
  const drawingRef = useRef(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [hasSignature, setHasSignature] = useState(() => Boolean(pod?.signatureCaptured))
  const [clientError, setClientError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 2.5
    context.strokeStyle = '#0f172a'
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreviewUrlRef.current) {
        URL.revokeObjectURL(photoPreviewUrlRef.current)
      }
    }
  }, [])

  const isCaptureLocked = trip.status !== 'IN_PROGRESS' && trip.status !== 'PAUSED'
  const otpVerified = Boolean(otp?.verified)
  const canEditEvidence = isDriver && !isCaptureLocked

  function getCanvasCoordinates(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }

    const bounds = canvas.getBoundingClientRect()
    const scaleX = canvas.width / bounds.width
    const scaleY = canvas.height / bounds.height
    return {
      x: (event.clientX - bounds.left) * scaleX,
      y: (event.clientY - bounds.top) * scaleY,
    }
  }

  function beginStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canEditEvidence) {
      return
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }

    const { x, y } = getCanvasCoordinates(event)
    drawingRef.current = true
    pointerIdRef.current = event.pointerId
    canvas.setPointerCapture(event.pointerId)
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + 0.01, y + 0.01)
    context.stroke()
    setHasSignature(true)
    setClientError(null)
  }

  function continueStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || pointerIdRef.current !== event.pointerId) {
      return
    }

    const context = canvasRef.current?.getContext('2d')
    if (!context) {
      return
    }

    const { x, y } = getCanvasCoordinates(event)
    context.lineTo(x, y)
    context.stroke()
  }

  function endStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    drawingRef.current = false
    pointerIdRef.current = null
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId)
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  function handlePhotoChange(file: File | null) {
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current)
      photoPreviewUrlRef.current = null
    }

    if (!file) {
      setPhoto(null)
      setPhotoPreviewUrl(null)
      return
    }

    setPhoto(file)
    photoPreviewUrlRef.current = URL.createObjectURL(file)
    setPhotoPreviewUrl(photoPreviewUrlRef.current)
    setClientError(null)
  }

  function handleSubmit() {
    if (!isDriver) {
      return
    }

    if (isCaptureLocked) {
      setClientError('Proof of delivery becomes available once the trip is underway.')
      return
    }

    if (!otpVerified) {
      setClientError('Verify the delivery OTP before submitting proof of delivery.')
      return
    }

    if (!hasSignature || !canvasRef.current) {
      setClientError('Capture the recipient signature before submitting proof.')
      return
    }

    if (!photo) {
      setClientError('Attach a delivery photo before submitting proof.')
      return
    }

    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(photo.type)) {
      setClientError('Delivery photo must be a PNG, JPEG, or WebP image.')
      return
    }

    if (photo.size > 5 * 1024 * 1024) {
      setClientError('Delivery photo must be 5 MB or smaller.')
      return
    }

    onSubmit({
      signatureDataUrl: canvasRef.current.toDataURL('image/png'),
      photo,
    })
  }

  return (
    <motion.section layout className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Proof of delivery</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Legally reliable delivery evidence</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Signature capture, OTP verification, and delivery photography are stored as a single proof package with server timestamps and evidence digests.
          </p>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
          pod?.readyForCompletion ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {pod?.readyForCompletion ? 'Proof verified' : 'Proof pending'}
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">OTP</p>
          <p className="mt-2 font-medium text-slate-900">{otp?.verified ? 'Verified' : otp?.status ?? 'Pending'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {otp?.verifiedAt ? `Verified ${formatEvidenceTime(otp.verifiedAt)}` : otp?.expiresAt ? `Expires ${formatEvidenceTime(otp.expiresAt)}` : 'Issued on trip start'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Signature</p>
          <p className="mt-2 font-medium text-slate-900">{pod?.signatureCaptured ? 'Captured' : 'Awaiting signature'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Evidence timestamp</p>
          <p className="mt-2 font-medium text-slate-900">{formatEvidenceTime(pod?.timestamp)}</p>
        </div>
      </div>

      {(submitError || clientError) && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError ?? clientError}
        </div>
      )}

      {!isDriver && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Read-only POD access is enabled for this role. Sensitive signature and photo assets stay redacted.
        </div>
      )}

      {isDriver && isCaptureLocked && (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Start the trip to issue a delivery OTP and unlock POD capture.
        </div>
      )}

      {isDriver && !isCaptureLocked && !otpVerified && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Verify the recipient OTP before submitting the delivery proof package.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenOtpModal}
          disabled={!isDriver || isCaptureLocked}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {otpVerified ? 'Review OTP status' : 'Verify OTP'}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Recipient signature</p>
              {isDriver && (
                <button
                  type="button"
                  onClick={clearSignature}
                  disabled={submitting || !canEditEvidence}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-[24px] border border-dashed border-slate-300 bg-white">
              <canvas
                ref={canvasRef}
                width={680}
                height={220}
                onPointerDown={beginStroke}
                onPointerMove={continueStroke}
                onPointerUp={endStroke}
                onPointerLeave={endStroke}
                onPointerCancel={endStroke}
                className={`h-[220px] w-full touch-none ${canEditEvidence ? 'cursor-crosshair' : 'cursor-not-allowed opacity-70'}`}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">Ask the recipient to sign exactly as they would on a physical delivery receipt.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <label htmlFor={`pod-photo-${trip.id}`} className="text-sm font-semibold text-slate-800">
              Delivery photo
            </label>
            <p className="mt-1 text-xs text-slate-500">Use the device camera when possible. Accepted formats: PNG, JPEG, WebP.</p>
            {isDriver && (
              <input
                id={`pod-photo-${trip.id}`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                capture="environment"
                disabled={submitting || !canEditEvidence}
                onChange={(event) => handlePhotoChange(event.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-semibold file:text-white"
              />
            )}

            <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
              {photoPreviewUrl ? (
                <img src={photoPreviewUrl} alt="Delivery preview" className="h-52 w-full object-cover" />
              ) : pod?.photoUrl ? (
                <img src={resolveApiAssetUrl(pod.photoUrl)} alt="Submitted delivery proof" className="h-52 w-full object-cover" />
              ) : (
                <div className="flex h-52 items-center justify-center px-6 text-center text-sm text-slate-500">
                  {isDriver
                    ? 'Capture a photo showing the package, doorstep, or recipient handoff.'
                    : 'Photo evidence remains redacted for this role.'}
                </div>
              )}
            </div>
          </div>

          {isDriver && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canEditEvidence || !otpVerified}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-base font-semibold text-white shadow-md transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting proof...' : pod?.readyForCompletion ? 'Replace proof package' : 'Submit proof package'}
            </button>
          )}

          {!pod?.redacted && pod?.signatureUrl && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Stored evidence</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <img
                  src={resolveApiAssetUrl(pod.signatureUrl)}
                  alt="Recipient signature"
                  className="h-32 w-full rounded-2xl border border-slate-200 bg-white object-contain p-2"
                />
                {pod.photoUrl && (
                  <img
                    src={resolveApiAssetUrl(pod.photoUrl)}
                    alt="Delivery record"
                    className="h-32 w-full rounded-2xl border border-slate-200 object-cover"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  )
}
