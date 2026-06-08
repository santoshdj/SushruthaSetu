import { useNavigate } from 'react-router-dom'

// ─── Types (mirror backend summary shape) ────────────────────────────────────
interface Lab {
  code: string
  value: number
  unit: string
  date: string
  interpretation?: string
  reference_range?: { low?: number; high?: number }
}

interface Vital {
  code: string
  value: number
  unit: string
  date: string
  reference_range?: { low?: number; high?: number }
}

interface Props {
  patientId: string
  labs: Lab[]
  vitals: Vital[]
  followupDue?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
type Status = 'green' | 'amber' | 'red' | 'grey'

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function formatAge(dateStr: string): string {
  const days = daysSince(dateStr)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

// ─── HbA1c status ─ ADA 2024 thresholds ─────────────────────────────────────
function getHba1cStatus(labs: Lab[]) {
  const entry = [...labs]
    .filter(l => /a1c|hba1c|hemoglobin a1c/i.test(l.code))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

  if (!entry) return { value: null, date: null, status: 'grey' as Status, label: 'No data' }

  const days = daysSince(entry.date)
  if (days > 90) return { value: entry.value, date: entry.date, status: 'red' as Status, label: 'Overdue (>3 mo)' }
  if (entry.value < 7.0) return { value: entry.value, date: entry.date, status: 'green' as Status, label: 'Controlled' }
  if (entry.value <= 8.0) return { value: entry.value, date: entry.date, status: 'amber' as Status, label: 'Borderline' }
  return { value: entry.value, date: entry.date, status: 'red' as Status, label: 'Uncontrolled' }
}

// ─── BP status ─ AHA/ACC 2017 thresholds ─────────────────────────────────────
function getBpStatus(vitals: Vital[]) {
  const sysEntry = [...vitals]
    .filter(v => /systolic/i.test(v.code))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
  const diaEntry = [...vitals]
    .filter(v => /diastolic/i.test(v.code))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

  if (!sysEntry) return { sys: null, dia: null, date: null, status: 'grey' as Status, label: 'No data' }

  const sys = sysEntry.value
  const dia = diaEntry?.value ?? null
  const days = daysSince(sysEntry.date)

  if (days > 90) return { sys, dia, date: sysEntry.date, status: 'red' as Status, label: 'Overdue (>3 mo)' }
  if (sys < 130 && (dia === null || dia < 80)) return { sys, dia, date: sysEntry.date, status: 'green' as Status, label: 'Controlled' }
  if (sys <= 140 && (dia === null || dia <= 90)) return { sys, dia, date: sysEntry.date, status: 'amber' as Status, label: 'Borderline' }
  return { sys, dia, date: sysEntry.date, status: 'red' as Status, label: 'Uncontrolled' }
}

// ─── Colour maps ─────────────────────────────────────────────────────────────
const badgeClasses: Record<Status, string> = {
  green: 'bg-green-50 border-green-200 hover:bg-green-100',
  amber: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
  red:   'bg-red-50   border-red-200   hover:bg-red-100',
  grey:  'bg-gray-50  border-gray-200  hover:bg-gray-100',
}

const dotClasses: Record<Status, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
  grey:  'bg-gray-300',
}

const labelClasses: Record<Status, string> = {
  green: 'text-green-700',
  amber: 'text-amber-700',
  red:   'text-red-700',
  grey:  'text-gray-400',
}

// ─── Component ───────────────────────────────────────────────────────────────
export function DiseaseControlStatusStrip({ patientId, labs, vitals, followupDue }: Props) {
  const navigate = useNavigate()
  const hba1c = getHba1cStatus(labs)
  const bp    = getBpStatus(vitals)

  const followupIsOverdue = followupDue ? new Date(followupDue) < new Date(new Date().toDateString()) : false
  const followupFormatted = followupDue
    ? new Date(followupDue + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="mt-3 mb-1" aria-label="Disease control status">
      <div className="flex gap-3">

      {/* ── HbA1c badge ─────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate(`/patients/${patientId}/labs`)}
        title="View Labs"
        className={`flex-1 flex items-center gap-3 rounded-lg border px-4 py-3 text-left cursor-pointer transition-colors ${badgeClasses[hba1c.status]}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClasses[hba1c.status]}`} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
            HbA1c <span className="normal-case font-normal text-gray-400">(ADA 2024)</span>
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {hba1c.value !== null ? `${hba1c.value}%` : '—'}
            {' '}
            <span className={`text-xs font-medium ${labelClasses[hba1c.status]}`}>
              {hba1c.label}
            </span>
          </p>
          {hba1c.date && (
            <p className="text-xs text-gray-400 mt-0.5">{formatAge(hba1c.date)}</p>
          )}
        </div>
      </button>

      {/* ── Blood Pressure badge ─────────────────────────────────────────── */}
      <button
        onClick={() => navigate(`/patients/${patientId}/vitals`)}
        title="View Vitals"
        className={`flex-1 flex items-center gap-3 rounded-lg border px-4 py-3 text-left cursor-pointer transition-colors ${badgeClasses[bp.status]}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClasses[bp.status]}`} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
            Blood Pressure <span className="normal-case font-normal text-gray-400">(AHA/ACC 2017)</span>
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {bp.sys !== null
              ? `${bp.sys}${bp.dia !== null ? `/${bp.dia}` : ''} mmHg`
              : '—'}
            {' '}
            <span className={`text-xs font-medium ${labelClasses[bp.status]}`}>
              {bp.label}
            </span>
          </p>
          {bp.date && (
            <p className="text-xs text-gray-400 mt-0.5">{formatAge(bp.date)}</p>
          )}
        </div>
      </button>

      </div>

      {/* Follow-up date row */}
      {followupDue && (
        <div className={`mt-2 flex items-center gap-2 text-xs px-1 ${
          followupIsOverdue ? 'text-red-600' : 'text-gray-500'
        }`}>
          <span>{followupIsOverdue ? '🔴' : '📅'}</span>
          <span className="font-medium">
            {followupIsOverdue ? 'Follow-up overdue:' : 'Next visit:'}
          </span>
          <span>{followupFormatted}</span>
        </div>
      )}
    </div>
  )
}
