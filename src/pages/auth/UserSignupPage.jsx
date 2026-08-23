import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { signupUser } from "../../services/authService.js";
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
  Activity
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

      const signupData = {
        ...formData,
        image: avatarUrl,
      };

      const data = await signupUser(signupData);
      login(data.token, data.user);
      handleRedirect();
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-hardware-screen">
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
