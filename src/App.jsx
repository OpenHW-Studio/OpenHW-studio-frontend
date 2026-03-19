import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

import LandingPage from "./pages/LandingPage.jsx";
import SigninPage from "./pages/auth/SigninPage.jsx";
import RoleSelectPage from "./pages/RoleSelectPage.jsx";
import StudentDashboard from "./pages/student/StudentDashboard.jsx";
import TeacherDashboard from "./pages/teacher/TeacherDashboard.jsx";
import TeacherClassDetailPage from "./pages/teacher/TeacherClassDetailPage.jsx";
import StudentClassDetailPage from "./pages/student/StudentClassDetailPage.jsx";
import SimulatorPage from "./pages/simulationpage/SimulationPage.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";
import AdminLoginPage from "./pages/admin/AdminLoginPage.jsx";
import AdminLandingPage from "./pages/admin/AdminLandingPage.jsx";
import ProjectGuidePage from "./pages/ProjectGuidePage.jsx";
import ProjectAssessmentPage from "./pages/ProjectAssessmentPage.jsx";
import SignupPage from "./pages/auth/signupPage.jsx";
import ComponentEditorPage from "./pages/ComponentEditorPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<SigninPage />} />
          <Route path="/select-role" element={<RoleSelectPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/component-editor" element={<ComponentEditorPage />} />
          <Route path="/:projectName/demo" element={<SimulatorPage />} />
          <Route path="/:projectName/guide" element={<ProjectGuidePage />} />
          <Route
            path="/:projectName/assessment"
            element={<ProjectAssessmentPage />}
          />

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
