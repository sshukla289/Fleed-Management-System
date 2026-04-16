import { useEffect, useState, type FormEvent } from 'react'
import { DriverCard } from '../components/DriverCard'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../context/useAuth'
import { canAccessDrivers } from '../security/permissions'
import { changePassword, fetchDrivers, fetchProfile, updateProfile } from '../services/apiService'
import type { ChangePasswordInput, Driver, UpdateProfileInput, UserProfile } from '../types'

const initialPasswordForm: ChangePasswordInput = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

export function Profile() {
  const { updateSessionProfile } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [form, setForm] = useState<UpdateProfileInput>({
    name: '',
    email: '',
    assignedRegion: '',
  })
  const [passwordForm, setPasswordForm] = useState<ChangePasswordInput>(initialPasswordForm)

  useEffect(() => {
    async function loadProfile() {
      const profileData = await fetchProfile()

      setProfile(profileData)
      if (canAccessDrivers(profileData.role)) {
        try {
          const driverData = await fetchDrivers()
          setDrivers(driverData.slice(0, 1))
        } catch {
          setDrivers([])
        }
      } else {
        setDrivers([])
      }
      setForm({
        name: profileData.name,
        email: profileData.email,
        assignedRegion: profileData.assignedRegion,
      })
    }

    void loadProfile()
  }, [])

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError('')

    try {
      const updated = await updateProfile(form)
      setProfile(updated)
      updateSessionProfile(updated)
      setIsEditing(false)
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to save profile.')
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    try {
      await changePassword(passwordForm)
      setPasswordForm(initialPasswordForm)
      setIsChangingPassword(false)
      setPasswordSuccess('Password updated successfully. Use the new password the next time you sign in.')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Unable to update password.')
    }
  }

  return (
    <div className="page-shell">
      <div className="page-top-actions">
        <button
          className="secondary-button"
          onClick={() => {
            setIsChangingPassword((current) => !current)
            setPasswordError('')
            setPasswordSuccess('')
          }}
          type="button"
        >
          {isChangingPassword ? 'Close password form' : 'Change password'}
        </button>
        <button
          className="primary-button"
          disabled={isEditing}
          onClick={() => {
            setIsEditing(true)
            setProfileError('')
          }}
          type="button"
        >
          {isEditing ? 'Editing profile' : 'Edit profile'}
        </button>
      </div>
      {isEditing ? (
        <form className="panel--flat inline-form" onSubmit={handleSaveProfile}>
          <div className="panel__header">
            <div>
              <h3>Edit profile</h3>
              <p className="muted">Save personal account details. Role changes are managed by administrators.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="input-group">
              <span>Name</span>
              <input onChange={(event) => setForm({ ...form, name: event.target.value })} required type="text" value={form.name} />
            </label>
            <label className="input-group">
              <span>Email</span>
              <input onChange={(event) => setForm({ ...form, email: event.target.value })} required type="email" value={form.email} />
            </label>
            <label className="input-group">
              <span>Assigned region</span>
              <input onChange={(event) => setForm({ ...form, assignedRegion: event.target.value })} required type="text" value={form.assignedRegion} />
            </label>
          </div>
          {profileError ? <div className="form-error">{profileError}</div> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit">
              Save profile
            </button>
            <button className="secondary-button" onClick={() => setIsEditing(false)} type="button">
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {isChangingPassword ? (
        <form className="panel--flat inline-form" onSubmit={handleChangePassword}>
          <div className="panel__header">
            <div>
              <h3>Change password</h3>
              <p className="muted">Update the operator login password used for authentication.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="input-group">
              <span>Current password</span>
              <input
                onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                required
                type="password"
                value={passwordForm.currentPassword}
              />
            </label>
            <label className="input-group">
              <span>New password</span>
              <input
                onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                required
                type="password"
                value={passwordForm.newPassword}
              />
            </label>
            <label className="input-group">
              <span>Confirm new password</span>
              <input
                onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                required
                type="password"
                value={passwordForm.confirmPassword}
              />
            </label>
          </div>
          {passwordError ? <div className="form-error">{passwordError}</div> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit">
              Update password
            </button>
            <button
              className="secondary-button"
              onClick={() => setIsChangingPassword(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {passwordSuccess ? <div className="login-hint">{passwordSuccess}</div> : null}
      {profile ? (
        <section className="profile-grid">
          <article className="panel--flat">
            <h3>{profile.name}</h3>
            <p className="muted">{profile.role}</p>
            <div className="detail-meta">
              <span className="badge">{profile.email}</span>
              <span className="badge">{profile.assignedRegion}</span>
            </div>
            <p>
              This profile updates live in the running application session, and password changes are
              now stored securely in the backend.
            </p>
          </article>
          {drivers.length ? (
            <div>
              {drivers.map((driver) => (
                <DriverCard key={driver.id} driver={driver} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
