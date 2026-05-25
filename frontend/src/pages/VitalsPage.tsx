import { useState, useMemo } from 'react'
import type React from 'react'
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

function vitalStatus(v: any): 'normal' | 'high' | 'low' | 'unknown' {
  const rr = v.reference_range
  if (!rr || v.value == null) return 'unknown'
  if (rr.low != null && v.value < rr.low) return 'low'
  if (rr.high != null && v.value > rr.high) return 'high'
  return 'normal'
}

export function VitalsPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { getToken } = useAuth()

  const { data: vitalsHistory, isLoading } = useQuery({
    queryKey: ['patient', patientId, 'vitals-history'],
    queryFn: async () => {
      const res = await apiFetchWithAuth(`/patients/${patientId}/vitals/history`, getToken)
      if (!res.ok) throw new Error('Failed')
      return res.json() as Promise<any[]>
    },
    enabled: !!patientId,
  })

  const vitals: any[] = vitalsHistory ?? []

  // unique vital types available
  const vitalTypes = useMemo(() => {
    const seen = new Set<string>()
    return vitals.filter(v => v.code && (seen.has(v.code) ? false : (seen.add(v.code), true)))
      .map(v => v.code)
  }, [vitals])

  const [selectedVital, setSelectedVital] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(true)

  const activeVital = selectedVital ?? vitalTypes[0] ?? null

  const filtered = vitals.filter(v => v.code === activeVital)
  const tableSorted = [...filtered].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const chartData = [...filtered]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map(v => ({ date: v.date?.slice(0, 10) ?? '', value: v.value }))

  const referenceRange = filtered[0]?.reference_range ?? null

  return (
    <PatientPageLayout patientId={patientId!} title="Vitals History" icon="❤️" accentClass="border-l-4 border-l-pink-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !vitals.length ? (
        <p className="text-gray-400 text-sm">No vitals history available</p>
      ) : (
        <>
          {/* Vital selector */}
          <div className="flex flex-wrap gap-2 mb-5">
            {vitalTypes.map(code => (
              <button
                key={code}
                onClick={() => { setSelectedVital(code); setShowTable(true) }}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  code === activeVital
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {/* Chart / table toggle */}
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 flex-1">{activeVital}</h3>
            <button
              onClick={() => setShowTable(t => !t)}
              className="text-xs text-blue-500 hover:underline"
            >
              {showTable ? 'View as chart' : 'View as table'}
            </button>
          </div>

          {showTable ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Value</th>
                  <th className="pb-2 pr-4">Unit</th>
                  <th className="pb-2 pr-4">Ref Range</th>
                  <th className="pb-2 pr-4">Δ Change</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tableSorted.map((v: any, i: number) => {
                  const s = vitalStatus(v)
                  const rr = v.reference_range
                  const rrText = rr && (rr.low != null || rr.high != null)
                    ? `${rr.low ?? '?'} – ${rr.high ?? '?'}`
                    : '—'
                  const prevVal = tableSorted[i + 1]?.value
                  let deltaNode: React.ReactNode = <span className="text-gray-300">—</span>
                  if (prevVal != null && v.value != null) {
                    const delta = Number(v.value) - Number(prevVal)
                    const sign = delta > 0 ? '+' : ''
                    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '='
                    deltaNode = (
                      <span className="text-gray-500">
                        {arrow} {sign}{delta.toFixed(1)}
                      </span>
                    )
                  }
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-4 text-gray-500">{v.date?.slice(0, 10)}</td>
                      <td className={`py-2 pr-4 font-medium ${s !== 'normal' && s !== 'unknown' ? 'text-red-600' : 'text-gray-800'}`}>
                        {v.value}
                      </td>
                      <td className="py-2 pr-4 text-gray-500">{v.unit}</td>
                      <td className="py-2 pr-4 text-gray-400 text-xs">{rrText}</td>
                      <td className="py-2 pr-4 text-xs font-medium">{deltaNode}</td>
                      <td className="py-2">
                        {s !== 'unknown' && s !== 'normal' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold uppercase ${
                            s === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>{s}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: any) => [`${value} ${filtered[0]?.unit ?? ''}`, activeVital ?? '']}
                    />
                    {referenceRange?.low != null && referenceRange?.high != null && (
                      <ReferenceArea
                        y1={referenceRange.low}
                        y2={referenceRange.high}
                        fill="#dcfce7"
                        fillOpacity={0.5}
                        label={{ value: 'Normal range', position: 'insideTopRight', fontSize: 10, fill: '#16a34a' }}
                      />
                    )}
                    {referenceRange?.low != null && (
                      <ReferenceLine y={referenceRange.low} stroke="#86efac" strokeDasharray="4 2" />
                    )}
                    {referenceRange?.high != null && (
                      <ReferenceLine y={referenceRange.high} stroke="#86efac" strokeDasharray="4 2" />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#ec4899"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#ec4899' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </PatientPageLayout>
  )
}
