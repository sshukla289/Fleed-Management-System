import { useEffect, useState, type FormEvent } from 'react'
import { DriverCard } from '../components/DriverCard'
import { PageHeader } from '../components/PageHeader'
import { fetchDrivers, fetchProfile, updateProfile } from '../services/apiService'
import type { Driver, UpdateProfileInput, UserProfile } from '../types'

export function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<UpdateProfileInput>({
    name: '',
    role: '',
    email: '',
    assignedRegion: '',
  })

  useEffect(() => {
    async function loadProfile() {
      const [profileData, driverData] = await Promise.all([
        fetchProfile(),
        fetchDrivers(),
      ])

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
    const updated = await updateProfile(form)
    setProfile(updated)
    setIsEditing(false)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Manage the authenticated operator identity and the supervisor details shown across the app."
        actionLabel={isEditing ? 'Editing profile' : 'Edit profile'}
        actionDisabled={isEditing}
        onAction={() => setIsEditing(true)}
      />
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
              <input
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                type="text"
                value={form.name}
              />
            </label>
            <label className="input-group">
              <span>Role</span>
              <input
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                required
                type="text"
                value={form.role}
              />
            </label>
            <label className="input-group">
              <span>Email</span>
              <input
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
                type="email"
                value={form.email}
              />
            </label>
            <label className="input-group">
              <span>Assigned region</span>
              <input
                onChange={(event) => setForm({ ...form, assignedRegion: event.target.value })}
                required
                type="text"
                value={form.assignedRegion}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              Save profile
            </button>
            <button
              className="secondary-button"
              onClick={() => setIsEditing(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
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
              This profile now updates live in the running application session, including the
              operator details shown in the top navigation.
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
