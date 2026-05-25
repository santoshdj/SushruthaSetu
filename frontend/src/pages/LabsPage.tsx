import { useState, useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'

const VISIBLE_PER_GROUP = 2

export function LabsPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { getToken } = useAuth()
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set())
  const [chartGroups, setChartGroups] = useState<Set<string>>(new Set())

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

  // Group by test code, each group sorted newest-first, groups sorted by most recent date
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const lab of labs) {
      const key = lab.code ?? 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(lab)
    }
    for (const group of map.values()) {
      group.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    }
    return Array.from(map.entries()).sort(
      ([, a], [, b]) => (b[0]?.date ?? '').localeCompare(a[0]?.date ?? '')
    )
  }, [labs])

  const toggleExpand = (code: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const toggleChart = (code: string) => {
    setChartGroups(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <PatientPageLayout patientId={patientId!} title="Lab Results" icon="🧪" accentClass="border-l-4 border-l-amber-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !labs.length ? (
        <p className="text-gray-400 text-sm">No recent labs</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([code, results]) => {
            const isExpanded = expandedTests.has(code)
            const visible = isExpanded ? results : results.slice(0, VISIBLE_PER_GROUP)
            const hiddenCount = results.length - VISIBLE_PER_GROUP
            return (
              <div key={code}>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex-1">{code}</h3>
                  <button
                    onClick={() => toggleChart(code)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    {chartGroups.has(code) ? 'View as table' : 'View as chart'}
                  </button>
                </div>

                {chartGroups.has(code) ? (() => {
                  const chartData = [...results]
                    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
                    .map(r => ({ date: r.date?.slice(0, 10) ?? '', value: r.value }))
                  const rr = results[0]?.reference_range ?? null
                  return (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                          <Tooltip
                            contentStyle={{ fontSize: 12 }}
                            formatter={(value: any) => [`${value} ${results[0]?.unit ?? ''}`, code]}
                          />
                          {rr?.low != null && rr?.high != null && (
                            <ReferenceArea
                              y1={rr.low}
                              y2={rr.high}
                              fill="#fef3c7"
                              fillOpacity={0.6}
                              label={{ value: 'Normal range', position: 'insideTopRight', fontSize: 10, fill: '#d97706' }}
                            />
                          )}
                          {rr?.low != null && (
                            <ReferenceLine y={rr.low} stroke="#fcd34d" strokeDasharray="4 2" />
                          )}
                          {rr?.high != null && (
                            <ReferenceLine y={rr.high} stroke="#fcd34d" strokeDasharray="4 2" />
                          )}
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#f59e0b' }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })() : (
                  <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Value</th>
                      <th className="pb-2 pr-4">Reference Range</th>
                      <th className="pb-2">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((l: any, i: number) => {
                      const rr = l.reference_range
                      const isAbnormal = ['H', 'L', 'HH', 'LL'].includes(l.interpretation)
                      const isHigh = l.interpretation === 'H' || l.interpretation === 'HH'
                      return (
                        <tr key={i} className="border-b border-gray-50">
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
                {hiddenCount > 0 && (
                  <button
                    onClick={() => toggleExpand(code)}
                    className="mt-1.5 text-xs text-blue-500 hover:underline"
                  >
                    {isExpanded
                      ? 'Show fewer'
                      : `Show ${hiddenCount} older result${hiddenCount > 1 ? 's' : ''}`}
                  </button>
                )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </PatientPageLayout>
  )
}
