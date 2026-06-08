import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { PatientIdentityStrip } from './PatientIdentityStrip'

interface Props {
  patientId: string
  title: string
  icon: string
  accentClass?: string
  children: ReactNode
}

export function PatientPageLayout({
  patientId,
  title,
  icon,
  accentClass = 'border-l-4 border-l-blue-400',
  children,
}: Props) {
  const navigate = useNavigate()

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={() => navigate(`/patients/${patientId}`, { replace: true })}
        className="text-sm text-blue-500 hover:underline mb-4 inline-block"
      >
        ← Back to Patient Hub
      </button>

      <PatientIdentityStrip patientId={patientId} />

      <div className={`mt-4 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden ${accentClass}`}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-lg leading-none">{icon}</span>
          <h1 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">{title}</h1>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
