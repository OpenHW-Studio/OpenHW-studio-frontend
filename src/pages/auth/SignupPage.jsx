import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { signupUser } from "../../services/authService.js";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Signal,
  Cpu,
  Activity,
  Users,
  Award,
  Shuffle,
  ChevronLeft,
  ChevronRight
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

export default function SignupPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Avatar Builder State
  const [styleIndex, setStyleIndex] = useState(0);
  const [avatarStyle, setAvatarStyle] = useState("bottts");
  const [avatarSeed, setAvatarSeed] = useState("alpha");
  const [avatarPage, setAvatarPage] = useState(0);

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

  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") === "teacher" || searchParams.get("role") === "instructor" ? "teacher" : "student";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: initialRole,
    college: "",
    semester: "",
    bio: "",
    image: "",
  });

  useEffect(() => {
    if (isAuthenticated) {
      if (formData.role === "teacher") navigate("/teacher/dashboard");
      else if (formData.role === "student") navigate("/student/dashboard");
      else navigate("/user/dashboard");
    }
  }, [isAuthenticated, formData.role, navigate]);

  const handleInputChange = (e) => {
    const value =
      e.target.type === "email" ? e.target.value.trim() : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const imageUrl = getDiceBearAvatarUrl(avatarStyle, avatarSeed);
      const data = await signupUser({
        ...formData,
        image: imageUrl,
        avatarSeed,
        avatarStyle,
      });
      login(data.token, data.user);
      
      if (data.user.role === "teacher") navigate("/teacher/dashboard");
      else if (data.user.role === "student") navigate("/student/dashboard");
      else navigate("/user/dashboard");
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

        {/* Right Panel: Signup Form */}
        <section className="auth-hardware-panel">
          <div className="hardware-panel-container">
            
            <div className="hardware-switch-wrapper">
              <button
                type="button"
                onClick={() => navigate(`/classroom/signin?role=${formData.role}`)}
                className="hardware-switch-btn"
              >
                <span>[PORTAL_SWITCH] → SWITCH TO {formData.role === "teacher" ? "INSTRUCTOR" : "STUDENT"} SIGN IN</span>
              </button>
            </div>

            <header className="hardware-panel__header">
              <h2>INITIALIZE {formData.role === "teacher" ? "INSTRUCTOR" : "STUDENT"} NODE</h2>
              <p>Configure your access parameters for the OpenHW Studio simulation environment.</p>
            </header>

            <form className="hardware-form" onSubmit={handleSignup}>
              
              {/* Monospaced Role Picker */}
              <div className="hardware-field">
                <span className="hardware-label">[ACCESS_ROLE // SELECT_NODE_TYPE]</span>
                <div className="hardware-role-picker">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: "student" })}
                    className={`hardware-role-btn ${formData.role === "student" ? "is-active" : ""}`}
                  >
                    <Users className="w-4 h-4" />
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: "teacher" })}
                    className={`hardware-role-btn ${formData.role === "teacher" ? "is-active" : ""}`}
                  >
                    <Cpu className="w-4 h-4" />
                    Instructor
                  </button>
                </div>
              </div>

              <label className="hardware-field">
                <span className="hardware-label">[SYS_ID // FULL_NAME]</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder={formData.role === "teacher" ? "e.g. Dr. Jane Doe" : "e.g. Jane Doe"}
                  className="hardware-input hardware-input--name"
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
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>

              {formData.role === "student" && (
                <div 
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px"
                  }}
                >
                  <label className="hardware-field">
                    <span className="hardware-label">[CAMPUS // INSTITUTION_NAME]</span>
                    <input
                      type="text"
                      name="college"
                      value={formData.college}
                      onChange={handleInputChange}
                      placeholder="e.g. Stanford University"
                      className="hardware-input"
                    />
                  </label>

                  <label className="hardware-field">
                    <span className="hardware-label">[TERM_ID // SEMESTER]</span>
                    <input
                      type="text"
                      name="semester"
                      value={formData.semester}
                      onChange={handleInputChange}
                      placeholder="e.g. Semester 3"
                      className="hardware-input"
                    />
                  </label>
                </div>
              )}

              <div className="hardware-checkbox-wrapper">
                <input
                  type="checkbox"
                  id="terms"
                  required
                  className="hardware-checkbox"
                />
                <label htmlFor="terms" className="hardware-checkbox-label">
                  I acknowledge the strict compliance requirements of the OpenHW Group Academic Terms and verify my eligibility for {formData.role === "teacher" ? "Instructor" : "Student"} access.
                </label>
              </div>

              {error && <div className="auth-form__error">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="hardware-submit-btn"
              >
                {loading ? "Initializing..." : `BUILD ${formData.role === "teacher" ? "INSTRUCTOR" : "STUDENT"} COMPONENT 🛠️`}
              </button>

            </form>

            <p className="hardware-panel__footer">
              Already have {formData.role === "teacher" ? "an Instructor" : "a Student"} account?{" "}
              <Link to={`/classroom/signin?role=${formData.role}`}>Login</Link>
            </p>

          </div>
        </section>
      </div>
    </div>
  );
}
