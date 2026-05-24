import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'

export function ProblemsPage() {
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
    <PatientPageLayout patientId={patientId!} title="Active Problems" icon="🩺" accentClass="border-l-4 border-l-purple-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !summary?.problems?.length ? (
        <p className="text-gray-400 text-sm">None documented</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {summary.problems.map((p: any, i: number) => (
            <li key={i} className="py-3 text-sm text-gray-800">{p.code}</li>
          ))}
        </ul>
      )}
    </PatientPageLayout>
  )
}
