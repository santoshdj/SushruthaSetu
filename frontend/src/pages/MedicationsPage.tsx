import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'

export function MedicationsPage() {
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
    <PatientPageLayout patientId={patientId!} title="Medications" icon="💊" accentClass="border-l-4 border-l-blue-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !summary?.medications?.length ? (
        <p className="text-gray-400 text-sm">None documented</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {summary.medications.map((m: any, i: number) => (
            <li key={i} className="py-3 flex items-start justify-between gap-4">
              <span className="text-sm text-gray-800 font-medium">{m.medication}</span>
              {m.dosage && <span className="text-sm text-gray-400 shrink-0">{m.dosage}</span>}
            </li>
          ))}
        </ul>
      )}
    </PatientPageLayout>
  )
}
