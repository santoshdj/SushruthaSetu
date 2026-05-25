import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'
import { formatDOB } from '@/lib/utils'

export function PatientProfilePage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { getToken } = useAuth()

  const { data: summary, isLoading } = useQuery({
    queryKey: ['patient', patientId, 'summary'],
    queryFn: async () => {
      const res = await apiFetchWithAuth(`/patients/${patientId}/summary`, getToken)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: !!patientId,
  })

  const p = summary?.patient_profile
  const completeness = summary?.profile_completeness

  const fields = p ? [
    { label: 'First Name', value: p.first_name },
    { label: 'Last Name', value: p.last_name },
    { label: 'Prefix', value: p.prefix },
    { label: 'Gender', value: p.gender },
    { label: 'Date of Birth', value: p.birth_date ? formatDOB(p.birth_date) : null },
    { label: 'Phone', value: p.phone },
    {
      label: 'Address',
      value: p.address
        ? [p.address.line, p.address.city, p.address.state, p.address.postal_code, p.address.country].filter(Boolean).join(', ')
        : null,
    },
    { label: 'Marital Status', value: p.marital_status },
    { label: 'Language', value: p.language },
    { label: 'Multiple Birth', value: p.multiple_birth != null ? (p.multiple_birth ? 'Yes' : 'No') : null },
    { label: 'Race', value: p.race },
    { label: 'Ethnicity', value: p.ethnicity },
    { label: 'Birth Sex', value: p.birth_sex },
    { label: "Mother's Maiden Name", value: p.mothers_maiden_name },
    { label: 'Birth Place', value: p.birth_place },
  ] : []

  return (
    <PatientPageLayout patientId={patientId!} title="Patient Profile" icon="👤" accentClass="border-l-4 border-l-slate-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : (
        <>
          {/* Profile completeness widget */}
          {completeness && (() => {
            const pct = Math.round(completeness.score * 100)
            const barColor = pct === 100 ? 'bg-green-500' : pct >= 80 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            const textColor = pct === 100 ? 'text-green-600' : pct >= 80 ? 'text-blue-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
            return (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Profile Completeness</p>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className={`${barColor} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-sm font-bold ${textColor} w-10 text-right`}>{pct}%</span>
                </div>
                {completeness.missing?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {completeness.missing.map((f: string) => (
                      <span key={f} className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* All fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {fields.map(({ label, value }) => (
              <div key={label}>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
                <p className="text-sm text-gray-800 mt-0.5 capitalize">
                  {value ?? <span className="text-gray-400 italic">Not recorded</span>}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </PatientPageLayout>
  )
}
