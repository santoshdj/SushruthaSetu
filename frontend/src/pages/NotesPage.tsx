import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'
import { NoteBody } from '@/components/NoteBody'

interface Note {
  id: string
  date: string
  source: 'EHR' | 'This App'
  text: string
}

export function NotesPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { getToken } = useAuth()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['patient', patientId, 'notes'],
    queryFn: async () => {
      const res = await apiFetchWithAuth(`/patients/${patientId}/notes`, getToken)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    enabled: !!patientId,
  })

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <PatientPageLayout patientId={patientId!} title="Previous Visit Notes" icon="📝" accentClass="border-l-4 border-l-indigo-400">
      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      ) : !notes.length ? (
        <p className="text-gray-400 text-sm">No previous notes on record.</p>
      ) : (
        <div className="space-y-3">
          {notes.map(note => {
            const isOpen = expanded.has(note.id)
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
                  onClick={() => toggle(note.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isApp
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-bold text-sm text-gray-800 w-28 shrink-0">
                    {note.date?.slice(0, 10) ?? '—'}
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
                    {isOpen ? 'Collapse ▲' : 'Expand ▼'}
                  </span>
                </button>

                {/* Body — structured note content */}
                {isOpen && (
                  <div className="bg-white px-5 py-4 border-t border-gray-100">
                    <NoteBody text={note.text} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </PatientPageLayout>
  )
}
