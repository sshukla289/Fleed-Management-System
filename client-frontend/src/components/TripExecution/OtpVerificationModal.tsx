import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { TripOtpSummary } from '../../types'

interface OtpVerificationModalProps {
  tripId: string
  open: boolean
  otp: TripOtpSummary | null | undefined
  verifying: boolean
  resending: boolean
  error?: string | null
  onClose: () => void
  onVerify: (otp: string) => void
  onResend: () => void
}

function formatCountdown(totalSeconds: number) {
  const clamped = Math.max(0, totalSeconds)
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function computeRemainingSeconds(value?: string | null) {
  if (!value) {
    return 0
  }

  const target = new Date(value).getTime()
  if (!Number.isFinite(target)) {
    return 0
  }

  return Math.max(0, Math.ceil((target - Date.now()) / 1000))
}

export function OtpVerificationModal({
  tripId,
  open,
  otp,
  verifying,
  resending,
  error,
  onClose,
  onVerify,
  onResend,
}: OtpVerificationModalProps) {
  const [code, setCode] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const interval = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(interval)
  }, [open])

  const expirySecondsRemaining = useMemo(() => {
    void tick
    return computeRemainingSeconds(otp?.expiresAt)
  }, [otp?.expiresAt, tick])

  const resendSecondsRemaining = useMemo(() => {
    void tick
    return Math.max(0, otp?.cooldownSecondsRemaining ?? computeRemainingSeconds(otp?.resendAvailableAt))
  }, [otp?.cooldownSecondsRemaining, otp?.resendAvailableAt, tick])

  if (!open) {
    return null
  }

  const otpExpired = Boolean(otp?.expiresAt) && expirySecondsRemaining <= 0 && !otp?.verified
  const canResend = Boolean(otp?.canResend) && resendSecondsRemaining <= 0 && !resending

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Delivery OTP</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Verify trip {tripId}</h2>
              <p className="mt-2 text-sm text-slate-600">
                Confirm the recipient OTP before capturing the final proof of delivery package.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>Status</span>
              <span className={`font-semibold ${
                otp?.verified
                  ? 'text-emerald-700'
                  : otp?.status === 'FAILED'
                    ? 'text-amber-700'
                    : otpExpired || otp?.status === 'EXPIRED'
                      ? 'text-red-700'
                      : 'text-slate-900'
              }`}>
                {otp?.verified ? 'Verified' : otp?.status ?? 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Expires in</span>
              <span className={`font-semibold ${otpExpired ? 'text-red-700' : 'text-slate-900'}`}>
                {otp?.verified ? 'Completed' : otp?.expiresAt ? formatCountdown(expirySecondsRemaining) : 'Awaiting issue'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Resend window</span>
              <span className="font-semibold text-slate-900">
                {canResend ? 'Ready now' : formatCountdown(resendSecondsRemaining)}
              </span>
            </div>
            {otp?.failureReason && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                {otp.failureReason}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">Enter 6-digit OTP</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={verifying || otp?.verified || otpExpired}
              placeholder="000000"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-2xl tracking-[0.4em] text-slate-900 outline-none transition focus:border-blue-400"
            />
          </label>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => onVerify(code)}
              disabled={verifying || otp?.verified || otpExpired || code.length !== 6}
              className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? 'Verifying...' : otp?.verified ? 'Verified' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={onResend}
              disabled={!canResend || otp?.verified}
              className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resending ? 'Resending...' : 'Resend OTP'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
