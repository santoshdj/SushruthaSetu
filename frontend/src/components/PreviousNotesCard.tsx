import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { apiFetchWithAuth } from '@/lib/api'

interface Note {
  id: string
  date: string
  source: 'EHR' | 'This App'
  text: string
}

interface Props {
  patientId: string
}

export function PreviousNotesCard({ patientId }: Props) {
  const { getToken } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(true)

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['patient', patientId, 'notes'],
    queryFn: async () => {
      const res = await apiFetchWithAuth(`/patients/${patientId}/notes`, getToken)
      if (!res.ok) throw new Error('Failed to fetch notes')
      return res.json()
    },
    enabled: !!patientId,
  })

  const visible = expanded ? notes : notes.slice(0, 1)

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Previous Visit Notes
          {notes.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
              ({notes.length})
            </span>
          )}
        </h2>
        <span className="text-gray-400 text-xs select-none">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {isLoading ? (
            <div className="text-gray-400 text-sm animate-pulse">Loading notes...</div>
          ) : notes.length === 0 ? (
            <p className="text-gray-400 text-sm">No previous notes on record.</p>
          ) : (
            <>
              <div className="space-y-4">
                {visible.map((note) => (
                  <div key={note.id} className="border border-gray-100 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400">{note.date ? note.date.slice(0, 10) : '—'}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          note.source === 'This App'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {note.source}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                  </div>
                ))}
              </div>

              {notes.length > 1 && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="mt-3 text-xs text-blue-600 hover:underline"
                >
                  {expanded ? 'Show less' : `Show all ${notes.length} notes`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
