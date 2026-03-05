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
import AdminPage from './pages/admin/AdminPage.jsx'
import AdminLoginPage from './pages/admin/AdminLoginPage.jsx'
import AdminLandingPage from './pages/admin/AdminLandingPage.jsx'

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

          {/* Admin Workflow */}
          <Route path="/admin" element={<AdminLandingPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRole="admin">
              <AdminPage />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
