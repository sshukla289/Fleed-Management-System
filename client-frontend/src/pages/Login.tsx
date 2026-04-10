import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../context/useAuth'

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login({ email, password })
      navigate('/', { replace: true })
    } catch {
      setError('Invalid credentials. Please verify your email and password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__copy">
          <PageHeader
            eyebrow="Secure access"
            title="Sign in to the fleet management portal"
            description="Authenticate with a provisioned operations account to access the live fleet workspace."
          />
          <div className="pill-list">
            <span className="pill">Role-based dashboard access</span>
            <span className="pill">Route and telemetry visibility</span>
            <span className="pill">Driver and asset coordination</span>
          </div>
        </div>
        <form className="login-card__form" onSubmit={handleSubmit}>
          <div>
            <h2>Welcome back</h2>
            <p>Use your assigned account to enter the fleet workspace.</p>
          </div>
          <label className="input-group">
            <span>Email</span>
            <input onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
          </label>
          <label className="input-group">
            <span>Password</span>
            <input
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          {import.meta.env.DEV ? (
            <div className="login-hint">
              Dev seeded account: <strong>manager@fleetcontrol.dev</strong> / <strong>password123</strong>
            </div>
          ) : null}
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
