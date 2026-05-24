import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRole } from '@/hooks/useRole'

vi.mock('@clerk/clerk-react', () => ({
  useUser: vi.fn(),
}))

import { useUser } from '@clerk/clerk-react'
const mockUseUser = vi.mocked(useUser)

describe('useRole', () => {
  beforeEach(() => {
    mockUseUser.mockReset()
  })

  it('returns admin when publicMetadata.role is "admin"', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'admin' } } } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('admin')
  })

  it('returns clinician when role is "clinician"', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'clinician' } } } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('clinician')
  })

  it('returns clinician when role is any unrecognised value', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: { role: 'superuser' } } } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('clinician')
  })

  it('returns clinician when publicMetadata has no role key', () => {
    mockUseUser.mockReturnValue({ user: { publicMetadata: {} } } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('clinician')
  })

  it('returns clinician when user is null (not loaded yet)', () => {
    mockUseUser.mockReturnValue({ user: null } as any)
    const { result } = renderHook(() => useRole())
    expect(result.current).toBe('clinician')
  })
})
