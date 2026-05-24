import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'

vi.mock('@clerk/clerk-react', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@clerk/clerk-react'
const mockUseAuth = vi.mocked(useAuth)

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  it('shows a loading indicator while Clerk auth is initialising', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: false, getToken: vi.fn() } as any)
    renderWithRouter(<ProtectedRoute><div>App</div></ProtectedRoute>)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('does not render protected content when user is not signed in', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true, getToken: vi.fn() } as any)
    renderWithRouter(<ProtectedRoute><div>Protected content</div></ProtectedRoute>)
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children when user is signed in', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true, getToken: vi.fn() } as any)
    renderWithRouter(<ProtectedRoute><div>Protected content</div></ProtectedRoute>)
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
})
