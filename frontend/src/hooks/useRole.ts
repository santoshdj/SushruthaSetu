import { useUser } from '@clerk/clerk-react'

type Role = 'admin' | 'clinician'

export function useRole(): Role {
  const { user } = useUser()
  const role = user?.publicMetadata?.role as string | undefined
  return role === 'clinician_admin' ? 'admin' : 'clinician'
}
