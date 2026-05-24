import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'

export function SchedulePage() {
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const { data: appointments = [], isLoading, isError } = useQuery({
    queryKey: ['schedule', 'today'],
    queryFn: async () => {
      const res = await apiFetchWithAuth('/schedule/today', getToken)
      if (!res.ok) throw new Error('Failed to fetch schedule')
      return res.json()
    },
  })

  if (isLoading) return <div className="text-gray-500">Loading today's schedule...</div>
  if (isError) return <div className="text-red-500">Failed to load schedule. Please try again.</div>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Today's Schedule</h1>
      {appointments.length === 0 ? (
        <p className="text-gray-500">No appointments scheduled for today.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {appointments.map((appt: any) => (
                <tr
                  key={appt.id}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/patients/${appt.patientId}`)}
                >
                  <td className="px-6 py-4 text-sm text-gray-700 font-mono">{appt.time}</td>
                  <td className="px-6 py-4 text-sm font-medium text-blue-700">{appt.patientName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{appt.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
