import { Navigate, Outlet } from 'react-router-dom'
import { useUserRole } from '@/hooks/useUserRole'

/**
 * Layout route that allows only clinician_admin users through.
 * Must be placed inside an already-authenticated route tree.
 * Non-admin users are redirected to the home page.
 */
export function AdminRoute() {
  const role = useUserRole()

  if (role !== 'clinician_admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
