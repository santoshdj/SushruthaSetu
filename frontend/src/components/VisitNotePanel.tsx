import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetchWithAuth } from '@/lib/api'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'

interface Props {
  patientId: string
  onSuggestNextSteps?: (noteText: string) => void
}

const DRAFT_KEY = (patientId: string) => `visit-note-draft-${patientId}`

export function VisitNotePanel({ patientId, onSuggestNextSteps }: Props) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [panelOpen, setPanelOpen] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [draftTime, setDraftTime] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore draft on mount
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY(patientId))
    if (raw) {
      try {
        const { text, savedAt } = JSON.parse(raw)
        if (text) {
          setNoteText(text)
          setDraftTime(savedAt)
        }
      } catch {
        // corrupted draft — ignore
      }
    }
  }, [patientId])

  // Debounced draft save on every keystroke
  useEffect(() => {
    if (!noteText) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      const savedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      localStorage.setItem(DRAFT_KEY(patientId), JSON.stringify({ text: noteText, savedAt }))
      setDraftTime(savedAt)
    }, 500)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [noteText, patientId])

  const handleResult = (finalChunk: string) => {
    setNoteText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalChunk)
  }

  const handleInterim = (interim: string) => {
    setInterimText(interim)
  }

  const { isListening, isSupported, start, stop } = useSpeechRecognition(handleResult, handleInterim)

  const toggleMic = () => {
    isListening ? stop() : start()
  }

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY(patientId))
    setDraftTime(null)
  }

  const handleSave = async () => {
    const text = noteText.trim()
    if (!text) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await apiFetchWithAuth(
        `/patients/${patientId}/notes`,
        getToken,
        {
          method: 'POST',
          body: JSON.stringify({ text, encounter_date: new Date().toISOString() }),
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? 'Failed to save note')
      }
      clearDraft()
      setNoteText('')
      setInterimText('')
      setSaveSuccess(true)
      // Invalidate notes query so PreviousNotesCard refreshes
      queryClient.invalidateQueries({ queryKey: ['patient', patientId, 'notes'] })
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setSaveError(err.message ?? 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (isListening) stop()
    setNoteText('')
    setInterimText('')
    clearDraft()
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header toggle */}
      <button
        onClick={() => setPanelOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
          <span>📝</span>
          <span>Current Visit Note</span>
          {draftTime && (
            <span className="text-xs text-amber-600 font-normal normal-case">— draft from {draftTime}</span>
          )}
        </h2>
        <span className="text-gray-400 text-xs select-none">{panelOpen ? '▲' : '▼'}</span>
      </button>

      {/* Content */}
      {panelOpen && (
        <div className="px-5 pb-5 pt-1">
          {draftTime && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-amber-600">⚠ Unsaved draft from {draftTime}</span>
            </div>
          )}

          {/* Textarea — shows committed text + live interim preview */}
          <div className="relative">
            <textarea
              className="w-full min-h-[140px] rounded-md border border-gray-300 p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
              placeholder="Type or dictate your visit note here…"
              value={noteText + (interimText ? (noteText ? ' ' : '') + interimText : '')}
              onChange={e => {
                // Only update if not listening — avoid fighting with speech API
                if (!isListening) setNoteText(e.target.value)
              }}
              readOnly={isListening}
            />
            {isListening && (
              <span className="absolute top-2 right-2 flex items-center gap-1 text-xs text-red-500 font-medium">
                <span className="animate-pulse">●</span> Recording
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {/* Mic toggle */}
            {isSupported ? (
              <button
                onClick={toggleMic}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isListening
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isListening ? '⏹ Stop' : '🎤 Dictate'}
              </button>
            ) : (
              <span className="text-xs text-gray-400">Dictation not supported in this browser</span>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || !noteText.trim()}
              className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save Note'}
            </button>

            {/* Suggest next steps */}
            {onSuggestNextSteps && (
              <button
                onClick={() => onSuggestNextSteps(noteText)}
                disabled={!noteText.trim()}
                className="px-4 py-1.5 rounded bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ✨ Suggest next steps
              </button>
            )}

            {/* Discard */}
            {(noteText || draftTime) && (
              <button
                onClick={handleDiscard}
                className="px-3 py-1.5 rounded text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                Discard
              </button>
            )}

            {/* Feedback */}
            {saveSuccess && (
              <span className="text-xs text-green-600 font-medium">✓ Note saved</span>
            )}
            {saveError && (
              <span className="text-xs text-red-600">{saveError}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
