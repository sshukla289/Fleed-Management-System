import { useEffect, useState, type FormEvent } from 'react'
import { DriverCard } from '../components/DriverCard'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../context/useAuth'
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
    role: '',
    email: '',
    assignedRegion: '',
  })
  const [passwordForm, setPasswordForm] = useState<ChangePasswordInput>(initialPasswordForm)

  useEffect(() => {
    async function loadProfile() {
      const [profileData, driverData] = await Promise.all([fetchProfile(), fetchDrivers()])

      setProfile(profileData)
      setDrivers(driverData.slice(0, 1))
      setForm({
        name: profileData.name,
        role: profileData.role,
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
    <div className="page">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Manage the authenticated operator identity and security settings shown across the app."
        actionLabel={isEditing ? 'Editing profile' : 'Edit profile'}
        actionDisabled={isEditing}
        onAction={() => {
          setIsEditing(true)
          setProfileError('')
        }}
      />
      <div className="form-actions">
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
      </div>
      {isEditing ? (
        <form className="panel inline-form" onSubmit={handleSaveProfile}>
          <div className="panel__header">
            <div>
              <h3>Edit profile</h3>
              <p className="muted">Save the account details shown in the navbar and profile page.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="input-group">
              <span>Name</span>
              <input onChange={(event) => setForm({ ...form, name: event.target.value })} required type="text" value={form.name} />
            </label>
            <label className="input-group">
              <span>Role</span>
              <input onChange={(event) => setForm({ ...form, role: event.target.value })} required type="text" value={form.role} />
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
        <form className="panel inline-form" onSubmit={handleChangePassword}>
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
          <article className="panel">
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
          <div>
            {drivers.map((driver) => (
              <DriverCard key={driver.id} driver={driver} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
