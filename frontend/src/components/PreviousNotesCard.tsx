import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { apiFetchWithAuth } from '@/lib/api'
import { NoteBody } from '@/components/NoteBody'

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
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set())

  const toggleNote = (id: string) =>
    setOpenNotes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

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
              <div className="space-y-3">
                {visible.map((note) => {
                  const isNoteOpen = openNotes.has(note.id)
                  const isApp = note.source === 'This App'
                  return (
                    <div
                      key={note.id}
                      className={`rounded-xl border overflow-hidden ${
                        isApp ? 'border-blue-200' : 'border-gray-200'
                      }`}
                    >
                      {/* Header — always visible, acts as toggle */}
                      <button
                        onClick={() => toggleNote(note.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isApp
                            ? 'bg-blue-50 hover:bg-blue-100'
                            : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-bold text-sm text-gray-800 shrink-0">
                          {note.date ? note.date.slice(0, 10) : '—'}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold shrink-0 ${
                            isApp
                              ? 'bg-blue-200 text-blue-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {note.source}
                        </span>
                        <span className="flex-1" />
                        <span className="text-xs font-medium text-gray-500 select-none shrink-0">
                          {isNoteOpen ? 'Collapse ▲' : 'Expand ▼'}
                        </span>
                      </button>

                      {/* Body — structured note content */}
                      {isNoteOpen && (
                        <div className="bg-white px-5 py-4 border-t border-gray-100">
                          <NoteBody text={note.text} />
                        </div>
                      )}
                    </div>
                  )
                })}
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
