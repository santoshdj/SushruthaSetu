import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientFormModal } from '@/components/PatientFormModal'
import { formatDOB } from '@/lib/utils'

type Patient = {
  id: string
  first_name: string
  last_name: string
  prefix?: string
  gender: string
  birth_date: string
}


type PatientListResponse = {
  patients: Patient[]
  next_page_token: string | null
  previous_page_token: string | null
}

export function PatientsPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pageToken, setPageToken] = useState<string | null>(null)
  const [modalState, setModalState] = useState<{ open: boolean; patientId?: string }>({ open: false })

  // Debounce search
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearch(val)
    setPageToken(null)
    const timer = setTimeout(() => setDebouncedSearch(val), 400)
    return () => clearTimeout(timer)
  }, [])

  const queryKey = ['patients', debouncedSearch, pageToken]
  const { data, isLoading, isError } = useQuery<PatientListResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('name', debouncedSearch)
      if (pageToken) params.set('page_token', pageToken)
      const res = await apiFetchWithAuth(`/patients?${params}`, getToken)
      if (!res.ok) throw new Error('Failed to fetch patients')
      return res.json()
    },
  })

  const onSaveSuccess = () => {
    setModalState({ open: false })
    queryClient.invalidateQueries({ queryKey: ['patients'] })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Patients</h1>
        <button
            onClick={() => setModalState({ open: true })}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            + New Patient
          </button>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name..."
          value={search}
          onChange={handleSearchChange}
          className="w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading && <div className="text-gray-500">Loading patients...</div>}
      {isError && <div className="text-red-500">Failed to load patients. Please try again.</div>}

      {data && (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date of Birth</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.patients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">No patients found.</td>
                  </tr>
                ) : (
                  data.patients.map((patient) => (
                    <tr
                      key={patient.id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">
                        {[patient.prefix, patient.first_name, patient.last_name].filter(Boolean).join(' ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{patient.gender}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDOB(patient.birth_date)}</td>
                      <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setModalState({ open: true, patientId: patient.id }) }}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              disabled={!data.previous_page_token}
              onClick={() => setPageToken(data.previous_page_token)}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled={!data.next_page_token}
              onClick={() => setPageToken(data.next_page_token)}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      <PatientFormModal
        open={modalState.open}
        patientId={modalState.patientId}
        onClose={() => setModalState({ open: false })}
        onSuccess={onSaveSuccess}
      />
    </div>
  )
}
