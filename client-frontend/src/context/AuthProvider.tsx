import { useMemo, useState, type PropsWithChildren } from 'react'
import { login as loginRequest } from '../services/apiService'
import type { AuthSession, LoginCredentials } from '../types'
import { AUTH_STORAGE_KEY, AuthContext, type AuthContextValue } from './auth-context'

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!stored) {
    return null
  }

  try {
    return JSON.parse(stored) as AuthSession
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession())

  async function login(credentials: LoginCredentials) {
    const nextSession = await loginRequest(credentials)
    setSession(nextSession)
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
  }

  function logout() {
    setSession(null)
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      login,
      logout,
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
