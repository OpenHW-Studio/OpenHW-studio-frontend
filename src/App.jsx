import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import AppLayout from './components/Layout/AppLayout.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'

// Pages
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RoleSelectPage from './pages/RoleSelectPage.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import TeacherDashboard from './pages/TeacherDashboard.jsx'
import SimulatorPage from './pages/SimulatorPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
  <Routes>

  {/* PUBLIC ROUTES (No Layout) */}
  <Route path="/" element={<LandingPage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/select-role" element={<RoleSelectPage />} />

  {/* ROUTES WITH GLOBAL LAYOUT */}
  <Route element={<AppLayout />}>

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

  </Route>

  {/* Fallback */}
  <Route path="*" element={<Navigate to="/" replace />} />

</Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
