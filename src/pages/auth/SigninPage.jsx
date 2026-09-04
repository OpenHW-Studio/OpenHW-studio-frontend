import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { loginUser } from "../../services/authService.js";
import { Mail, Lock, Eye, EyeOff, Cpu, Users } from "lucide-react";
import AuthLeftShowcase from "./AuthLeftShowcase.jsx";

export default function SigninPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, logout, isAuthenticated, user } = useAuth();
  const [selectedRole, setSelectedRole] = useState(
    searchParams.get("role") || "student"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [wrongPortalRole, setWrongPortalRole] = useState(null); // set when backend returns registeredRole

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // ─── Catch redirect error / role parameters (e.g. from Google OAuth callback) ─
  useEffect(() => {
    const errorParam = searchParams.get("error");
    const regRole = searchParams.get("registeredRole");
    const roleParam = searchParams.get("role");
    if (roleParam && (roleParam === "student" || roleParam === "teacher")) {
      setSelectedRole(roleParam);
    }
    if (errorParam) {
      console.warn('[SigninPage] Received URL error parameter:', errorParam);
      setError(decodeURIComponent(errorParam));
      if (regRole) setWrongPortalRole(regRole);
    }
  }, [searchParams]);

  // ─── Already authenticated guard ────────────────────────────────────────────
  // Runs whenever auth state changes. If user is already logged in:
  //   - Correct tab (student on student tab) → redirect to their dashboard
  //   - Wrong tab (student on teacher tab)   → show error, block form
  useEffect(() => {
    console.log('[SigninPage] useEffect fired | isAuthenticated:', isAuthenticated, '| user.role:', user?.role, '| selectedRole:', selectedRole);
    if (!isAuthenticated) return;

    const dbRole = user?.role;

    if (user?.status === 'pending_deletion') {
      console.log('[SigninPage] → pending deletion, redirecting to /reactivate');
      navigate('/reactivate');
      return;
    }

    if (dbRole === selectedRole || dbRole === 'admin') {
      // Correct portal — redirect to their dashboard
      console.log('[SigninPage] → correct role, redirecting to dashboard');
      if (dbRole === 'teacher') navigate('/teacher/dashboard');
      else if (dbRole === 'student') navigate('/student/dashboard');
      else navigate('/user/dashboard');
    } else {
      // Wrong portal — show error, do NOT redirect
      console.warn('[SigninPage] → role mismatch! DB role is', dbRole, 'but selected tab is', selectedRole, '. Showing warning.');
      setWrongPortalRole(dbRole);
      setError(`This account is registered as a "${dbRole}". You selected the "${selectedRole}" tab. Please switch tabs or log out.`);
    }
  }, [isAuthenticated, user?.role, user?.status, selectedRole]);

  const handleInputChange = (e) => {
    const value = e.target.type === 'email' ? e.target.value.trim() : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  // ─── Email / Password login ───────────────────────────────────────────────
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!selectedRole) { setError('Please select your role first.'); return; }

    console.log('[SigninPage] handleEmailLogin | email:', formData.email, '| requesting role:', selectedRole);
    setLoading(true);
    setError('');
    setWrongPortalRole(null);

    try {
      const data = await loginUser({ ...formData, role: selectedRole });
      console.log('[SigninPage] Backend accepted login | DB role returned:', data.user?.role);

      login(data.token, data.user);
      localStorage.setItem('lastUsedLogin', 'email');

      // Redirect by actual DB role, not the tab
      const dbRole = data.user?.role;
      if (data.user?.status === 'pending_deletion') navigate('/reactivate');
      else if (dbRole === 'teacher') navigate('/teacher/dashboard');
      else if (dbRole === 'student') navigate('/student/dashboard');
      else navigate('/user/dashboard');

    } catch (err) {
      console.error('[SigninPage] Backend BLOCKED login | message:', err.message, '| registeredRole:', err.registeredRole);
      if (err.registeredRole) setWrongPortalRole(err.registeredRole);
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRedirect = () => {
    if (!selectedRole) {
      setError("Please select your role first.");
      return;
    }
    localStorage.setItem("lastUsedLogin", "google");
    localStorage.setItem("authRedirectPath", `/${selectedRole}/dashboard`);
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL || "/api";
    window.location.href =
      baseUrl.replace("/api", "") +
      "/auth/google?role=" +
      selectedRole +
      "&origin=" +
      encodeURIComponent(window.location.origin);
  };

  return (
    <div className="auth-hardware-screen">
      <div className="auth-hardware-frame">
        {/* Left Panel: CPU and Diagnostics Telemetry */}
        <AuthLeftShowcase />

        {/* Right Panel: Sign-in Form */}
        <section className="auth-hardware-panel">
          <div className="hardware-panel-container">
            <div className="hardware-switch-wrapper">
              <button
                type="button"
                onClick={() =>
                  navigate(`/classroom/signup?role=${selectedRole}`)
                }
                className="hardware-switch-btn"
              >
                <span>
                  [PORTAL_SWITCH] → SWITCH TO{" "}
                  {selectedRole === "teacher" ? "INSTRUCTOR" : "STUDENT"} SIGN UP
                </span>
              </button>
            </div>

            <header className="hardware-panel__header">
              <h2>CLASSROOM SIGN IN</h2>
              <p>
                Authenticate your credential tokens to access the OpenHW Studio
                workspace.
              </p>
            </header>

            <form className="hardware-form" onSubmit={handleEmailLogin}>
              {/* Monospaced Role Picker */}
              <div className="hardware-field">
                <span className="hardware-label">
                  [ACCESS_ROLE // SELECT_NODE_TYPE]
                </span>
                <div className="hardware-role-picker">
                  <button
                    type="button"
                    onClick={() => setSelectedRole("student")}
                    className={`hardware-role-btn ${
                      selectedRole === "student" ? "is-active" : ""
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole("teacher")}
                    className={`hardware-role-btn ${
                      selectedRole === "teacher" ? "is-active" : ""
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    Instructor
                  </button>
                </div>
              </div>

              <label className="hardware-field">
                <span className="hardware-label">[NET_NODE // EMAIL_ADDRESS]</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. jane.doe@university.edu"
                  className="hardware-input hardware-input--email"
                />
              </label>

              <label className="hardware-field">
                <span className="hardware-label">[CRYPT_KEY // PASSWORD]</span>
                <div className="hardware-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    placeholder="••••••••••••"
                    className="hardware-input hardware-input--password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hardware-input-toggle"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div style={{ textAlign: "right", marginTop: "4px" }}>
                  <Link
                    to="/forgot-password"
                    style={{
                      fontSize: "11px",
                      fontFamily: "monospace",
                      color: "#2563eb",
                      textDecoration: "none"
                    }}
                  >
                    [ FORGOT CRYPT_KEY? ]
                  </Link>
                </div>
              </label>

              {error && (
                <div className="auth-form__error" style={{ lineHeight: "1.6" }}>
                  <div>{error}</div>
                  {wrongPortalRole && (
                    <div style={{ marginTop: "10px", fontSize: "12px" }}>
                      {wrongPortalRole === "user" ? (
                        <Link to="/login" style={{ color: "#38bdf8", fontWeight: "bold", textDecoration: "underline" }}>
                          → Go to User Node portal (/login)
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRole(wrongPortalRole);
                            setError("");
                            setWrongPortalRole(null);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            color: "#38bdf8",
                            fontWeight: "bold",
                            textDecoration: "underline",
                            cursor: "pointer"
                          }}
                        >
                          → Switch to {wrongPortalRole === "teacher" ? "Instructor" : "Student"} tab
                        </button>
                      )}

                      {isAuthenticated && (
                        <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (wrongPortalRole === 'teacher') navigate('/teacher/dashboard');
                              else if (wrongPortalRole === 'student') navigate('/student/dashboard');
                              else navigate('/user/dashboard');
                            }}
                            className="hardware-submit-btn"
                            style={{ flex: 1, padding: "8px", fontSize: "11px", background: "#0284c7", margin: 0 }}
                          >
                            Go to {wrongPortalRole} Dashboard
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await logout();
                              setWrongPortalRole(null);
                              setError("");
                            }}
                            className="hardware-alt-btn"
                            style={{ flex: 1, padding: "8px", fontSize: "11px", borderColor: "#ef4444", color: "#ef4444", margin: 0 }}
                          >
                            Log Out of Session
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !selectedRole}
                className="hardware-submit-btn"
              >
                {loading
                  ? "Authenticating..."
                  : `AUTHENTICATE ${
                      selectedRole === "teacher" ? "INSTRUCTOR" : "STUDENT"
                    } NODE ⚡`}
              </button>
            </form>

            <div
              className="auth-divider"
              style={{
                color: "#64748b",
                borderColor: "#e2e8f0",
                fontFamily: "monospace",
                fontSize: "11px",
                margin: "16px 0"
              }}
            >
              <span>or continue with</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleRedirect}
              className={`hardware-alt-btn ${!selectedRole ? "is-disabled" : ""}`}
              disabled={!selectedRole || loading}
            >
              Google Authentication
            </button>

            <p className="hardware-panel__footer">
              Don't have a classroom account?{" "}
              <Link to="/classroom/signup">Create one</Link>
            </p>

            <p className="hardware-panel__footer" style={{ marginTop: "6px" }}>
              Want to login with a user account? <Link to="/login">User Login</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
