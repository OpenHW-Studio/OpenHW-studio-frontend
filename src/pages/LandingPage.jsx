import { useState, useMemo, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PublicNavbar from "../components/PublicNavbar.jsx";
import { PROJECTS } from "../services/gamification/ProjectsConfig.js";
import GUIDED_JSON from "../services/guidedProjects.json";
const DOCS_URL =
  import.meta.env.VITE_DOCS_URL || "https://openhw-studio.fossee.in/docs/";

const EXAMPLES_BASE_URL =
  import.meta.env.VITE_EXAMPLES_BASE_URL || '/api/examples';

// JSON slug → URL slug for projects where they differ
const JSON_SLUG_TO_URL = {
  "rgb-led-blink": "rgb-led",
};

// Maps every project slug → { folder, file } in the examples repo
// folder/file must match exactly what's served under EXAMPLES_BASE_URL
const CIRCUIT_IMAGE_MAP = {
  // exact matches (folder name === slug)
  'led-blink':               { folder: 'led-blink',               file: 'circuit.png' },
  'rgb-led':                 { folder: 'rgb-led',                 file: 'circuit.png' },
  'rgb-led-blink':           { folder: 'rgb-led-blink',           file: 'circuit.png' },
  'rgb-led-serial':          { folder: 'rgb-led-serial',          file: 'circuit.png' },
  'rgb-led-3-buttons':       { folder: 'rgb-led-3-buttons',       file: 'circuit.png' },
  'button-debounce':         { folder: 'button-debounce',         file: 'circuit.png' },
  'button-led':              { folder: 'button-led',              file: 'circuit.png' },
  'potentiometer-led':       { folder: 'potentiometer-led',       file: 'circuit.png' },
  'servo-motor':             { folder: 'servo-motor',             file: 'circuit.png' },
  'servo-potentiometer':     { folder: 'servo-potentiometer',     file: 'circuit.png' },
  'temperature-sensor':      { folder: 'temperature-sensor',      file: 'circuit.png' },
  'temperature-rgb-led':     { folder: 'temperature-rgb-led',     file: 'circuit.png' },
  'dc-motor-l293d':          { folder: 'dc-motor-l293d',          file: 'circuit.png' },
  'dc-motor-pwm':            { folder: 'dc-motor-pwm',            file: 'circuit.png' },
  'led-strip':               { folder: 'led-strip',               file: 'circuit.png' },
  'ldr-automatic-light':     { folder: 'ldr-automatic-light',     file: 'circuit.png' },
  'gas-sensor-led':          { folder: 'gas-sensor-led',          file: 'circuit.png' },
  'motion-sensor-alarm':     { folder: 'motion-sensor-alarm',     file: 'circuit.png' },
  'obstacle-avoiding-robot': { folder: 'obstacle-avoiding-robot', file: 'circuit.png' },
  'smart-dustbin':           { folder: 'smart-dustbin',           file: 'circuit.png' },
  'smart-home-automation':   { folder: 'smart-home-automation',   file: 'circuit.png' },
  'smart-street-light':      { folder: 'smart-street-light',      file: 'circuit.png' },
  'water-level-indicator':   { folder: 'water-level-indicator',   file: 'circuit.png' },
  'auto-fan-speed':          { folder: 'auto-fan-speed',          file: 'circuit.png' },
  'lcd-scrolling-text':      { folder: 'lcd-scrolling-text',      file: 'circuit.png' },
  'ultrasonic-distance':     { folder: 'ultrasonic-distance',     file: 'circuit.png' },
  'traffic-light':           { folder: 'traffic-light',           file: 'circuit.png' },
  'up-counter':              { folder: 'up-counter',              file: 'circuit.png' },
  'up-down-counter':         { folder: 'up-down-counter',         file: 'circuit.png' },
  // slug differs from folder name
  'buzzer':                  { folder: 'Turn_on_Buzzer',          file: 'Turn_on_Buzzer.png' },
  'ldr':                     { folder: 'ldr-automatic-light',     file: 'circuit.png' },
  '7-segment-display':       { folder: '7-segment-display',       file: 'circuit.png' },
  '7-segment-counter':       { folder: '7-segment-display',       file: 'circuit.png' },
  'ir-remote-control-system':{ folder: 'ir-remote-control-system',file: 'circuit.png' },
  'ir-remote-control':       { folder: 'ir-remote-control-system',file: 'circuit.png' },
  // no dedicated folder — use closest equivalent
  'led-pwm':                 { folder: 'potentiometer-led',       file: 'circuit.png' },
  'dht-lcd':                 { folder: 'temperature-rgb-led',     file: 'circuit.png' },
  'line-following-robot':    { folder: 'obstacle-avoiding-robot', file: 'circuit.png' },
  'bluetooth-hc05':          { folder: 'smart-home-automation',   file: 'circuit.png' },
  'rf-remote-control':       { folder: 'ir-remote-control-system',file: 'circuit.png' },
  'wifi-led-control':        { folder: 'smart-home-automation',   file: 'circuit.png' },
  'communication-protocols': { folder: 'button-led',              file: 'circuit.png' },
};

// Resolve circuit image URL for a given slug
function getCircuitImageUrl(slug, baseUrl) {
  const entry = CIRCUIT_IMAGE_MAP[slug];
  if (entry) return `${baseUrl}/${entry.folder}/${entry.file}`;
  // fallback: try slug/circuit.png directly
  return `${baseUrl}/${slug}/circuit.png`;
}

const PREFERRED_SLUGS = [
  "led-blink", "rgb-led", "buzzer", "potentiometer", "ldr",
  "button-debounce", "traffic-light", "led-pwm", "lcd-scrolling-text",
];

const PROJECT_ICONS = {};
for (const p of PROJECTS) {
  PROJECT_ICONS[p.slug] = p.icon || "🔌";
}

const LEVEL_ORDER = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const LEVEL_LABELS = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark",
  );
  const [editorMode, setEditorMode] = useState(
    () => localStorage.getItem("openhw_demo_editor_mode") || "code"
  );
  const [imageErrors, setImageErrors] = useState({});

  const handleEditorModeChange = (mode) => {
    setEditorMode(mode);
    localStorage.setItem("openhw_demo_editor_mode", mode);
  };

  const allCards = useMemo(() => {
    const cards = [];
    for (const level of LEVEL_ORDER) {
      const levelData = GUIDED_JSON[level];
      if (!levelData) continue;
      const levelLabel = LEVEL_LABELS[level] || level;
      for (const cat of Object.values(levelData.categories)) {
        for (const p of cat.projects) {
          const urlSlug = JSON_SLUG_TO_URL[p.slug] || p.slug;
          cards.push({
            slug: urlSlug,
            title: p.title,
            board: p.board,
            difficulty: levelLabel,
            xp: 100,
          });
        }
      }
    }
    return cards;
  }, []);
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme); // Save choice
  };

  const handleNavigate = (path) => {
    navigate(path);
  };

  const handleDashboard = () => {
    if (role === "teacher") handleNavigate("/teacher/dashboard");
    else if (role === "student") handleNavigate("/student/dashboard");
    else handleNavigate("/user/dashboard");
  };

  return (
    <div className="landing">
      <PublicNavbar
        links={[
          { label: "About Us",  path: "/about" },
          { label: "Examples",  path: "/examples" },
        ]}
        actions={
          isAuthenticated ? (
            <button className="btn btn-primary" onClick={handleDashboard}>
              Dashboard →
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => handleNavigate("/login")}>
                Log In
              </button>
              <button className="btn btn-primary" onClick={() => handleNavigate("/signup")}>
                Get Started
              </button>
            </>
          )
        }
      />

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">
          🚀 Open Source Hardware Simulation Platform
        </div>
        <h1 className="hero-title">
          Code. Simulate.
          <br />
          <span className="gradient-text">Learn. Deploy.</span>
        </h1>
        <p className="hero-subtitle">
          A browser-based embedded systems simulator with gamified learning,
          classroom tools, and real hardware emulation. No hardware needed.
        </p>
        <div className="hero-actions">
          <button
            className="btn btn-primary btn-lg"
            onMouseEnter={() => import("./simulationpage/SimulatorPage.jsx")}
            onClick={() => handleNavigate("/simulator")}
          >
            ▶ Try Simulator
          </button>
          <button
            className="btn btn-outline btn-lg"
            onClick={() => handleNavigate("/classroom/signup")}
          >
            Join as Student / Teacher
          </button>
        </div>
        <p className="hero-note">
          ⚠️ Guest mode: No cloud save · No progress tracking · No assignments
        </p>

        {/* FLOATING BOARDS */}
        <div className="board-showcase">
          <div className="board-chip arduino">Arduino Uno</div>
          <div className="board-chip pico">Raspberry Pi Pico</div>
          <div className="board-chip esp32">ESP32</div>
          <div className="board-chip bg-blue-500/10 border-blue-500/40 text-blue-400">
            STM32
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features">
        <h2 className="section-title">
          Everything you need to learn embedded systems
        </h2>
        <div className="features-grid">
          {[
            {
              icon: "🖥️",
              title: "Real-Time Simulation",
              desc: "Instruction-level Arduino & Pico emulation directly in your browser. No plugins.",
            },
            {
              icon: "🏫",
              title: "Classroom Mode",
              desc: "Teachers create classes, push templates, lock screens, and grade submissions live.",
            },
            {
              icon: "🧩",
              title: "Block + Code Editor",
              desc: "Start with visual blocks, graduate to full C++ code. Switch modes any time.",
            },
            {
              icon: "⚡",
              title: "Smart Auto-Assist",
              desc: "Drop an LED and get a resistor added automatically. Context-aware circuit help.",
            },
            {
              icon: "📊",
              title: "Serial Tools",
              desc: "Real-time serial monitor and plotter for debugging and sensor visualization.",
            },
          ].map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* GUIDED PROJECTS */}
      <section className="features">
        <h2 className="section-title">Start with guided projects</h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--text2)",
            marginBottom: "1.25rem",
            fontSize: 15,
          }}
        >
          Explore pre-built circuits and code — no login required
        </p>

        {/* MODE TOGGLE: Code vs Blocks */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "1.75rem",
        }}>
          <div
            role="radiogroup"
            aria-label="Editor Mode"
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "var(--bg2, rgba(15, 23, 42, 0.6))",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
              borderRadius: "9999px",
              padding: "4px",
              position: "relative",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              gap: "4px",
            }}
          >
            <button
              type="button"
              id="mode-toggle-code"
              onClick={() => handleEditorModeChange("code")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 22px",
                borderRadius: "9999px",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.02em",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                color: editorMode === "code" ? "#ffffff" : "var(--text2, #94a3b8)",
                background: editorMode === "code"
                  ? "linear-gradient(135deg, #0284c7, #2563eb)"
                  : "transparent",
                boxShadow: editorMode === "code"
                  ? "0 2px 12px rgba(2, 132, 199, 0.4)"
                  : "none",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span>Code</span>
            </button>

            <button
              type="button"
              id="mode-toggle-blocks"
              onClick={() => handleEditorModeChange("blocks")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 22px",
                borderRadius: "9999px",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.02em",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                color: editorMode === "blocks" ? "#ffffff" : "var(--text2, #94a3b8)",
                background: editorMode === "blocks"
                  ? "linear-gradient(135deg, #0284c7, #2563eb)"
                  : "transparent",
                boxShadow: editorMode === "blocks"
                  ? "0 2px 12px rgba(2, 132, 199, 0.4)"
                  : "none",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span>Blocks</span>
            </button>
          </div>

          <span style={{ fontSize: "12px", color: "var(--text3, #64748b)", fontWeight: 500 }}>
            {editorMode === "blocks"
              ? "🧩 Blocks mode: Edit visually with blocks (Code editor is locked in read-only)"
              : "💻 Code mode: Edit directly in code editor (Blocks are locked in view-only)"}
          </span>
        </div>

        <div style={{
          maxHeight: 520, overflowY: "auto",
          paddingRight: 8,
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border, rgba(255,255,255,0.1)) transparent",
        }}>
          <div className="features-grid">
            {allCards.map((p) => {
              const hasImageError = !!imageErrors[p.slug];
              const imageUrl = getCircuitImageUrl(p.slug, EXAMPLES_BASE_URL);

              return (
                <div
                  className="feature-card"
                  key={p.slug}
                  onClick={() => handleNavigate(`/${p.slug}/demo?editorMode=${editorMode}`, { state: { editorMode, guidedProject: p } })}
                  style={{ cursor: "pointer", textAlign: "center" }}
                >
                  <div style={{
                    width: "100%",
                    height: "120px",
                    overflow: "hidden",
                    borderRadius: "8px",
                    marginBottom: "12px",
                    background: "rgba(255,255,255,0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border)"
                  }}>
                    <img
                      src={imageUrl}
                      alt={p.title}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextSibling) {
                          e.currentTarget.nextSibling.style.display = 'inline-block';
                        }
                      }}
                    />
                    <span style={{ fontSize: 40, display: 'none' }}>{PROJECT_ICONS[p.slug] || "🔌"}</span>
                  </div>
                  <h3 style={{ marginBottom: 4, fontSize: 15 }}>{p.title}</h3>
                  <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.6 }}>
                    {p.board}
                  </p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 5,
                        background:
                          p.difficulty === "Beginner"
                            ? "rgba(34,197,94,.15)"
                            : p.difficulty === "Advanced"
                            ? "rgba(239,68,68,.15)"
                            : "rgba(251,191,36,.15)",
                        color: 
                          p.difficulty === "Beginner" 
                            ? "#22c55e" 
                            : p.difficulty === "Advanced" 
                            ? "#ef4444" 
                            : "#fbbf24",
                        border: `1px solid ${
                          p.difficulty === "Beginner" 
                            ? "rgba(34,197,94,.3)" 
                            : p.difficulty === "Advanced"
                            ? "rgba(239,68,68,.3)"
                            : "rgba(251,191,36,.3)"
                        }`,
                      }}
                    >
                      {p.difficulty}
                    </span>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Ready to start building?</h2>
        <p>
          Join as a student to track progress, or as a teacher to manage your
          class.
        </p>
        <div className="cta-cards">
          <div
            className="cta-card student-card"
            onClick={() => navigate("/classroom/signup?role=student")}
          >
            <div className="cta-icon">🎓</div>
            <h3>I'm a Student</h3>
            <p>Join classes, submit assignments, earn rewards</p>
            <button className="btn btn-primary">Join as Student →</button>
          </div>

          <div
            className="cta-card teacher-card"
            onClick={() => navigate("/classroom/signup?role=teacher")}
          >
            <div className="cta-icon">👨‍🏫</div>
            <h3>I'm a Teacher</h3>
            <p>Create classes, assign projects, monitor students</p>
            <button className="btn btn-secondary">Join as Teacher →</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-brand">
          <img
            src="/logo-Photoroom.png"
            alt="OpenHW-Studio"
            className="brand-logo brand-logo--footer"
          />
        </div>
        <p>Open Source Hardware Simulation & Learning Platform</p>
        <div className="footer-links">
          <a href="https://github.com/OpenHW-Studio/" target="_blank">
            GitHub
          </a>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            Documentation
          </a>
          <a href="/components-status">Component Status</a>
          <a href="/analytics">Analytics</a>
          <a href="/bugs">Bug Tracker</a>
          <a href="/feedback">Reviews & Feedback</a>
          <a href="/examples">Examples</a>
        </div>
      </footer>
    </div>
  );
}
