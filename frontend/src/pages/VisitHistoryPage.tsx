import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'

export function VisitHistoryPage() {
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

  const visits: any[] = summary?.visit_history ?? []

  return (
    <PatientPageLayout patientId={patientId!} title="Visit History" icon="📅" accentClass="border-l-4 border-l-slate-300">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !visits.length ? (
        <p className="text-gray-400 text-sm">No visits recorded</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visits.map((v: any, i: number) => (
            <li key={i} className="py-3 flex items-start gap-4">
              <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{v.date?.slice(0, 10)}</span>
              <span className="text-sm text-gray-800">{v.type || v.reason || 'Visit'}</span>
            </li>
          ))}
        </ul>
      )}
    </PatientPageLayout>
  )
}
