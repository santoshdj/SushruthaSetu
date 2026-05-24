import { useAuth } from '@clerk/clerk-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  // getToken is not available as a standalone import — callers pass token directly
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  return response
}

export async function apiFetchWithAuth(
  path: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken()
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  return response
}
