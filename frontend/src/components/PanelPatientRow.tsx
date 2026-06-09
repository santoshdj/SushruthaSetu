import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetchWithAuth } from '@/lib/api'
import { formatDOB } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CareGap = {
  description: string
  severity: 'high' | 'medium' | 'low'
}

export type PanelPatient = {
  id: string
  name: string
  dob: string | null
  gender: string
  followup_due: string | null
  risk_score: 'high' | 'medium' | 'low'
  open_care_gap_count: number
  care_gaps: CareGap[]
}

interface Props {
  patient: PanelPatient
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DRAFT_KEY = (patientId: string) => `visit-note-draft-${patientId}`

const severityBadge: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildOrderBlocks(careGaps: CareGap[]): string {
  const labGaps = careGaps.filter(g => /hba1c|lab|blood|glucose/i.test(g.description))
  if (labGaps.length === 0) return ''
  const today = todayIso()
  return labGaps
    .map(g =>
      `→ Order: ${g.description}\n   Reason: ${g.description} — flagged by care gap review\n   Date: ${today}`
    )
    .join('\n\n')
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PanelPatientRow({ patient }: Props) {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [expanded, setExpanded] = useState(false)

  // Outreach state
  const [outreachLoading, setOutreachLoading] = useState(false)
  const [outreachText, setOutreachText] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Inline follow-up scheduling state
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [followupDate, setFollowupDate] = useState(patient.followup_due ?? '')
  const [savingFollowup, setSavingFollowup] = useState(false)
  const [followupSaved, setFollowupSaved] = useState(false)

  // ── Follow-up overdue badge ───────────────────────────────────────────────
  const followupIsOverdue =
    patient.followup_due
      ? new Date(patient.followup_due) < new Date(new Date().toDateString())
      : false

  const followupFormatted = patient.followup_due
    ? new Date(patient.followup_due + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : null

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleOutreach() {
    setOutreachLoading(true)
    try {
      const res = await apiFetchWithAuth(
        `/patients/${patient.id}/generate-outreach-message`,
        getToken,
        { method: 'POST' },
      )
      if (!res.ok) throw new Error('Failed to generate outreach message')
      const data = await res.json()
      setOutreachText(data.text)
    } catch {
      setOutreachText('Failed to generate message. Please try again.')
    } finally {
      setOutreachLoading(false)
    }
  }

  function handleCopy() {
    if (!outreachText) return
    navigator.clipboard.writeText(outreachText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleOrderLabs() {
    const blocks = buildOrderBlocks(patient.care_gaps)
    if (blocks) {
      const savedAt = new Date().toISOString()
      localStorage.setItem(DRAFT_KEY(patient.id), JSON.stringify({ text: blocks, savedAt }))
    }
    navigate(`/patients/${patient.id}`)
  }

  async function handleSaveFollowup() {
    setSavingFollowup(true)
    try {
      const res = await apiFetchWithAuth(
        `/patients/${patient.id}/followup-due`,
        getToken,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followup_due: followupDate || null }),
        },
      )
      if (!res.ok) throw new Error('Failed to save follow-up date')
      setFollowupSaved(true)
      setShowDatePicker(false)
      queryClient.invalidateQueries({ queryKey: ['panel'] })
      setTimeout(() => setFollowupSaved(false), 3000)
    } catch {
      // silently fail — row will retain existing value
    } finally {
      setSavingFollowup(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* Row header */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Expand chevron */}
        <span className="text-gray-400 text-xs select-none">{expanded ? '▼' : '▶'}</span>

        {/* Patient name + DOB */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 text-sm">{patient.name}</span>
          <span className="ml-2 text-xs text-gray-500">{formatDOB(patient.dob ?? '')}</span>
          {followupIsOverdue && (
            <span className="ml-2 inline-block text-[10px] font-semibold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
              Follow-up overdue
            </span>
          )}
          {followupFormatted && !followupIsOverdue && (
            <span className="ml-2 text-xs text-gray-400">Next: {followupFormatted}</span>
          )}
          {followupSaved && (
            <span className="ml-2 text-xs text-green-600 font-medium">Saved ✓</span>
          )}
        </div>

        {/* Care gap count */}
        {patient.open_care_gap_count > 0 && (
          <span className="text-xs text-gray-500">
            {patient.open_care_gap_count} care gap{patient.open_care_gap_count !== 1 ? 's' : ''}
          </span>
        )}

        {/* View Patient link (stops row expand) */}
        <button
          onClick={e => { e.stopPropagation(); navigate(`/patients/${patient.id}`) }}
          className="text-xs text-blue-600 hover:underline whitespace-nowrap"
        >
          View patient →
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">

          {/* Care gaps list */}
          {patient.care_gaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Open Care Gaps</p>
              <ul className="space-y-1">
                {patient.care_gaps.map((gap, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${severityBadge[gap.severity]}`}>
                      {gap.severity}
                    </span>
                    <span className="text-gray-700">{gap.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">

            {/* Outreach */}
            <button
              onClick={handleOutreach}
              disabled={outreachLoading}
              className="text-sm px-3 py-1.5 rounded-md border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              {outreachLoading ? 'Generating…' : '📣 Outreach'}
            </button>

            {/* Order Labs */}
            <button
              onClick={handleOrderLabs}
              className="text-sm px-3 py-1.5 rounded-md border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              🧪 Order Labs
            </button>

            {/* Schedule Follow-up */}
            <button
              onClick={e => { e.stopPropagation(); setShowDatePicker(v => !v) }}
              className="text-sm px-3 py-1.5 rounded-md border border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
            >
              📅 Schedule Follow-up
            </button>
          </div>

          {/* Inline follow-up date picker */}
          {showDatePicker && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={followupDate}
                onChange={e => setFollowupDate(e.target.value)}
                min={todayIso()}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button
                onClick={handleSaveFollowup}
                disabled={savingFollowup || !followupDate}
                className="text-sm px-3 py-1 rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {savingFollowup ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setShowDatePicker(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Outreach message modal (inline) */}
          {outreachText && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Outreach Message</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{outreachText}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="text-sm px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  {copied ? 'Copied ✓' : 'Copy to clipboard'}
                </button>
                <button
                  onClick={() => setOutreachText(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
