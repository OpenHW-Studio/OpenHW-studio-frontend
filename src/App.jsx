import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useIsMobile } from "./hooks/useIsMobile";

import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { GamificationProvider } from "./context/GamificationContext.jsx";
import { GamificationToasts } from "./services/gamification/Gamificationpanel.jsx";
// Pages
import LandingPage from "./pages/LandingPage.jsx";
import UserLoginPage from "./pages/auth/UserLoginPage.jsx";
import UserSignupPage from "./pages/auth/UserSignupPage.jsx";
import ReactivationPage from "./pages/auth/ReactivationPage.jsx";

import RoleSelectPage from "./pages/RoleSelectPage.jsx";
import ProjectTheoryPage from "./pages/ProjectTheoryPage.jsx";
import ProjectQuizPage from "./pages/ProjectQuizPage.jsx";
import ProjectComponentUnlockPage from "./pages/ProjectComponentUnlockPage.jsx";
import TeacherProjectContentEditor from "./pages/teacher/TeacherProjectContentEditor.jsx";
import TeacherProjectBankPage from "./pages/teacher/TeacherProjectBankPage.jsx";
// Lazy-loaded routes to drastically improve LCP
import ExamplesPage from "./pages/ExamplesPage.jsx";
import SigninPage from "./pages/auth/SigninPage.jsx";
import SignupPage from "./pages/auth/SignupPage.jsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.jsx";
import AuthSuccess from "./pages/auth/AuthSuccess.jsx";
import UserDashboard from "./pages/user/UserDashboard.jsx";
import UserProfilePage from "./pages/user/UserProfilePage.jsx";
import StudentDashboard from "./pages/student/StudentDashboard.jsx";
import StudentProfilePage from "./pages/student/StudentProfilePage.jsx";
import TeacherDashboard from "./pages/teacher/TeacherDashboard.jsx";
import TeacherProfilePage from "./pages/teacher/TeacherProfilePage.jsx";
import TeacherClassDetailPage from "./pages/teacher/TeacherClassDetailPage.jsx";
import StudentClassDetailPage from "./pages/student/StudentClassDetailPage.jsx";

const SimulatorPage = React.lazy(
  () => import("./pages/simulationpage/SimulatorPage.jsx"),
);
import AdminPage from "./pages/admin/AdminPage.jsx";
import AdminLoginPage from "./pages/admin/AdminLoginPage.jsx";
import AdminLandingPage from "./pages/admin/AdminLandingPage.jsx";
import ProjectAssessmentPage from "./pages/ProjectAssessmentPage.jsx";
import ProjectsGallery from "./pages/ProjectsGallery.jsx";
import ComponentsPage from "./pages/ComponentsPage.jsx";
import ComponentEditorPage from "./pages/ComponentEditorPage.jsx";
import AdventureMapPage from "./pages/AdventureMapPage.jsx";
const ProjectGuidePage = React.lazy(
  () => import("./pages/ProjectGuidePage.jsx"),
);
import ExploreCommunity from "./pages/ExploreCommunity.jsx";
const GuidedSimulatorPage = React.lazy(
  () => import("./pages/GuidedSimulatorPage.jsx"),
);
const MobileSimulatorPage = React.lazy(
  () => import("./pages/mobileui/SimulatorPage.jsx"),
);
import ComponentLab from "./pages/simulationpage/ComponentLab.jsx";
const GradingPage = React.lazy(() => import("./pages/GradingPage.jsx"));
import MaintenancePage from "./pages/MaintenancePage.jsx";
import AboutUsNew from "./pages/AboutUsNewPage.jsx";
import ContributorsPage from "./pages/ContributorsPage.jsx";
const ComponentStatusPage = React.lazy(() => import("./pages/ComponentStatusPage.jsx"));
import VisitorTracker from "./components/VisitorTracker.jsx";
import BetaBanner from "./components/BetaBanner.jsx";
import ThemeToggleSlider from "./components/ThemeToggleSlider.jsx";

import { fetchMaintenanceStatus } from "./services/simulatorService.js";
import axios from "axios";

const ResponsiveSimulatorRoute = ({ desktopElement, mobileElement }) => {
  const isMobile = useIsMobile();
  const location = useLocation();

  // If embedded in an iframe (e.g. Project Guide canvas), always render desktopElement without redirect
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.get("canvas-only") === "1") {
    return desktopElement;
  }

  // Only handle explicit root simulator path redirects
  if (location.pathname === "/simulator" && isMobile) {
    return <Navigate to={`/mobile-simulator${location.search}`} replace />;
  }
  if (location.pathname === "/mobile-simulator" && !isMobile) {
    return <Navigate to={`/simulator${location.search}`} replace />;
  }

  return isMobile ? mobileElement : desktopElement;
};

const MaintenanceGuard = ({ children }) => {
  const [maintenance, setMaintenance] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/admin");

  const { logout, adminLogout } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const isMaint = await fetchMaintenanceStatus();
      if (isMounted) {
        setMaintenance(isMaint);
        setChecking(false);
      }
    };

    check();
    const interval = setInterval(check, 30000); // Check every 30s

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const reqUrl = error.config?.url || "";

        if (error.response?.status === 401 && reqUrl.includes("/api")) {
          const isAdm = location.pathname.startsWith("/admin");
          const message = error.response.data?.message || "";

          if (
            message.toLowerCase().includes("expired") ||
            message.toLowerCase().includes("invalid") ||
            message.toLowerCase().includes("no token")
          ) {
            if (isMounted) {
              if (isAdm) adminLogout();
              else logout();

              if (!window.__sessionExpiredAlertShown) {
                window.__sessionExpiredAlertShown = true;
                alert("Your session has expired. Please log in again.");
                setTimeout(() => { window.__sessionExpiredAlertShown = false; }, 3000);
              }
              navigate(isAdm ? "/admin/login" : "/login");
            }
          }
        } else if (!error.response || error.response.status === 503) {
          // Only trigger maintenance mode for API requests
          if (isMounted && reqUrl.includes("/api")) {
            setMaintenance(true);
          }
        }
        return Promise.reject(error);
      },
    );

    return () => {
      isMounted = false;
      clearInterval(interval);
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  if (maintenance && !isAdminPath) {
    return <MaintenancePage />;
  }

  return children;
};

