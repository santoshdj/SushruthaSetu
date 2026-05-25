import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueries } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetchWithAuth } from '@/lib/api'
import { VisitNotePanel } from '@/components/VisitNotePanel'
import { ActionRecommendationsCard } from '@/components/ActionRecommendationsCard'
import { PatientIdentityStrip } from '@/components/PatientIdentityStrip'

// ─── PatientDashboardPage (Patient Hub) ─────────────────────────────────────
export function PatientDashboardPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [summaryQuery, aiQuery, notesQuery] = useQueries({
    queries: [
      {
        queryKey: ['patient', patientId, 'summary'],
        queryFn: async () => {
          const res = await apiFetchWithAuth(`/patients/${patientId}/summary`, getToken)
          if (!res.ok) throw new Error('Failed to fetch summary')
          return res.json()
        },
        enabled: !!patientId,
      },
      {
        queryKey: ['patient', patientId, 'ai-summary'],
        queryFn: async () => {
          const res = await apiFetchWithAuth(`/patients/${patientId}/ai-summary`, getToken)
          if (!res.ok) throw new Error('Failed to fetch AI summary')
          return res.json()
        },
        enabled: !!patientId,
      },
      {
        queryKey: ['patient', patientId, 'notes'],
        queryFn: async () => {
          const res = await apiFetchWithAuth(`/patients/${patientId}/notes`, getToken)
          if (!res.ok) throw new Error('Failed to fetch notes')
          return res.json()
        },
        enabled: !!patientId,
      },
    ],
  })

  const summary = summaryQuery.data
  const aiData = aiQuery.data
  const mostRecentNote = (notesQuery.data as any[])?.[0] ?? null

  // ─── Badge counts ─────────────────────────────────────────────────────────
  const abnormalVitalsCount: number = summary?.vitals?.filter((v: any) => {
    const rr = v.reference_range
    return rr && v.value != null && ((rr.low != null && v.value < rr.low) || (rr.high != null && v.value > rr.high))
  }).length ?? 0
  const abnormalLabsCount: number = summary?.labs?.filter((l: any) =>
    ['H', 'L', 'HH', 'LL'].includes(l.interpretation)
  ).length ?? 0
  const highCareGapsCount: number = summary?.care_gaps?.filter((g: any) => g.severity === 'high').length ?? 0
  const hasHighAllergyRisk: boolean = summary?.allergies?.some((a: any) => a.criticality === 'high') ?? false

  // ─── Action Recommendations state ────────────────────────────────────────
  const [recommendations, setRecommendations] = useState<any[] | null>(null)
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsError, setRecsError] = useState<string | null>(null)

  const handleSuggestNextSteps = async (noteText: string) => {
    if (!patientId || !noteText.trim()) return
    setRecsLoading(true)
    setRecsError(null)
    setRecommendations(null)
    try {
      const res = await apiFetchWithAuth(
        `/patients/${patientId}/action-recommendations`,
        getToken,
        { method: 'POST', body: JSON.stringify({ note_text: noteText }) },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? 'Failed to generate recommendations')
      }
      const data = await res.json()
      setRecommendations(data.recommendations ?? [])
    } catch (err: any) {
      setRecsError(err.message ?? 'Unknown error')
    } finally {
      setRecsLoading(false)
    }
  }

  type NavItem = { section: string; icon: string; label: string; badge?: number; badgeDot?: boolean; badgeColor: 'red' | 'orange' | 'none' }
  const NAV_ITEMS: NavItem[] = [
    { section: 'profile',       icon: '👤', label: 'Profile',    badgeColor: 'none' },
    { section: 'problems',      icon: '🩺', label: 'Problems',   badgeColor: 'none' },
    { section: 'medications',   icon: '💊', label: 'Meds',       badgeColor: 'none' },
    { section: 'allergies',     icon: '⚠️',  label: 'Allergies',  badgeDot: hasHighAllergyRisk, badgeColor: 'red' },
    { section: 'care-gaps',     icon: '🎯', label: 'Care Gaps',  badge: highCareGapsCount || undefined, badgeColor: 'red' },
    { section: 'vitals',        icon: '❤️',  label: 'Vitals',     badge: abnormalVitalsCount || undefined, badgeColor: 'orange' },
    { section: 'labs',          icon: '🧪', label: 'Labs',       badge: abnormalLabsCount || undefined, badgeColor: 'orange' },
    { section: 'visit-history', icon: '📅', label: 'Visits',     badgeColor: 'none' },
    { section: 'immunizations', icon: '💉', label: 'Vaccines',   badgeColor: 'none' },
    { section: 'notes',         icon: '📝', label: 'Notes',      badgeColor: 'none' },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-500 hover:underline mb-4 inline-block">
        ← Back
      </button>

      {/* Patient Identity Strip */}
      {patientId && <PatientIdentityStrip patientId={patientId} />}

      <div className="mt-4 flex gap-6 items-start">
        {/* ── Left column — sticky ─────────────────────────────────── */}
        <div className="w-96 shrink-0 flex flex-col gap-4 sticky top-4 self-start">
          {/* Pre-Visit Summary */}
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden border-l-4 border-l-blue-400">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Pre-Visit Summary</h2>
            </div>
            <div className="px-5 py-4">
              {aiQuery.isLoading ? (
                <div className="space-y-2">
                  {[80, 65, 72, 55].map(w => (
                    <div key={w} className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : aiQuery.isError ? (
                <p className="text-red-500 text-sm">Could not generate summary.</p>
              ) : aiData?.bullets?.length ? (
                <ul className="text-sm text-gray-700 space-y-2">
                  {aiData.bullets.map((b: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {mostRecentNote && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Most Recent Note</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    <span className="text-gray-400">{mostRecentNote.date?.slice(0, 10)} · </span>
                    {mostRecentNote.text.length > 120
                      ? mostRecentNote.text.slice(0, 120) + '…'
                      : mostRecentNote.text}
                  </p>
                  <button
                    onClick={() => navigate(`/patients/${patientId}/notes`)}
                    className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                  >
                    View all notes →
                  </button>
                </div>
              )}
            </div>
          </div>

        {/* Latest Vitals — nurse check-in */}
        {summaryQuery.isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden border-l-4 border-l-pink-400 px-5 py-4">
            <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2 mb-3" />
            <div className="grid grid-cols-2 gap-2">
              {[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          </div>
        ) : summary?.vitals?.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden border-l-4 border-l-pink-400">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Latest Vitals</h2>
              <button
                onClick={() => navigate(`/patients/${patientId}/vitals`)}
                className="text-xs text-blue-500 hover:underline"
              >
                View history →
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                {summary.vitals.map((v: any, i: number) => {
                  const rr = v.reference_range
                  const isHigh = rr?.high != null && v.value > rr.high
                  const isLow  = rr?.low  != null && v.value < rr.low
                  const statusColor = isHigh || isLow ? 'text-red-600' : rr ? 'text-green-600' : 'text-gray-700'
                  const badge = isHigh ? (
                    <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded uppercase">HIGH</span>
                  ) : isLow ? (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">LOW</span>
                  ) : rr ? (
                    <span className="text-[10px] text-green-600">✓</span>
                  ) : null
                  return (
                    <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide truncate mb-0.5">{v.code}</p>
                      <p className={`text-base font-semibold leading-tight ${statusColor}`}>
                        {v.value} <span className="text-xs font-normal text-gray-400">{v.unit}</span>
                      </p>
                      <div className="mt-0.5">{badge}</div>
                    </div>
                  )
                })}
              </div>
              {summary.vitals[0]?.date && (
                <p className="text-[10px] text-gray-400 mt-3">
                  Recorded {summary.vitals[0].date.slice(0, 10)}
                </p>
              )}
            </div>
          </div>
        )}

        </div>
        {/* ── Right column — icons + inline care gaps + visit note ─── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Navigation icon grid */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Clinical Detail Pages</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {NAV_ITEMS.map(({ section, icon, label, badge, badgeDot, badgeColor }) => (
                <button
                  key={section}
                  onClick={() => navigate(`/patients/${patientId}/${section}`)}
                  className="relative flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-blue-50 hover:border-blue-200 transition-all text-center group"
                >
                  <span className="text-2xl leading-none">{icon}</span>
                  <span className="text-xs font-medium text-gray-600 group-hover:text-blue-700 whitespace-nowrap">{label}</span>
                  {badge != null && badge > 0 && (
                    <span className={`absolute -top-2 -right-2 min-w-[1.25rem] h-5 px-1.5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                      badgeColor === 'red' ? 'bg-red-500' : 'bg-orange-400'
                    }`}>
                      {badge}
                    </span>
                  )}
                  {badgeDot && !(badge != null && badge > 0) && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Care Gaps — inline below icons */}
          {summary?.care_gaps?.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden border-l-4 border-l-orange-400">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Care Gaps</h2>
                <div className="flex items-center gap-2">
                  {highCareGapsCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                      {highCareGapsCount} HIGH
                    </span>
                  )}
                  <button
                    onClick={() => navigate(`/patients/${patientId}/care-gaps`)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    View all →
                  </button>
                </div>
              </div>
              <div className="px-5 py-4">
                <ul className="space-y-2">
                  {summary.care_gaps.slice(0, 4).map((g: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 shrink-0 inline-block px-1.5 py-0.5 rounded text-xs font-semibold uppercase ${
                        g.severity === 'high' ? 'bg-red-100 text-red-700' :
                        g.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}>{g.severity}</span>
                      <span className="text-gray-700">{g.label}</span>
                      {g.rationale && <span className="text-gray-400 text-xs ml-auto shrink-0 hidden lg:block">{g.rationale}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Current Visit Note — inline below care gaps */}
          {patientId && (
            <VisitNotePanel
              patientId={patientId}
              onSuggestNextSteps={handleSuggestNextSteps}
            />
          )}

          {/* AI Action Recommendations — inline below visit note */}
          <ActionRecommendationsCard
            recommendations={recommendations}
            isLoading={recsLoading}
            error={recsError}
          />

        </div>
      </div>
    </div>
  )
}

