import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { apiFetchWithAuth } from '@/lib/api'

/**
 * Fires POST /audit once per Clerk session to record a Login AuditEvent.
 * Uses sessionStorage keyed by sessionId to avoid duplicate fires within
 * the same browser session, including across React StrictMode double-mounts.
 */
export function LoginAuditBridge() {
  const { isSignedIn, getToken, sessionId } = useAuth()
  const firedRef = useRef(false)

  useEffect(() => {
    if (!isSignedIn || !sessionId || firedRef.current) return
    const key = `login-audit-fired-${sessionId}`
    if (sessionStorage.getItem(key)) return
    firedRef.current = true
    sessionStorage.setItem(key, '1')
    apiFetchWithAuth('/audit', getToken, { method: 'POST' }).catch(() => {
      // fire-and-forget: failures are logged server-side
    })
  }, [isSignedIn, sessionId, getToken])

  return null
}
