import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { loginUser } from "../../services/authService.js";
import { Mail, Lock, Eye, EyeOff, ChevronLeft } from "lucide-react";
import AuthLeftShowcase from "./AuthLeftShowcase.jsx";

const lastUsedLogin = localStorage.getItem("lastUsedLogin");

export default function UserLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const from = location.state?.from || null;

  const handleRedirect = () => {
    if (from) {
      navigate(from);
      return;
    }
    navigate("/user/dashboard");
  };

  useEffect(() => {
    if (isAuthenticated) {
      handleRedirect();
    }
  }, [isAuthenticated]);

  const handleInputChange = (e) => {
    const value =
      e.target.type === "email" ? e.target.value.trim() : e.target.value;
    setFormData((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const handleUserLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await loginUser({ ...formData });
      login(data.token, data.user);
      localStorage.setItem("lastUsedLogin", "email");
      handleRedirect();
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRedirect = () => {
    localStorage.setItem("lastUsedLogin", "google");
    if (from) {
      localStorage.setItem("authRedirectPath", from);
    }
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");
    window.location.href =
      baseUrl.replace("/api", "") +
      "/auth/google?origin=" +
      encodeURIComponent(window.location.origin);
  };

  return (
    <div className="auth-hardware-screen">
      <div className="auth-hardware-frame">
        {/* Left Panel: CPU & Telemetry */}
        <AuthLeftShowcase />

        {/* Right Panel: User Login Form */}
        <section className="auth-hardware-panel">
          <div className="hardware-panel-container">
            <div className="hardware-switch-wrapper">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="hardware-switch-btn"
              >
                <span>[PORTAL_SWITCH] → RETURN TO PORTAL DIRECTORY</span>
              </button>
            </div>

            <header className="hardware-panel__header">
              <h2>USER NODE LOGIN</h2>
              <p>Initialize your credentials to access your personal dashboard.</p>
            </header>

            <form className="hardware-form" onSubmit={handleUserLogin}>
              <label className="hardware-field">
                <span className="hardware-label">
                  [NET_NODE // EMAIL_ADDRESS]
                  {lastUsedLogin === "email" && (
                    <span
                      style={{
                        marginLeft: "8px",
                        fontSize: "9px",
                        background: "#dbeafe",
                        color: "#2563eb",
                        padding: "1px 4px",
                        borderRadius: "2px",
                        fontFamily: "monospace"
                      }}
                    >
                      LAST USED
                    </span>
                  )}
                </span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. you@example.com"
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
              </label>

              {error && <div className="auth-form__error">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="hardware-submit-btn"
              >
                {loading ? "Authenticating..." : "AUTHENTICATE USER NODE ⚡"}
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px"
              }}
            >
              <button
                type="button"
                onClick={handleGoogleRedirect}
                disabled={loading}
                className="hardware-alt-btn"
                style={{ margin: 0, width: "100%" }}
              >
                Google {lastUsedLogin === "google" && " (Last)"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (from) navigate(from);
                  else navigate("/simulator");
                }}
                className="hardware-alt-btn"
                style={{ margin: 0, width: "100%" }}
              >
                Guest Session
              </button>
            </div>

            <div style={{ marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => navigate("/classroom/signin")}
                className="hardware-alt-btn"
                style={{
                  width: "100%",
                  borderColor: "#0891b2",
                  color: "#0891b2",
                  background: "rgba(8, 145, 178, 0.05)",
                  margin: 0
                }}
              >
                [ GO TO CLASSROOM LOGIN ]
              </button>
            </div>

            <p className="hardware-panel__footer" style={{ marginTop: "20px" }}>
              Don't have a user account? <Link to="/signup">Create one</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
