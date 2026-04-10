import { createContext } from 'react'
import type { AuthSession, LoginCredentials, UserProfile } from '../types'

export interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  isLoadingSession: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  updateSessionProfile: (profile: UserProfile) => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AUTH_STORAGE_KEY = 'fleet-auth-session'
