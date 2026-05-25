/**
 * Format an ISO date string (YYYY-MM-DD) as "Feb 3, 1956".
 * Parses date parts directly to avoid UTC/local timezone offset issues.
 */
export function formatDOB(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  const d = new Date(year, month - 1, day)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
