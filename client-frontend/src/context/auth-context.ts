import { createContext } from 'react'
import type { AuthSession, LoginCredentials } from '../types'

export interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AUTH_STORAGE_KEY = 'fleet-auth-session'
