import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { loginUser } from "../../services/authService.js";
import { Mail, Lock, Eye, EyeOff, Cpu, Users } from "lucide-react";
import AuthLeftShowcase from "./AuthLeftShowcase.jsx";

export default function SigninPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, user } = useAuth();
  const [selectedRole, setSelectedRole] = useState(
    searchParams.get("role") || "student"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.status === "pending_deletion") {
        navigate("/reactivate");
      } else if (selectedRole === "teacher") {
        navigate("/teacher/dashboard");
      } else if (selectedRole === "student") {
        navigate("/student/dashboard");
      } else {
        navigate("/user/dashboard");
      }
    }
  }, [isAuthenticated, user, navigate, selectedRole]);

  const handleInputChange = (e) => {
    const value =
      e.target.type === "email" ? e.target.value.trim() : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!selectedRole) {
      setError("Please select your role first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await loginUser({ ...formData, role: selectedRole });
      login(data.token, data.user);
      localStorage.setItem("lastUsedLogin", "email");

      if (data.user?.status === "pending_deletion") {
        navigate("/reactivate");
      } else if (selectedRole === "teacher") {
        navigate("/teacher/dashboard");
      } else if (selectedRole === "student") {
        navigate("/student/dashboard");
      } else {
        navigate("/user/dashboard");
      }
    } catch (err) {
      setError(err.message || "Invalid email or password.");
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
      "/auth/google/signup?role=" +
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

              {error && <div className="auth-form__error">{error}</div>}

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
