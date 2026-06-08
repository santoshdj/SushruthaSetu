interface GuidelineCitation {
  source: string
  text: string
}

interface Recommendation {
  category: 'Medications' | 'Lab Tests' | 'Referrals' | 'Follow-up' | 'Patient Education'
  action: string
  urgency: 'routine' | 'urgent' | 'critical'
  rationale: string
  guideline_citation?: GuidelineCitation
}

interface Props {
  recommendations: Recommendation[] | null
  isLoading: boolean
  error: string | null
  onAddToNote?: (orderBlock: string) => void
}

const CATEGORY_ORDER = ['Medications', 'Lab Tests', 'Referrals', 'Follow-up', 'Patient Education']

const URGENCY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  urgent: 'bg-orange-100 text-orange-700',
  routine: 'bg-gray-100 text-gray-600',
}

export function ActionRecommendationsCard({ recommendations, isLoading, error, onAddToNote }: Props) {
  // Hidden until there's something to show
  if (!isLoading && !error && !recommendations) return null

  // Group by category preserving canonical order
  const grouped: Record<string, Recommendation[]> = {}
  if (recommendations) {
    for (const cat of CATEGORY_ORDER) {
      const items = recommendations.filter(r => r.category === cat)
      if (items.length) grouped[cat] = items
    }
    // Catch any unexpected categories the model returned
    for (const r of recommendations) {
      if (!CATEGORY_ORDER.includes(r.category)) {
        grouped[r.category] = [...(grouped[r.category] ?? []), r]
      }
    }
  }

  const hasResults = Object.keys(grouped).length > 0

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wider">
          ✨ AI Action Recommendations
        </h2>
        {isLoading && (
          <span className="text-xs text-blue-500 animate-pulse">Generating…</span>
        )}
      </div>

      <div className="px-5 pb-5">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-blue-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        {!isLoading && !error && !hasResults && recommendations && (
          <p className="text-gray-500 text-sm">No specific recommendations generated for this note.</p>
        )}

        {!isLoading && hasResults && (
          <div className="space-y-5">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                  {category}
                </h3>
                <ul className="space-y-2">
                  {items.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 bg-white rounded-md px-3 py-2.5 border border-blue-100">
                      <span
                        className={`mt-0.5 shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded uppercase ${
                          URGENCY_STYLES[rec.urgency] ?? URGENCY_STYLES.routine
                        }`}
                      >
                        {rec.urgency}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{rec.action}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{rec.rationale}</p>
                        {rec.guideline_citation && (
                          <p className="text-xs text-indigo-600 mt-1">
                            <span className="inline-block bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 font-semibold mr-1">
                              {rec.guideline_citation.source}
                            </span>
                            {rec.guideline_citation.text}
                          </p>
                        )}
                      </div>
                      {onAddToNote && (rec.category === 'Lab Tests' || rec.category === 'Follow-up') && (
                        <button
                          onClick={() => {
                            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            onAddToNote(`→ Order: ${rec.action}\n   Reason: ${rec.rationale}\n   Date: ${today}`)
                          }}
                          className="shrink-0 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded px-2 py-1 transition-colors"
                          title="Append to current visit note"
                        >
                          + Add to note
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
