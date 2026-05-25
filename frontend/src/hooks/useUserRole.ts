import { useUser } from '@clerk/clerk-react'

export type UserRole = 'clinician_user' | 'clinician_admin'

/**
 * Returns the role stored in the Clerk user's publicMetadata.
 * Defaults to 'clinician_user' (least privilege) when no role is set.
 */
export function useUserRole(): UserRole {
  const { user } = useUser()
  const role = (user?.publicMetadata as { role?: string } | undefined)?.role
  return role === 'clinician_admin' ? 'clinician_admin' : 'clinician_user'
}
