import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DriverCard } from '../components/DriverCard'
import { useAuth } from '../context/useAuth'
import { canAccessDrivers } from '../security/permissions'
import { changePassword, fetchDriverProfile, fetchDrivers, fetchProfile, updateDriverProfile, updateProfile } from '../services/apiService'
import type { ChangePasswordInput, Driver, DriverProfile, UpdateDriverProfileInput, UpdateProfileInput, UserProfile } from '../types'

const initialPasswordForm: ChangePasswordInput = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

const initialProfileForm: UpdateProfileInput = {
  name: '',
  email: '',
  assignedRegion: '',
}

const initialDriverContactForm: UpdateDriverProfileInput = {
  email: '',
  phone: '',
}

type DriverContactErrors = Partial<Record<keyof UpdateDriverProfileInput, string>>

function driverStatusClass(status: Driver['status']) {
  if (status === 'On Duty') {
    return 'badge badge--online'
  }

  if (status === 'Resting') {
    return 'badge badge--scheduled'
  }

  return 'badge'
}

function validateDriverContactForm(form: UpdateDriverProfileInput): DriverContactErrors {
  const errors: DriverContactErrors = {}
  const email = form.email.trim()
  const phone = form.phone.trim()

  if (!email) {
    errors.email = 'Email is required.'
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!phone) {
    errors.phone = 'Phone number is required.'
  } else if (!/^[0-9+()\-\s]{7,20}$/.test(phone)) {
    errors.phone = 'Use 7-20 digits and standard phone symbols only.'
  }

  return errors
}

