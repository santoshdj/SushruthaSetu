import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { apiFetchWithAuth } from '@/lib/api'

const EVENT_TYPE_OPTIONS = [
  'Login',
  'Patient Viewed',
  'Patient Created',
  'Patient Updated',
  'Unauthorized Access Attempt',
]

interface AuditEvent {
  id: string
  timestamp: string
  event_type: string
  user: string
  patient: string | null
  outcome: 'Success' | 'Failure'
}

export function EventsPage() {
  const { getToken } = useAuth()
  const [filterType, setFilterType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading, error } = useQuery<AuditEvent[]>({
    queryKey: ['audit-events', filterType, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterType) params.set('event_type', filterType)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const qs = params.toString()
      const res = await apiFetchWithAuth(`/audit${qs ? `?${qs}` : ''}`, getToken)
      if (!res.ok) throw new Error('Failed to fetch audit events')
      return res.json()
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Events</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-white p-4 rounded-lg border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Event Type</label>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All types</option>
            {EVENT_TYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={() => { setFilterType(''); setDateFrom(''); setDateTo('') }}
          className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {isLoading && <p className="text-sm text-gray-500">Loading events…</p>}
      {error && <p className="text-sm text-red-600">Failed to load events.</p>}
      {data && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Event Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No events found.
                  </td>
                </tr>
              )}
              {data.map(event => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{event.event_type}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{event.user}</td>
                  <td className="px-4 py-3 text-gray-600">{event.patient ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        event.outcome === 'Success'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {event.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