function ThemeToggleButton() {
  const location = useLocation();
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hide on simulator or demo/guided pages
  const isSimulator = location.pathname.includes('/simulator') ||
    location.pathname.includes('/demo') ||
    location.pathname.includes('/guided');
  if (isSimulator) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? '84px' : '24px',
        right: '24px',
        zIndex: 9999,
        filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.28))',
      }}
    >
      <ThemeToggleSlider size="md" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <VisitorTracker>
        <AuthProvider>
          <GamificationProvider>
            <MaintenanceGuard>
              {/* Beta development notice banner */}
              <BetaBanner />
              {/* Global toast notifications (level-up, badge earned, XP) */}
              <GamificationToasts />
              <ThemeToggleButton />

              <React.Suspense
                fallback={
                  <div
                    style={{
                      height: "100vh",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div className="loader"></div>
                  </div>
                }
              >
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/about" element={<AboutUsNew />} />
                  <Route path="/contributors" element={<ContributorsPage />} />
                  <Route path="/components-status" element={<ComponentStatusPage />} />
                  <Route path="/status" element={<Navigate to="/components-status" replace />} />
                  <Route path="/examples" element={<ExamplesPage />} />
                  <Route path="/login" element={<UserLoginPage />} />
                  <Route path="/signup" element={<UserSignupPage />} />
                  <Route path="/user/signup" element={<UserSignupPage />} />
                  <Route path="/reactivate" element={<ReactivationPage />} />
                  <Route
                    path="/signin"
                    element={<Navigate to="/classroom/signin" replace />}
                  />
                  <Route
                    path="/classroom/signin"
                    element={<SigninPage />}
                  />
                  <Route
                    path="/classroom/signup"
                    element={<SignupPage />}
                  />
                  <Route
                    path="/forgot-password"
                    element={<ForgotPasswordPage />}
                  />
                  <Route
                    path="/reset-password/:token"
                    element={<ResetPasswordPage />}
                  />
                  <Route path="/select-role" element={<RoleSelectPage />} />

                  <Route path="/login-success" element={<AuthSuccess />} />

                  <Route path="/projects" element={<ProjectsGallery />} />
                  <Route path="/components" element={<ComponentsPage />} />
                  <Route
                    path="/component-editor"
                    element={<ComponentEditorPage />}
                  />
                  <Route path="/alignment-lab" element={<ComponentLab />} />

                  <Route path="/adventure" element={<AdventureMapPage />} />
                  <Route path="/grade" element={<GradingPage />} />

                  {/* Guest accessible simulator */}
                  <Route
                    path="/simulator"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />
                  <Route
                    path="/mobile-simulator"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />

                  <Route
                    path="/simulator/live/:liveCode"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />
                  <Route
                    path="/mobile-simulator/live/:liveCode"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />

                  <Route
                    path="/simulator/share/:shareId"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />
                  <Route
                    path="/mobile-simulator/share/:shareId"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />

                  <Route
                    path="/simulator/share/:shareId/assignment/:classId/:assignmentId"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />
                  <Route
                    path="/simulator/assignment/:classId/:assignmentId"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />
                  <Route
                    path="/mobile-simulator/share/:shareId/assignment/:classId/:assignmentId"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />

                  <Route path="/explore" element={<ExploreCommunity />} />

                  <Route
                    path="/:projectName/demo"
                    element={
                      <ResponsiveSimulatorRoute
                        desktopElement={<SimulatorPage />}
                        mobileElement={<MobileSimulatorPage />}
                      />
                    }
                  />

                  <Route
                    path="/guide"
                    element={<Navigate to="/led-blink/guide" replace />}
                  />

                  <Route
                    path="/:projectName/guide"
                    element={<ProjectGuidePage />}
                  />

                  <Route
                    path="/:projectName/assessment"
                    element={<ProjectAssessmentPage />}
                  />
                  <Route
                    path="/:projectName/reading"
                    element={<ProjectTheoryPage />}
                  />
                  <Route
                    path="/:projectName/quiz"
                    element={<ProjectQuizPage />}
                  />
                  <Route
                    path="/:projectName/components"
                    element={<ProjectComponentUnlockPage />}
                  />
                  <Route
                    path="/:projectName/guided"
                    element={<GuidedSimulatorPage />}
                  />

                  {/* Protected: General User */}
                  <Route
                    path="/user/dashboard"
                    element={
                      <ProtectedRoute allowedRole="user">
                        <UserDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user/profile"
                    element={
                      <ProtectedRoute allowedRole="user">
                        <UserProfilePage />
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
                    path="/teacher/classes/:classId/projects/:projectSlug/edit"
                    element={
                      <ProtectedRoute allowedRole="teacher">
                        <TeacherProjectContentEditor />
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
                    path="/teacher/project-bank"
                    element={
                      <ProtectedRoute allowedRole="teacher">
                        <TeacherProjectBankPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teacher/project-bank/new"
                    element={
                      <ProtectedRoute allowedRole="teacher">
                        <TeacherProjectContentEditor />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teacher/project-bank/:projectSlug/edit"
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
              </React.Suspense>
            </MaintenanceGuard>
          </GamificationProvider>
        </AuthProvider>
      </VisitorTracker>
    </BrowserRouter>
  );
}
