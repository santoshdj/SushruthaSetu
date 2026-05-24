import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'

export function AllergiesPage() {
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

  return (
    <PatientPageLayout patientId={patientId!} title="Allergies" icon="⚠️" accentClass="border-l-4 border-l-red-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !summary?.allergies?.length ? (
        <p className="text-gray-400 text-sm">None documented</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {summary.allergies.map((a: any, i: number) => (
            <li key={i} className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm text-gray-800 font-medium">{a.substance}</span>
              <div className="flex items-center gap-2">
                {a.reaction && <span className="text-sm text-gray-500">{a.reaction}</span>}
                {a.criticality && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase ${
                    a.criticality === 'high' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {a.criticality}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PatientPageLayout>
  )
}
