import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { GamificationProvider } from './context/GamificationContext.jsx'
import { GamificationToasts } from './services/gamification/Gamificationpanel.jsx'
// Pages
import LandingPage from './pages/LandingPage.jsx'
import UserLoginPage from './pages/auth/UserLoginPage.jsx'
import SigninPage from './pages/auth/SigninPage.jsx'
import SignupPage from './pages/auth/signupPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'
import RoleSelectPage from './pages/RoleSelectPage.jsx'
import UserDashboard from './pages/user/UserDashboard.jsx'
import StudentDashboard from './pages/student/StudentDashboard.jsx'
import StudentProfilePage from './pages/student/StudentProfilePage.jsx'
import TeacherDashboard from './pages/teacher/TeacherDashboard.jsx'
import TeacherProfilePage from './pages/teacher/TeacherProfilePage.jsx'
import TeacherClassDetailPage from './pages/teacher/TeacherClassDetailPage.jsx'
import StudentClassDetailPage from './pages/student/StudentClassDetailPage.jsx'
import SimulatorPage from "./pages/simulationpage/SimulatorPage.jsx";
import AdminPage from './pages/admin/AdminPage.jsx'
import AdminLoginPage from './pages/admin/AdminLoginPage.jsx'
import AdminLandingPage from './pages/admin/AdminLandingPage.jsx'
import ProjectAssessmentPage from './pages/ProjectAssessmentPage.jsx'
import ProjectsGallery from './pages/ProjectsGallery.jsx'
import ComponentsPage from './pages/ComponentsPage.jsx'
import ComponentEditorPage from './pages/ComponentEditorPage.jsx'
import AdventureMapPage from './pages/AdventureMapPage.jsx'
import ProjectGuidePage from './pages/ProjectGuidePage.jsx'
import ProjectTheoryPage from './pages/ProjectTheoryPage.jsx'
import ProjectQuizPage from './pages/ProjectQuizPage.jsx'
import ProjectComponentUnlockPage from './pages/ProjectComponentUnlockPage.jsx'
import GuidedSimulatorPage from './pages/GuidedsimulatorPage.jsx'
import TeacherProjectContentEditor from './pages/teacher/TeacherProjectContentEditor.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GamificationProvider>

          {/* Global toast notifications (level-up, badge earned, XP) */}
          <GamificationToasts />

          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<UserLoginPage />} />
            <Route path="/signin" element={<Navigate to="/classroom/signin" replace />} />
            <Route path="/signup" element={<Navigate to="/classroom/signup" replace />} />
            <Route path="/classroom/signin" element={<SigninPage />} />
            <Route path="/classroom/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/select-role" element={<RoleSelectPage />} />

<Route path="/projects" element={<ProjectsGallery />} />
            <Route path="/components" element={<ComponentsPage />} />
            <Route path="/component-editor" element={<ComponentEditorPage />} />
            <Route path="/adventure" element={<AdventureMapPage />} />
            <Route path="/gamification-simulator" element={<Navigate to="/adventure" replace />} />
            {/* Guest accessible simulator */}
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/simulator/live/:liveCode" element={<SimulatorPage />} />
            <Route path="/simulator/share/:shareId" element={<SimulatorPage />} />
            <Route path="/simulator/share/:shareId/assignment/:classId/:assignmentId" element={<SimulatorPage />} />
            <Route path="/:projectName/demo" element={<SimulatorPage />} />
            <Route path="/:projectName/guide" element={<ProjectGuidePage />} />
            <Route path="/:projectName/reading" element={<ProjectTheoryPage />} />
            <Route path="/:projectName/quiz" element={<ProjectQuizPage />} />
            <Route path="/:projectName/components" element={<ProjectComponentUnlockPage />} />
            <Route path="/:projectName/assessment" element={<ProjectAssessmentPage />} />
            <Route path="/:projectName/guided" element={<GuidedSimulatorPage />} />

            {/* Protected: General User */}
            <Route
              path="/user/dashboard"
              element={
                <ProtectedRoute allowedRole="user">
                  <UserDashboard />
                </ProtectedRoute>
              }
            />

            {/* Protected: Student */}
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowedRole="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/classes/:classId"
              element={
                <ProtectedRoute allowedRole="student">
                  <StudentClassDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/profile"
              element={
                <ProtectedRoute allowedRole="student">
                  <StudentProfilePage />
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
            <Route
              path="/teacher/classes/:classId"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <TeacherClassDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/profile"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <TeacherProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/classes/:classId/projects/:projectSlug/edit"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <TeacherProjectContentEditor />
                </ProtectedRoute>
              }
            />


            {/* Admin */}
            <Route path="/admin" element={<AdminLandingPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRole="admin">
                  <AdminPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

      </GamificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
