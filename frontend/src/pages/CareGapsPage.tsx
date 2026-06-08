import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'

export function CareGapsPage() {
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
    <PatientPageLayout patientId={patientId!} title="Care Gaps & Preventive Alerts" icon="🎯" accentClass="border-l-4 border-l-orange-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !summary?.care_gaps?.length ? (
        <p className="text-gray-400 text-sm">No care gaps identified</p>
      ) : (
        <ul className="space-y-3">
          {summary.care_gaps.map((g: any, i: number) => (
            <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                g.severity === 'high' ? 'bg-red-100 text-red-700' :
                g.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {g.severity}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800">{g.label}</p>
                {g.rationale && <p className="text-sm text-gray-500 mt-0.5">{g.rationale}</p>}
                {g.guideline_citation && (
                  <p className="text-xs text-indigo-600 mt-1">
                    <span className="inline-block bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 font-semibold mr-1">
                      {g.guideline_citation.source}
                    </span>
                    {g.guideline_citation.text}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PatientPageLayout>
  )
}
