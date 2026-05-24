import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'

export function LabsPage() {
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

  const labs: any[] = summary?.labs ?? []

  return (
    <PatientPageLayout patientId={patientId!} title="Lab Results" icon="🧪" accentClass="border-l-4 border-l-amber-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !labs.length ? (
        <p className="text-gray-400 text-sm">No recent labs</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
              <th className="pb-2 pr-4">Test</th>
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Value</th>
              <th className="pb-2 pr-4">Reference Range</th>
              <th className="pb-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {labs.map((l: any, i: number) => {
              const rr = l.reference_range
              const isAbnormal = ['H', 'L', 'HH', 'LL'].includes(l.interpretation)
              const isHigh = l.interpretation === 'H' || l.interpretation === 'HH'
              return (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gray-800">{l.code}</td>
                  <td className="py-2 pr-4 text-gray-500">{l.date?.slice(0, 10)}</td>
                  <td className={`py-2 pr-4 font-medium ${isAbnormal ? 'text-red-600' : 'text-gray-800'}`}>
                    {l.value} {l.unit}
                  </td>
                  <td className="py-2 pr-4 text-gray-400 text-xs">
                    {rr && (rr.low != null || rr.high != null) ? `${rr.low ?? '?'} – ${rr.high ?? '?'}` : '—'}
                  </td>
                  <td className="py-2">
                    {isAbnormal && (
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded uppercase ${
                        isHigh ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {l.interpretation}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </PatientPageLayout>
  )
}
