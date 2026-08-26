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
  ShieldCheck
} from "lucide-react";

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
  return `/api/avatar?style=${encodeURIComponent(style)}&seed=${encodeURIComponent(seed)}`;
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

          <div className="hardware-card">
            <div className="hardware-card__header">
              <span>LIVE PROFILE PREVIEW</span>
              <span className="hardware-card__signal">
                <Signal className="w-3.5 h-3.5 animate-pulse" />
                <span>ONLINE</span>
              </span>
            </div>
            
            <div className="hardware-card__preview-area">
              <img
                src={getDiceBearAvatarUrl(avatarStyle, avatarSeed)}
                alt="Profile Preview"
                className="hardware-card__avatar"
              />
              <div className="hardware-card__chip-icon">
                <Cpu className="w-4 h-4 text-orange-600 animate-pulse" />
              </div>
            </div>
            
            <div className="hardware-card__footer">
              <span>ID: PENDING_GEN</span>
              <span>V.1.0.4</span>
            </div>
          </div>

          {/* Interactive Tabs Slider */}
          <div className="hardware-tabs-wrapper">
            <button
              type="button"
              onClick={prevStyle}
              className="hardware-slider-btn"
              title="Previous Style"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="hardware-tabs-slider">
              {/* Adjacent Left Tab */}
              <button
                type="button"
                onClick={prevStyle}
                className="hardware-tab-slide is-adjacent"
              >
                {STYLE_PRESETS[getAdjacentIndex(-1)].label.toUpperCase()}
              </button>

              {/* Active Tab */}
              <button
                type="button"
                className="hardware-tab-slide is-active"
              >
                {STYLE_PRESETS[styleIndex].label.toUpperCase()}
              </button>

              {/* Adjacent Right Tab */}
              <button
                type="button"
                onClick={nextStyle}
                className="hardware-tab-slide is-adjacent"
              >
                {STYLE_PRESETS[getAdjacentIndex(1)].label.toUpperCase()}
              </button>
            </div>

            <button
              type="button"
              onClick={nextStyle}
              className="hardware-slider-btn"
              title="Next Style"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Customizer Option Grid with Arrows */}
          <div className="hardware-grid-wrapper">
            <button
              type="button"
              onClick={prevPage}
              className="hardware-slider-btn"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="hardware-grid">
              {currentPageSeeds.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  onClick={() => setAvatarSeed(seed)}
                  className={`hardware-grid-item ${avatarSeed === seed ? "is-selected" : ""}`}
                  title={`Seed: ${seed}`}
                >
                  <img
                    src={getDiceBearAvatarUrl(avatarStyle, seed, 40)}
                    alt={seed}
                    className="w-10 h-10 object-contain"
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={nextPage}
              className="hardware-slider-btn"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Randomize Button */}
          <button
            type="button"
            onClick={handleRandomize}
            className="hardware-random-btn"
          >
            <Shuffle className="w-3.5 h-3.5" />
            [ RANDOMIZE AVATAR ]
          </button>

          {/* Diagnostic Telemetry Display */}
          <div 
            style={{
              width: "100%",
              maxWidth: "320px",
              background: "rgba(30, 41, 59, 0.9)",
              border: "1px solid #475569",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "11px",
              color: "#38bdf8",
              fontFamily: "monospace",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }}
          >
            <div className="flex justify-between border-b border-slate-700 pb-1.5 mb-1.5 text-slate-300">
              <span className="font-bold flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-emerald-400" />AVATAR MODULE DIAGNOSTIC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">[BASE_STYLE]</span>
              <span className="text-emerald-400 font-bold uppercase">{avatarStyle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">[SEED_VAL]</span>
              <span>{avatarSeed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">[ACTIVE_PAGE]</span>
              <span className="text-amber-400">PAGE {avatarPage + 1} / 3</span>
            </div>
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
