import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn } from '@clerk/clerk-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { NavBar } from '@/components/NavBar'
import { LoginAuditBridge } from '@/components/LoginAuditBridge'
import { SchedulePage } from '@/pages/SchedulePage'
import { PatientsPage } from '@/pages/PatientsPage'
import { PatientDashboardPage } from '@/pages/PatientDashboardPage'
import { PatientProfilePage } from '@/pages/PatientProfilePage'
import { ProblemsPage } from '@/pages/ProblemsPage'
import { MedicationsPage } from '@/pages/MedicationsPage'
import { AllergiesPage } from '@/pages/AllergiesPage'
import { CareGapsPage } from '@/pages/CareGapsPage'
import { VitalsPage } from '@/pages/VitalsPage'
import { LabsPage } from '@/pages/LabsPage'
import { VisitHistoryPage } from '@/pages/VisitHistoryPage'
import { ImmunizationsPage } from '@/pages/ImmunizationsPage'
import { NotesPage } from '@/pages/NotesPage'
import { EventsPage } from '@/pages/EventsPage'
import { PanelPage } from '@/pages/PanelPage'

export default function App() {
  return (
    <>
      <LoginAuditBridge />
      <Routes>
      <Route
        path="/login"
        element={
          <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <SignIn fallbackRedirectUrl="/" />
          </div>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <NavBar />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/panel" replace />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/panel" element={<PanelPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:patientId" element={<PatientDashboardPage />} />
        <Route path="/patients/:patientId/profile" element={<PatientProfilePage />} />
        <Route path="/patients/:patientId/problems" element={<ProblemsPage />} />
        <Route path="/patients/:patientId/medications" element={<MedicationsPage />} />
        <Route path="/patients/:patientId/allergies" element={<AllergiesPage />} />
        <Route path="/patients/:patientId/care-gaps" element={<CareGapsPage />} />
        <Route path="/patients/:patientId/vitals" element={<VitalsPage />} />
        <Route path="/patients/:patientId/labs" element={<LabsPage />} />
        <Route path="/patients/:patientId/visit-history" element={<VisitHistoryPage />} />
        <Route path="/patients/:patientId/immunizations" element={<ImmunizationsPage />} />
        <Route path="/patients/:patientId/notes" element={<NotesPage />} />
        <Route element={<AdminRoute />}>
          <Route path="/events" element={<EventsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
