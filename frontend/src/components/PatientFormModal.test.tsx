import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatientFormModal } from '@/components/PatientFormModal'

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('mock-token') }),
}))

vi.mock('@/lib/api', () => ({
  apiFetchWithAuth: vi.fn(),
}))

import { apiFetchWithAuth } from '@/lib/api'
const mockApiFetch = vi.mocked(apiFetchWithAuth)

const onClose = vi.fn()
const onSuccess = vi.fn()

const existingPatient = {
  id: 'patient-1',
  first_name: 'Jane',
  last_name: 'Smith',
  prefix: 'Dr.',
  gender: 'female',
  birth_date: '1980-06-15',
}

describe('PatientFormModal', () => {
  beforeEach(() => {
    onClose.mockClear()
    onSuccess.mockClear()
    mockApiFetch.mockClear()
  })

  it('renders nothing when closed', () => {
    render(<PatientFormModal open={false} onClose={onClose} onSuccess={onSuccess} />)
    expect(screen.queryByText('New Patient')).not.toBeInTheDocument()
    expect(screen.queryByText('Edit Patient')).not.toBeInTheDocument()
  })

  it('shows "New Patient" title in create mode', () => {
    render(<PatientFormModal open={true} onClose={onClose} onSuccess={onSuccess} />)
    expect(screen.getByText('New Patient')).toBeInTheDocument()
  })

  it('shows "Edit Patient" title when a patient is provided', () => {
    render(<PatientFormModal open={true} patient={existingPatient} onClose={onClose} onSuccess={onSuccess} />)
    expect(screen.getByText('Edit Patient')).toBeInTheDocument()
  })

  it('pre-populates all form fields with existing patient data in edit mode', () => {
    render(<PatientFormModal open={true} patient={existingPatient} onClose={onClose} onSuccess={onSuccess} />)
    expect(screen.getByLabelText('First Name *')).toHaveValue('Jane')
    expect(screen.getByLabelText('Last Name *')).toHaveValue('Smith')
    expect(screen.getByLabelText('Title / Prefix')).toHaveValue('Dr.')
    expect(screen.getByLabelText('Date of Birth *')).toHaveValue('1980-06-15')
  })

  it('calls onClose when the Cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<PatientFormModal open={true} onClose={onClose} onSuccess={onSuccess} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows validation errors when the form is submitted empty', async () => {
    const user = userEvent.setup()
    render(<PatientFormModal open={true} onClose={onClose} onSuccess={onSuccess} />)
    await user.click(screen.getByRole('button', { name: 'Create Patient' }))
    expect(await screen.findByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(screen.getByText('Please select a gender')).toBeInTheDocument()
  })

  it('calls onSuccess after a successful create', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true } as Response)
    const user = userEvent.setup()
    render(<PatientFormModal open={true} onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('First Name *'), 'Alice')
    await user.type(screen.getByLabelText('Last Name *'), 'Brown')
    await user.selectOptions(screen.getByLabelText('Gender *'), 'female')
    fireEvent.change(screen.getByLabelText('Date of Birth *'), { target: { value: '1990-03-22' } })

    await user.click(screen.getByRole('button', { name: 'Create Patient' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
  })

  it('sends a PUT request with the patient id in edit mode', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true } as Response)
    const user = userEvent.setup()
    render(<PatientFormModal open={true} patient={existingPatient} onClose={onClose} onSuccess={onSuccess} />)

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith(
      `/patients/${existingPatient.id}`,
      expect.any(Function),
      expect.objectContaining({ method: 'PUT' })
    ))
  })

  it('does not call onSuccess when the API returns an error', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: 'Server error' }),
    } as Response)
    const user = userEvent.setup()
    // spy on alert so it doesn't throw in jsdom
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<PatientFormModal open={true} onClose={onClose} onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText('First Name *'), 'Alice')
    await user.type(screen.getByLabelText('Last Name *'), 'Brown')
    await user.selectOptions(screen.getByLabelText('Gender *'), 'female')
    fireEvent.change(screen.getByLabelText('Date of Birth *'), { target: { value: '1990-03-22' } })

    await user.click(screen.getByRole('button', { name: 'Create Patient' }))
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Server error'))
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
