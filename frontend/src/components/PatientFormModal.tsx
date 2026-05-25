import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@clerk/clerk-react'
import { patientFormSchema, PatientFormValues } from '@/lib/patientSchema'
import { apiFetchWithAuth } from '@/lib/api'

interface PatientFormModalProps {
  open: boolean
  patientId?: string
  onClose: () => void
  onSuccess: () => void
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
]
const MARITAL_OPTIONS = ['Married', 'Single', 'Divorced', 'Widowed', 'Separated', 'Domestic Partner', 'Unknown']
const RACE_OPTIONS = ['White', 'Black or African American', 'Asian', 'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander', 'Other Race']
const ETHNICITY_OPTIONS = ['Hispanic or Latino', 'Not Hispanic or Latino']
const BIRTH_SEX_OPTIONS = ['Male', 'Female', 'Unknown']

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-sm font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-100 hover:text-gray-800 transition-colors"
    >
      {title}
      <span className="text-gray-400 text-xs">{open ? '▲ hide' : '▼ show'}</span>
    </button>
  )
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {!required && <span className="text-gray-400 text-xs ml-1">(optional)</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const EMPTY_DEFAULTS: PatientFormValues = {
  first_name: '', last_name: '', prefix: '',
  gender: undefined as any, birth_date: '',
  phone: '', address_line: '', address_city: '', address_state: '',
  address_postal_code: '', address_country: '',
  marital_status: '', multiple_birth: '', language: '',
  mothers_maiden_name: '', birth_place: '',
  race: '', ethnicity: '', birth_sex: '',
}

function patientToFormValues(p: any): PatientFormValues {
  return {
    first_name: p.first_name ?? '',
    last_name: p.last_name ?? '',
    prefix: p.prefix ?? '',
    gender: p.gender ?? (undefined as any),
    birth_date: p.birth_date ?? '',
    phone: p.phone ?? '',
    address_line: p.address?.line ?? '',
    address_city: p.address?.city ?? '',
    address_state: p.address?.state ?? '',
    address_postal_code: p.address?.postal_code ?? '',
    address_country: p.address?.country ?? '',
    marital_status: (p.marital_status ?? '') as any,
    multiple_birth: p.multiple_birth == null ? '' : p.multiple_birth ? 'true' : 'false',
    language: p.language ?? '',
    mothers_maiden_name: p.mothers_maiden_name ?? '',
    birth_place: p.birth_place ?? '',
    race: (p.race ?? '') as any,
    ethnicity: (p.ethnicity ?? '') as any,
    birth_sex: (p.birth_sex ?? '') as any,
  }
}

function buildApiPayload(values: PatientFormValues) {
  const addr = {
    line: values.address_line || undefined,
    city: values.address_city || undefined,
    state: values.address_state || undefined,
    postal_code: values.address_postal_code || undefined,
    country: values.address_country || undefined,
  }
  const hasAddress = Object.values(addr).some(Boolean)
  return {
    first_name: values.first_name,
    last_name: values.last_name,
    prefix: values.prefix || undefined,
    gender: values.gender,
    birth_date: values.birth_date,
    phone: values.phone || undefined,
    address: hasAddress ? addr : undefined,
    marital_status: values.marital_status || undefined,
    multiple_birth: values.multiple_birth === 'true' ? true : values.multiple_birth === 'false' ? false : undefined,
    language: values.language || undefined,
    mothers_maiden_name: values.mothers_maiden_name || undefined,
    birth_place: values.birth_place || undefined,
    race: values.race || undefined,
    ethnicity: values.ethnicity || undefined,
    birth_sex: values.birth_sex || undefined,
  }
}

export function PatientFormModal({ open, patientId, onClose, onSuccess }: PatientFormModalProps) {
  const { getToken } = useAuth()
  const isEdit = !!patientId
  const [loadingPatient, setLoadingPatient] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [showDemographics, setShowDemographics] = useState(false)
  const [showUSCore, setShowUSCore] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: EMPTY_DEFAULTS,
  })

  useEffect(() => {
    if (!open) return
    if (isEdit && patientId) {
      setShowContact(true); setShowDemographics(true); setShowUSCore(true)
      setLoadingPatient(true)
      apiFetchWithAuth(`/patients/${patientId}`, getToken)
        .then(r => r.json())
        .then(p => reset(patientToFormValues(p)))
        .catch(() => reset(EMPTY_DEFAULTS))
        .finally(() => setLoadingPatient(false))
    } else {
      setShowContact(false); setShowDemographics(false); setShowUSCore(false)
      reset(EMPTY_DEFAULTS)
    }
  }, [open, patientId, isEdit, getToken, reset])

  const onSubmit = async (values: PatientFormValues) => {
    try {
      const path = isEdit ? `/patients/${patientId}` : '/patients'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await apiFetchWithAuth(path, getToken, {
        method,
        body: JSON.stringify(buildApiPayload(values)),
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

  const inputCls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const selectCls = inputCls

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 pt-6 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? 'Edit Patient' : 'New Patient'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Fields marked <span className="text-red-500">*</span> are required</p>
        </div>

        {loadingPatient ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-gray-400 text-sm animate-pulse">Loading patient…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

              {/* ── Identity (always open) ── */}
              <div>
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-100 pb-2 mb-4">Identity</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" required error={errors.first_name?.message}>
                    <input {...register('first_name')} className={inputCls} />
                  </Field>
                  <Field label="Last Name" required error={errors.last_name?.message}>
                    <input {...register('last_name')} className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Field label="Title / Prefix" error={errors.prefix?.message}>
                    <input {...register('prefix')} placeholder="e.g. Dr., Mr., Ms." className={inputCls} />
                  </Field>
                  <Field label="Gender" required error={errors.gender?.message}>
                    <select {...register('gender')} className={selectCls}>
                      <option value="">Select gender…</option>
                      {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="mt-4 max-w-xs">
                  <Field label="Date of Birth" required error={errors.birth_date?.message}>
                    <input {...register('birth_date')} type="date" max={new Date().toISOString().split('T')[0]} min="1900-01-01" className={inputCls} />
                  </Field>
                </div>
              </div>

              {/* ── Contact ── */}
              <div>
                <SectionHeader title="Contact" open={showContact} onToggle={() => setShowContact(v => !v)} />
                {showContact && (
                  <div className="mt-4 space-y-4">
                    <Field label="Phone" error={errors.phone?.message}>
                      <input {...register('phone')} placeholder="e.g. 555-867-5309" className={inputCls} />
                    </Field>
                    <Field label="Street Address" error={errors.address_line?.message}>
                      <input {...register('address_line')} placeholder="e.g. 123 Main St" className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="City" error={errors.address_city?.message}>
                        <input {...register('address_city')} className={inputCls} />
                      </Field>
                      <Field label="State" error={errors.address_state?.message}>
                        <input {...register('address_state')} placeholder="e.g. MA" className={inputCls} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Postal Code" error={errors.address_postal_code?.message}>
                        <input {...register('address_postal_code')} className={inputCls} />
                      </Field>
                      <Field label="Country" error={errors.address_country?.message}>
                        <input {...register('address_country')} placeholder="e.g. US" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Demographics ── */}
              <div>
                <SectionHeader title="Demographics" open={showDemographics} onToggle={() => setShowDemographics(v => !v)} />
                {showDemographics && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <Field label="Marital Status" error={errors.marital_status?.message}>
                      <select {...register('marital_status')} className={selectCls}>
                        <option value="">Select…</option>
                        {MARITAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Multiple Birth" error={errors.multiple_birth?.message}>
                      <select {...register('multiple_birth')} className={selectCls}>
                        <option value="">Select…</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </Field>
                    <Field label="Language" error={errors.language?.message}>
                      <input {...register('language')} placeholder="e.g. English" className={inputCls} />
                    </Field>
                    <Field label="Mother's Maiden Name" error={errors.mothers_maiden_name?.message}>
                      <input {...register('mothers_maiden_name')} className={inputCls} />
                    </Field>
                    <div className="col-span-2">
                      <Field label="Birth Place" error={errors.birth_place?.message}>
                        <input {...register('birth_place')} placeholder="e.g. Boston, MA" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                )}
              </div>

              {/* ── US Core Clinical ── */}
              <div>
                <SectionHeader title="US Core Clinical" open={showUSCore} onToggle={() => setShowUSCore(v => !v)} />
                {showUSCore && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Field label="Race" error={errors.race?.message}>
                        <select {...register('race')} className={selectCls}>
                          <option value="">Select…</option>
                          {RACE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Ethnicity" error={errors.ethnicity?.message}>
                      <select {...register('ethnicity')} className={selectCls}>
                        <option value="">Select…</option>
                        {ETHNICITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Birth Sex" error={errors.birth_sex?.message}>
                      <select {...register('birth_sex')} className={selectCls}>
                        <option value="">Select…</option>
                        {BIRTH_SEX_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
              </div>

            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="text-sm px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Patient'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

