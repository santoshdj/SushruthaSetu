import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PatientsPage } from '@/pages/PatientsPage'

// Clerk — always signed in for this page's tests
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('mock-token') }),
}))

// Role is controlled per-test
vi.mock('@/hooks/useRole', () => ({
  useRole: vi.fn(),
}))

// API calls are controlled per-test
vi.mock('@/lib/api', () => ({
  apiFetchWithAuth: vi.fn(),
}))

// Stub the modal so it doesn't need its own Clerk context
vi.mock('@/components/PatientFormModal', () => ({
  PatientFormModal: () => null,
}))

import { useRole } from '@/hooks/useRole'
import { apiFetchWithAuth } from '@/lib/api'
const mockUseRole = vi.mocked(useRole)
const mockApiFetch = vi.mocked(apiFetchWithAuth)

function makePatientResponse(patients = [
  { id: '1', first_name: 'Alice', last_name: 'Brown', gender: 'female', birth_date: '1990-01-01' },
]) {
  return {
    ok: true,
    json: () => Promise.resolve({ patients, next_page_token: null, previous_page_token: null }),
  } as Response
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PatientsPage', () => {
  beforeEach(() => {
    mockUseRole.mockReset()
    mockApiFetch.mockReset()
  })

  it('all users see the "New Patient" button', async () => {
    mockUseRole.mockReturnValue('clinician')
    mockApiFetch.mockResolvedValueOnce(makePatientResponse())
    renderPage()
    expect(await screen.findByRole('button', { name: '+ New Patient' })).toBeInTheDocument()
  })

  it('all users see an Edit button for each patient row', async () => {
    mockUseRole.mockReturnValue('clinician')
    mockApiFetch.mockResolvedValueOnce(makePatientResponse([
      { id: '1', first_name: 'Alice', last_name: 'Brown', gender: 'female', birth_date: '1990-01-01' },
      { id: '2', first_name: 'Bob', last_name: 'Jones', gender: 'male', birth_date: '1975-05-20' },
    ]))
    renderPage()
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    expect(editButtons).toHaveLength(2)
  })

  it('renders patient name, gender and date of birth in the list', async () => {
    mockUseRole.mockReturnValue('clinician')
    mockApiFetch.mockResolvedValueOnce(makePatientResponse())
    renderPage()
    expect(await screen.findByText('Alice Brown')).toBeInTheDocument()
    expect(screen.getByText('female')).toBeInTheDocument()
    expect(screen.getByText('1990-01-01')).toBeInTheDocument()
  })

  it('shows an empty state when the API returns no patients', async () => {
    mockUseRole.mockReturnValue('clinician')
    mockApiFetch.mockResolvedValueOnce(makePatientResponse([]))
    renderPage()
    expect(await screen.findByText('No patients found.')).toBeInTheDocument()
  })

  it('shows an error message when the API call fails', async () => {
    mockUseRole.mockReturnValue('clinician')
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))
    renderPage()
    expect(await screen.findByText(/failed to load patients/i)).toBeInTheDocument()
  })
})
