import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { apiFetchWithAuth } from '@/lib/api'
import { PanelPatientRow, type PanelPatient } from '@/components/PanelPatientRow'

const TIER_LABELS: Record<string, string> = {
  high: '🔴 High Risk',
  medium: '🟡 Medium Risk',
  low: '🟢 Low Risk',
}

const TIER_HEADING_CLASS: Record<string, string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-green-600',
}

export function PanelPage() {
  const { getToken } = useAuth()

  const { data, isLoading, isError } = useQuery<PanelPatient[]>({
    queryKey: ['panel'],
    queryFn: async () => {
      const res = await apiFetchWithAuth('/patients/panel', getToken)
      if (!res.ok) throw new Error('Failed to load panel')
      return res.json()
    },
  })

  const grouped: Record<'high' | 'medium' | 'low', PanelPatient[]> = {
    high: (data ?? []).filter(p => p.risk_score === 'high'),
    medium: (data ?? []).filter(p => p.risk_score === 'medium'),
    low: (data ?? []).filter(p => p.risk_score === 'low'),
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Patient Panel</h1>
          <p className="text-sm text-gray-500 mt-1">
            Patients sorted by clinical urgency — high-risk patients first
          </p>
        </div>
        {data && (
          <span className="text-sm text-gray-500">
            {data.length} patient{data.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="text-gray-500 text-sm">Loading panel…</div>
      )}
      {isError && (
        <div className="text-red-500 text-sm">Failed to load panel. Please try again.</div>
      )}

      {data && data.length === 0 && (
        <div className="text-gray-400 text-sm">No patients found.</div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-8">
          {(['high', 'medium', 'low'] as const).map(tier => {
            const patients = grouped[tier]
            if (patients.length === 0) return null
            return (
              <section key={tier}>
                <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${TIER_HEADING_CLASS[tier]}`}>
                  {TIER_LABELS[tier]} — {patients.length} patient{patients.length !== 1 ? 's' : ''}
                </h2>
                <div className="space-y-2">
                  {patients.map(patient => (
                    <PanelPatientRow key={patient.id} patient={patient} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