export function Profile() {
  const { session, updateSessionProfile } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [form, setForm] = useState<UpdateProfileInput>(initialProfileForm)
  const [driverContactForm, setDriverContactForm] = useState<UpdateDriverProfileInput>(initialDriverContactForm)
  const [driverContactErrors, setDriverContactErrors] = useState<DriverContactErrors>({})
  const [passwordForm, setPasswordForm] = useState<ChangePasswordInput>(initialPasswordForm)
  const isDriverView = session?.profile.role === 'DRIVER'
  const editFormRef = useRef<HTMLFormElement | null>(null)
  const passwordFormRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      setProfileError('')

      try {
        if (isDriverView) {
          const driverProfileData = await fetchDriverProfile()
          if (cancelled) {
            return
          }

          setDriverProfile(driverProfileData)
          setProfile(driverProfileData)
          setDrivers([])
          setDriverContactForm({
            email: driverProfileData.email,
            phone: driverProfileData.phone ?? '',
          })
          setForm(initialProfileForm)
          return
        }

        const profileData = await fetchProfile()
        if (cancelled) {
          return
        }

        setDriverProfile(null)
        setProfile(profileData)
        setForm({
          name: profileData.name,
          email: profileData.email,
          assignedRegion: profileData.assignedRegion,
        })

        if (canAccessDrivers(profileData.role)) {
          try {
            const driverData = await fetchDrivers()
            if (!cancelled) {
              setDrivers(driverData.slice(0, 1))
            }
          } catch {
            if (!cancelled) {
              setDrivers([])
            }
          }
        } else {
          setDrivers([])
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError(error instanceof Error ? error.message : 'Unable to load profile.')
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [isDriverView])

  useEffect(() => {
    const activeForm = isEditing ? editFormRef.current : isChangingPassword ? passwordFormRef.current : null
    if (!activeForm) {
      return
    }

    activeForm.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [isChangingPassword, isEditing])

  function openEditMode() {
    setProfileError('')
    setIsChangingPassword(false)
    setPasswordError('')
    setPasswordSuccess('')
    setPasswordForm(initialPasswordForm)
    setIsEditing(true)

    if (driverProfile) {
      setDriverContactForm({
        email: driverProfile.email,
        phone: driverProfile.phone ?? '',
      })
      setDriverContactErrors({})
      return
    }

    if (profile) {
      setForm({
        name: profile.name,
        email: profile.email,
        assignedRegion: profile.assignedRegion,
      })
    }
  }

  function closeEditMode() {
    setIsEditing(false)
    setProfileError('')
    setDriverContactErrors({})
  }

  function toggleEditMode() {
    if (isEditing) {
      closeEditMode()
      return
    }

    openEditMode()
  }

  function closePasswordMode() {
    setIsChangingPassword(false)
    setPasswordError('')
    setPasswordForm(initialPasswordForm)
  }

  function togglePasswordMode() {
    if (isChangingPassword) {
      closePasswordMode()
      setPasswordSuccess('')
      return
    }

    closeEditMode()
    setPasswordError('')
    setPasswordSuccess('')
    setPasswordForm(initialPasswordForm)
    setIsChangingPassword(true)
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError('')

    if (isDriverView && driverProfile) {
      const validationErrors = validateDriverContactForm(driverContactForm)
      setDriverContactErrors(validationErrors)

      if (Object.keys(validationErrors).length > 0) {
        return
      }

      try {
        const updated = await updateDriverProfile({
          email: driverContactForm.email.trim(),
          phone: driverContactForm.phone.trim(),
        })
        setDriverProfile(updated)
        setProfile(updated)
        updateSessionProfile(updated)
        setIsEditing(false)
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : 'Unable to save driver contact info.')
      }

      return
    }

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
      <section className="panel--flat profile-action-bar">
        <div>
          <p className="profile-action-bar__eyebrow">Account actions</p>
          <h3>Keep your profile and credentials current.</h3>
          <p className="muted">Open one workspace at a time so changes stay focused and easier to review.</p>
        </div>
        <div className="profile-action-bar__buttons">
          <button
            aria-pressed={isChangingPassword}
            className={`profile-action-button${isChangingPassword ? ' profile-action-button--active' : ''}`}
            onClick={togglePasswordMode}
            type="button"
          >
            <span className="profile-action-button__label">
              {isChangingPassword ? 'Close password form' : 'Change password'}
            </span>
            <span className="profile-action-button__hint">Update the password used for sign-in.</span>
          </button>
          <button
            aria-pressed={isEditing}
            className={`profile-action-button${isEditing ? ' profile-action-button--active' : ''}`}
            onClick={toggleEditMode}
            type="button"
          >
            <span className="profile-action-button__label">
              {isEditing ? 'Close profile editor' : 'Edit profile'}
            </span>
            <span className="profile-action-button__hint">Change account details and contact information.</span>
          </button>
        </div>
      </section>
      {!isEditing && profileError ? <div className="form-error">{profileError}</div> : null}
      {isEditing ? (
        isDriverView && driverProfile ? (
          <form className="panel--flat inline-form driver-profile-form" onSubmit={handleSaveProfile} ref={editFormRef}>
            <div className="panel__header">
              <div>
                <h3>Update contact info</h3>
                <p className="muted">Keep dispatch communication current. License and vehicle assignment stay read-only here.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="input-group">
                <span>Email</span>
                <input
                  onChange={(event) => {
                    setDriverContactForm({ ...driverContactForm, email: event.target.value })
                    setDriverContactErrors((current) => ({ ...current, email: undefined }))
                  }}
                  required
                  type="email"
                  value={driverContactForm.email}
                />
                <small className={`form-helper${driverContactErrors.email ? ' form-helper--error' : ''}`}>
                  {driverContactErrors.email ?? 'Used for profile notifications and fleet contact updates.'}
                </small>
              </label>
              <label className="input-group">
                <span>Phone</span>
                <input
                  onChange={(event) => {
                    setDriverContactForm({ ...driverContactForm, phone: event.target.value })
                    setDriverContactErrors((current) => ({ ...current, phone: undefined }))
                  }}
                  placeholder="+91 98765 43210"
                  required
                  type="tel"
                  value={driverContactForm.phone}
                />
                <small className={`form-helper${driverContactErrors.phone ? ' form-helper--error' : ''}`}>
                  {driverContactErrors.phone ?? 'Supports digits, spaces, parentheses, hyphens, and +.'}
                </small>
              </label>
            </div>
            <div className="driver-profile-form__summary">
              <span className="badge">{driverProfile.licenseType}</span>
              <span className="badge">
                {driverProfile.assignedVehicleName
                  ? `${driverProfile.assignedVehicleName} - ${driverProfile.assignedVehicleId}`
                  : driverProfile.assignedVehicleId ?? 'No vehicle assigned'}
              </span>
            </div>
            {profileError ? <div className="form-error">{profileError}</div> : null}
            <div className="form-actions">
              <button className="primary-button" type="submit">
                Save contact info
              </button>
              <button className="secondary-button" onClick={closeEditMode} type="button">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <form className="panel--flat inline-form" onSubmit={handleSaveProfile} ref={editFormRef}>
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
              <button className="secondary-button" onClick={closeEditMode} type="button">
                Cancel
              </button>
            </div>
          </form>
        )
      ) : null}
      {isChangingPassword ? (
        <form className="panel--flat inline-form" onSubmit={handleChangePassword} ref={passwordFormRef}>
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
              onClick={closePasswordMode}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {passwordSuccess ? <div className="login-hint">{passwordSuccess}</div> : null}
      {driverProfile ? (
        <section className="profile-grid driver-profile-grid">
          <article className="panel--flat driver-profile-card">
            <div className="driver-profile-card__hero">
              <div>
                <p className="driver-profile-card__eyebrow">Driver profile</p>
                <h3>{driverProfile.name}</h3>
                <p className="muted">License {driverProfile.licenseType}</p>
              </div>
              <span className={driverStatusClass(driverProfile.status)}>{driverProfile.status}</span>
            </div>
            <div className="detail-meta">
              <span className="badge">{driverProfile.email}</span>
              <span className="badge">{driverProfile.assignedRegion}</span>
            </div>
            <div className="driver-profile-card__stats">
              <div className="driver-profile-card__stat">
                <span>Name</span>
                <strong>{driverProfile.name}</strong>
              </div>
              <div className="driver-profile-card__stat">
                <span>License</span>
                <strong>{driverProfile.licenseType}</strong>
              </div>
              <div className="driver-profile-card__stat">
                <span>Phone</span>
                <strong>{driverProfile.phone || 'Add your phone number'}</strong>
              </div>
              <div className="driver-profile-card__stat">
                <span>Assigned vehicle</span>
                <strong>
                  {driverProfile.assignedVehicleName
                    ? `${driverProfile.assignedVehicleName} (${driverProfile.assignedVehicleId})`
                    : driverProfile.assignedVehicleId ?? 'Unassigned'}
                </strong>
              </div>
            </div>
          </article>
          <article className="panel--flat driver-profile-card driver-profile-card--secondary">
            <h3>Contact and assignment</h3>
            <p className="muted">
              Your dispatch team uses this profile to reach you quickly during active operations.
            </p>
            <div className="driver-profile-contact-list">
              <div className="driver-profile-contact-item">
                <span>Contact email</span>
                <strong>{driverProfile.email}</strong>
              </div>
              <div className="driver-profile-contact-item">
                <span>Phone</span>
                <strong>{driverProfile.phone || 'No phone added yet'}</strong>
              </div>
              <div className="driver-profile-contact-item">
                <span>Assigned vehicle</span>
                <strong>{driverProfile.assignedVehicleName ?? driverProfile.assignedVehicleId ?? 'Unassigned'}</strong>
              </div>
            </div>
            <p className="driver-profile-note">
              License details and vehicle assignment are managed by fleet operations. You can update contact info here anytime.
            </p>
          </article>
        </section>
      ) : profile ? (
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
