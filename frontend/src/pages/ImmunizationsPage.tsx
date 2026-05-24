import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'

export function ImmunizationsPage() {
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

  const immunizations: any[] = summary?.immunizations ?? []

  return (
    <PatientPageLayout patientId={patientId!} title="Immunizations" icon="💉" accentClass="border-l-4 border-l-teal-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !immunizations.length ? (
        <p className="text-gray-400 text-sm">None recorded</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {immunizations.map((imm: any, i: number) => (
            <li key={i} className="py-3 flex items-center justify-between gap-4">
              <span className="text-sm text-gray-800">{imm.vaccine}</span>
              {imm.date && <span className="text-xs text-gray-400 shrink-0">{imm.date.slice(0, 10)}</span>}
            </li>
          ))}
        </ul>
      )}
    </PatientPageLayout>
  )
}
