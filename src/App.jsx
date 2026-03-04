import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'

// Pages
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RoleSelectPage from './pages/RoleSelectPage.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import TeacherDashboard from './pages/TeacherDashboard.jsx'
import SimulatorPage from './pages/SimulatorPage.jsx'
import ProjectGuidePage from './pages/ProjectGuidePage.jsx'
import ProjectAssessmentPage from './pages/ProjectAssessmentPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/select-role" element={<RoleSelectPage />} />
          
          {/* Guest accessible simulator */}
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/:projectName/demo" element={<SimulatorPage />} />
          <Route path="/:projectName/guide" element={<ProjectGuidePage />} />
          <Route path="/:projectName/assessment" element={<ProjectAssessmentPage />} />

          {/* Protected: Student */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected: Teacher */}
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedRoute allowedRole="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
