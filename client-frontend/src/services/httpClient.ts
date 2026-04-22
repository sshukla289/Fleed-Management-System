import { AUTH_STORAGE_KEY } from '../context/auth-context'
import { readViteEnv } from '../lib/readViteEnv'
import type { AuthSession } from '../types'

const DEFAULT_API_BASE_URL = readViteEnv('VITE_API_BASE_URL') ?? 'http://localhost:8080/api'

type RequestOptions = {
  auth?: boolean
  allow404?: boolean
}

function getApiBaseUrl() {
  const runtimeConfig = globalThis as { __API_BASE_URL__?: string }
  return (runtimeConfig.__API_BASE_URL__ ?? DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

function readStoredToken() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as Partial<AuthSession>
    return typeof session.token === 'string' && session.token.trim() ? session.token.trim() : null
  } catch {
    return null
  }
}

async function parseError(response: Response) {
  const fallback = `Request failed with status ${response.status}`

  try {
    const contentType = response.headers.get('Content-Type') ?? ''
    if (!contentType.includes('application/json')) {
      const text = await response.text()
      return text || fallback
    }

    const body = (await response.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? fallback
  } catch {
    return fallback
  }
}

export async function httpRequest<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const shouldAttachAuth = options.auth ?? true
  const token = shouldAttachAuth ? readStoredToken() : null
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData

  let headers: HeadersInit = {
    ...(init?.headers ?? {}),
  }

  if (!isFormDataBody) {
    headers = {
      'Content-Type': 'application/json',
      ...headers,
    }
  }

  if (token) {
    headers = {
      ...headers,
      Authorization: `Bearer ${token}`,
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  })

  if (options.allow404 && response.status === 404) {
    return undefined as T
  }

  if (!response.ok) {
    if (response.status === 401 && (options.auth ?? true) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fleet:auth:unauthorized'))
    }

    throw new Error(await parseError(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
