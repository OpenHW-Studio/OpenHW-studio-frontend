import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { sendOtp, verifyOtp } from "../../services/authService.js";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Signal,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Activity,
  ShieldCheck,
  Sparkles,
  Check
} from "lucide-react";
import ThemeToggleSlider from "../../components/ThemeToggleSlider.jsx";

// Presets for the Avatar Builder
const STYLE_PRESETS = [
  { id: "bottts", label: "Robot" },
  { id: "lorelei", label: "Lorelei" },
  { id: "avataaars", label: "Avataaars" },
  { id: "pixel-art", label: "Pixel Art" },
  { id: "adventurer", label: "Adventurer" },
  { id: "micah", label: "Micah" }
];

const SEEDS = [
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta",
  "eta", "theta", "iota", "kappa", "lambda", "mu",
  "nu", "xi", "omicron", "pi", "rho", "sigma"
];

// Helper for vibrant DiceBear avatars served same-origin via backend proxy
export function getDiceBearAvatarUrl(style = "bottts", seed = "alpha") {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
  return `${apiBase}/avatar?style=${encodeURIComponent(style)}&seed=${encodeURIComponent(seed)}`;
}

export default function UserSignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "user" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ── OTP Verification State ───────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState(false);      // Show OTP modal?
  const [otpValue, setOtpValue] = useState("");         // 6-digit code entered by user
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0); // seconds until can resend
  const cooldownRef = useRef(null);

  // Avatar Builder State
  const [styleIndex, setStyleIndex] = useState(0);
  const [avatarStyle, setAvatarStyle] = useState("bottts");
  const [avatarSeed, setAvatarSeed] = useState("alpha");
  const [avatarPage, setAvatarPage] = useState(0);

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

  const getAdjacentIndex = (offset) => {
    const len = STYLE_PRESETS.length;
    return (styleIndex + offset + len) % len;
  };

  const prevStyle = () => {
    const nextIdx = getAdjacentIndex(-1);
    setStyleIndex(nextIdx);
    setAvatarStyle(STYLE_PRESETS[nextIdx].id);
    setAvatarPage(0);
    setAvatarSeed(SEEDS[0]);
  };

  const nextStyle = () => {
    const nextIdx = getAdjacentIndex(1);
    setStyleIndex(nextIdx);
    setAvatarStyle(STYLE_PRESETS[nextIdx].id);
    setAvatarPage(0);
    setAvatarSeed(SEEDS[0]);
  };

  const handleRandomize = () => {
    const randomStyleIdx = Math.floor(Math.random() * STYLE_PRESETS.length);
    const randSeed = "rand-" + Math.random().toString(36).substring(2, 9);
    
    setStyleIndex(randomStyleIdx);
    setAvatarStyle(STYLE_PRESETS[randomStyleIdx].id);
    setAvatarSeed(randSeed);
    setAvatarPage(0);
  };

  const prevPage = () => {
    setAvatarPage((prev) => (prev - 1 + 3) % 3);
  };

  const nextPage = () => {
    setAvatarPage((prev) => (prev + 1) % 3);
  };

  const currentPageSeeds = SEEDS.slice(avatarPage * 6, avatarPage * 6 + 6);

  const handleInputChange = (e) => {
    const value =
      e.target.type === "email" ? e.target.value.trim() : e.target.value;
    setFormData((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const handleUserSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const avatarUrl = getDiceBearAvatarUrl(avatarStyle, avatarSeed);
      await sendOtp({
        ...formData,
        image: avatarUrl,
      });
      // OTP sent — show the OTP entry modal
      setOtpStep(true);
      setOtpValue("");
      setOtpError("");
      setOtpSuccess("");
      startResendCooldown(60);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startResendCooldown = (seconds) => {
    setResendCooldown(seconds);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    setOtpLoading(true);
    setOtpError("");
    setOtpSuccess("");
    try {
      const avatarUrl = getDiceBearAvatarUrl(avatarStyle, avatarSeed);
      await sendOtp({ ...formData, image: avatarUrl });
      setOtpSuccess("A new code has been sent to your email.");
      startResendCooldown(60);
    } catch (err) {
      setOtpError(err.message || "Failed to resend. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpValue.trim().length !== 6) {
      setOtpError("Please enter the full 6-digit code.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const data = await verifyOtp(formData.email, otpValue.trim());
      login(data.token, data.user);
      clearInterval(cooldownRef.current);
      handleRedirect();
    } catch (err) {
      setOtpError(err.message || "Invalid code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpInput = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtpValue(v);
    setOtpError("");
  };

  return (
    <div className="auth-hardware-screen">
      {/* ── OTP Verification Modal Overlay ──────────────────────────────── */}
      {otpStep && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px"
        }}>
          <div style={{
            background: "#0f172a", border: "1px solid #334155",
            borderRadius: "16px", padding: "40px 36px",
            maxWidth: "440px", width: "100%",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6)"
          }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px"
              }}>
                <ShieldCheck style={{ color: "#fff", width: "28px", height: "28px" }} />
              </div>
              <h2 style={{ color: "#f1f5f9", fontSize: "22px", fontWeight: 700, margin: "0 0 8px", fontFamily: "monospace" }}>
                VERIFY EMAIL
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0, lineHeight: 1.6 }}>
                A 6-digit verification code was sent to<br />
                <strong style={{ color: "#38bdf8" }}>{formData.email}</strong>
              </p>
              <p style={{ color: "#64748b", fontSize: "12px", margin: "8px 0 0", lineHeight: 1.4 }}>
                Sent from <span style={{ color: "#94a3b8" }}>openhwservice@gmail.com</span><br />
                <span style={{ fontSize: "11px", color: "#64748b" }}>(Please check your <strong>Spam / Junk</strong> folder if not in inbox)</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{
                  display: "block", fontSize: "11px", color: "#64748b",
                  fontFamily: "monospace", letterSpacing: "2px",
                  textTransform: "uppercase", marginBottom: "8px"
                }}>
                  [VERIFY_CODE // 6 DIGITS]
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpValue}
                  onChange={handleOtpInput}
                  placeholder="• • • • • •"
                  autoFocus
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "#1e293b", border: "1px solid #334155",
                    borderRadius: "8px", padding: "14px 16px",
                    color: "#f1f5f9", fontSize: "28px", fontFamily: "monospace",
                    letterSpacing: "16px", textAlign: "center",
                    outline: "none"
                  }}
                />
              </div>

              {otpError && (
                <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                  ⚠️ {otpError}
                </div>
              )}
              {otpSuccess && (
                <div style={{ color: "#34d399", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>
                  ✓ {otpSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={otpLoading || otpValue.length !== 6}
                style={{
                  width: "100%", padding: "13px",
                  background: otpValue.length === 6 ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "#1e293b",
                  border: "1px solid #334155", borderRadius: "8px",
                  color: "#f1f5f9", fontWeight: 700, fontSize: "14px",
                  fontFamily: "monospace", letterSpacing: "1px",
                  cursor: otpValue.length === 6 ? "pointer" : "not-allowed",
                  marginBottom: "12px", transition: "all 0.2s"
                }}
              >
                {otpLoading ? "Verifying..." : "⚡ VERIFY & CREATE ACCOUNT"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => { setOtpStep(false); setOtpError(""); setOtpSuccess(""); }}
                  style={{
                    background: "none", border: "none", color: "#64748b",
                    fontSize: "12px", fontFamily: "monospace", cursor: "pointer", padding: 0
                  }}
                >
                  ← Edit details
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || otpLoading}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                    color: resendCooldown > 0 ? "#475569" : "#38bdf8",
                    fontSize: "12px", fontFamily: "monospace"
                  }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="auth-hardware-frame">
        {/* Left Panel: Avatar Customizer & Live Preview */}
        <section className="auth-hardware-showcase">
          <div className="avatar-studio-card">
            {/* Studio Header */}
            <div className="avatar-studio-header">
              <div className="avatar-studio-badge">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>AVATAR STUDIO</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ThemeToggleSlider size="sm" />
                <div className="avatar-studio-status">
                  <span className="avatar-pulse-dot"></span>
                  <span>ONLINE</span>
                </div>
              </div>
            </div>

            {/* Avatar Preview Canvas */}
            <div className="avatar-preview-canvas">
              <div className="avatar-preview-halo"></div>
              <img
                src={getDiceBearAvatarUrl(avatarStyle, avatarSeed)}
                alt="Profile Avatar"
                className="avatar-preview-img"
              />
              <button
                type="button"
                onClick={handleRandomize}
                className="avatar-quick-randomize-btn"
                title="Surprise me (Randomize style & avatar)"
              >
                <Shuffle className="w-4 h-4 text-slate-700 dark:text-slate-200" />
              </button>
            </div>

            {/* Selected Style Indicator */}
            <div className="avatar-style-selector-label">
              <span>AVATAR THEME</span>
              <span className="avatar-style-current">{STYLE_PRESETS[styleIndex]?.label}</span>
            </div>

            {/* Style Pills Carousel */}
            <div className="avatar-style-pills">
              {STYLE_PRESETS.map((style, idx) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => {
                    setStyleIndex(idx);
                    setAvatarStyle(style.id);
                    setAvatarPage(0);
                    setAvatarSeed(SEEDS[0]);
                  }}
                  className={`avatar-style-pill ${styleIndex === idx ? "is-active" : ""}`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            {/* Seeds Grid Header & Pagination */}
            <div className="avatar-grid-header">
              <span className="avatar-grid-title">SELECT LOOK</span>
              <div className="avatar-page-controls">
                <button
                  type="button"
                  onClick={prevPage}
                  className="avatar-page-btn"
                  title="Previous variations"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="avatar-page-indicator">{avatarPage + 1} / 3</span>
                <button
                  type="button"
                  onClick={nextPage}
                  className="avatar-page-btn"
                  title="Next variations"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Avatar Selection Grid */}
            <div className="avatar-selection-grid">
              {currentPageSeeds.map((seed) => {
                const isSelected = avatarSeed === seed;
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => setAvatarSeed(seed)}
                    className={`avatar-grid-card ${isSelected ? "is-selected" : ""}`}
                    title={`Variant: ${seed}`}
                  >
                    <img
                      src={getDiceBearAvatarUrl(avatarStyle, seed)}
                      alt={seed}
                      className="avatar-grid-card-img"
                      loading="lazy"
                    />
                    {isSelected && (
                      <span className="avatar-check-badge">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Randomize Action Bar */}
            <button
              type="button"
              onClick={handleRandomize}
              className="avatar-random-btn"
            >
              <Shuffle className="w-4 h-4" />
              <span>Randomize Avatar</span>
            </button>
          </div>
        </section>

        {/* Right Panel: User Registration Form */}
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
              <h2>USER NODE SIGN UP</h2>
              <p>Initialize your credentials to create your user account.</p>
            </header>

            <form className="hardware-form" onSubmit={handleUserSignup}>
              <label className="hardware-field">
                <span className="hardware-label">[USER_IDENT // FULL_NAME]</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Jane Doe"
                  className="hardware-input"
                  style={{ paddingLeft: "12px" }}
                />
              </label>

              <label className="hardware-field">
                <span className="hardware-label">[NET_NODE // EMAIL_ADDRESS]</span>
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
                {loading ? "Registering..." : "REGISTER USER NODE ⚡"}
              </button>
            </form>

            <p className="hardware-panel__footer" style={{ marginTop: "20px" }}>
              Already have a user account?{" "}
              <Link to="/login">Sign In</Link>
            </p>

            <div style={{ marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => navigate("/classroom/signup")}
                className="hardware-alt-btn"
                style={{
                  width: "100%",
                  borderColor: "#0891b2",
                  color: "#0891b2",
                  background: "rgba(8, 145, 178, 0.05)",
                  margin: 0
                }}
              >
                [ GO TO CLASSROOM SIGNUP ]
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
