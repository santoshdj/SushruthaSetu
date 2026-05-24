import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { PatientPageLayout } from '@/components/PatientPageLayout'

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
            const preview = note.text.length > 200 ? note.text.slice(0, 200) + '…' : note.text
            return (
              <div key={note.id} className="border border-gray-100 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggle(note.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs text-gray-400 w-24 shrink-0">{note.date?.slice(0, 10) ?? '—'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${
                    note.source === 'This App' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {note.source}
                  </span>
                  <span className="flex-1 text-sm text-gray-600 truncate">{preview}</span>
                  <span className="text-gray-400 text-xs select-none shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-50">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
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
