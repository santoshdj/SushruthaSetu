import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { apiFetchWithAuth } from '@/lib/api'

function calcAge(birthDate: string): number {
  const today = new Date()
  const bd = new Date(birthDate)
  let age = today.getFullYear() - bd.getFullYear()
  const m = today.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
  return age
}

export function PatientIdentityStrip({ patientId }: { patientId: string }) {
  const { getToken } = useAuth()

  const { data: summary } = useQuery({
    queryKey: ['patient', patientId, 'summary'],
    queryFn: async () => {
      const res = await apiFetchWithAuth(`/patients/${patientId}/summary`, getToken)
      if (!res.ok) throw new Error('Failed to fetch summary')
      return res.json()
    },
    enabled: !!patientId,
  })

  const p = summary?.patient_profile
  if (!p) {
    return <div className="h-12 bg-slate-800 rounded-lg animate-pulse" />
  }

  const name = [p.prefix, p.first_name, p.last_name].filter(Boolean).join(' ')
  const age = p.birth_date ? calcAge(p.birth_date) : null
  const pills = [
    age != null ? `Age ${age}` : null,
    p.gender,
    p.birth_date,
    p.ethnicity,
  ].filter(Boolean) as string[]

  return (
    <div className="bg-slate-800 text-white px-5 py-3 rounded-lg flex items-center gap-4 flex-wrap">
      <span className="font-semibold text-base leading-tight">{name || 'Unknown Patient'}</span>
      <span className="text-slate-500 select-none">|</span>
      {pills.map((pill, i) => (
        <span key={i} className="text-sm text-slate-300 capitalize">{pill}</span>
      ))}
    </div>
  )
}
