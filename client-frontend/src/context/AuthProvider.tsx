import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { fetchCurrentUser, login as loginRequest, logoutRequest } from '../services/apiService'
import type { AuthSession, LoginCredentials, UserProfile } from '../types'
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
  const [isLoadingSession, setIsLoadingSession] = useState(() => Boolean(readStoredSession()))

  useEffect(() => {
    let cancelled = false
    const storedSession = readStoredSession()

    if (!storedSession) {
      setIsLoadingSession(false)
      return undefined
    }
    const storedToken = storedSession.token

    async function validateStoredSession() {
      try {
        const profile = await fetchCurrentUser()
        if (cancelled) {
          return
        }

        const nextSession = {
          token: storedToken,
          profile,
        }
        setSession(nextSession)
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
      } catch {
        if (cancelled) {
          return
        }
        setSession(null)
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      } finally {
        if (!cancelled) {
          setIsLoadingSession(false)
        }
      }
    }

    void validateStoredSession()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoadingSession(true)
    try {
      const nextSession = await loginRequest(credentials)
      setSession(nextSession)
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))

      try {
        const profile = await fetchCurrentUser()
        const hydratedSession = { ...nextSession, profile }
        setSession(hydratedSession)
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(hydratedSession))
      } catch (error) {
        setSession(null)
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
        throw error
      }
    } finally {
      setIsLoadingSession(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      if (session?.token) {
        await logoutRequest()
      }
    } finally {
      setSession(null)
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [session?.token])

  const updateSessionProfile = useCallback((profile: UserProfile) => {
    setSession((current) => {
      if (!current) {
        return current
      }

      const nextSession = {
        ...current,
        profile,
      }
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
      return nextSession
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      isLoadingSession,
      login,
      logout,
      updateSessionProfile,
    }),
    [isLoadingSession, login, logout, session, updateSessionProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
