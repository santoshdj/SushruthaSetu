import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@clerk/clerk-react'
import { patientFormSchema, PatientFormValues } from '@/lib/patientSchema'
import { apiFetchWithAuth } from '@/lib/api'

type Patient = {
  id: string
  first_name: string
  last_name: string
  prefix?: string
  gender: string
  birth_date: string
}

interface PatientFormModalProps {
  open: boolean
  patient?: Patient
  onClose: () => void
  onSuccess: () => void
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
]

export function PatientFormModal({ open, patient, onClose, onSuccess }: PatientFormModalProps) {
  const { getToken } = useAuth()
  const isEdit = !!patient

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      prefix: '',
      gender: undefined,
      birth_date: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset(
        patient
          ? {
              first_name: patient.first_name,
              last_name: patient.last_name,
              prefix: patient.prefix ?? '',
              gender: patient.gender as PatientFormValues['gender'],
              birth_date: patient.birth_date,
            }
          : { first_name: '', last_name: '', prefix: '', gender: undefined, birth_date: '' }
      )
    }
  }, [open, patient, reset])

  const onSubmit = async (values: PatientFormValues) => {
    try {
      const path = isEdit ? `/patients/${patient!.id}` : '/patients'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await apiFetchWithAuth(path, getToken, {
        method,
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? 'Save failed')
      }
      onSuccess()
    } catch (err: any) {
      alert(err.message ?? 'An error occurred. Please try again.')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">
          {isEdit ? 'Edit Patient' : 'New Patient'}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                id="first_name"
                {...register('first_name')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                id="last_name"
                {...register('last_name')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="prefix" className="block text-sm font-medium text-gray-700 mb-1">Title / Prefix</label>
            <input
              id="prefix"
              {...register('prefix')}
              placeholder="e.g. Dr., Mr., Ms."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.prefix && <p className="text-red-500 text-xs mt-1">{errors.prefix.message}</p>}
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
            <select
              id="gender"
              {...register('gender')}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select gender...</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>}
          </div>

          <div>
            <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
            <input
              id="birth_date"
              {...register('birth_date')}
              type="date"
              max={new Date().toISOString().split('T')[0]}
              min="1900-01-01"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.birth_date && <p className="text-red-500 text-xs mt-1">{errors.birth_date.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-sm px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
