import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx' 

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, role } = useAuth()
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const handleDashboard = () => {
    if (role === 'teacher') navigate('/teacher/dashboard')
    else if (role === 'student') navigate('/student/dashboard')
    else navigate('/user/dashboard')
  }

  return (
    <div className="landing">
      {/* NAV */}
      <nav className="nav">
        <div className="nav-brand">
          <img src="/image.png" alt="OpenHW-Studio" className="brand-logo brand-logo--nav" />
        </div>
        <div className="nav-actions">
          <button className="btn btn-ghost" onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          {isAuthenticated ? (
            <button className="btn btn-primary" onClick={handleDashboard}>Dashboard →</button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => navigate('/login')}>Sign In</button>
              <button className="btn btn-primary" onClick={() => navigate('/login')}>Get Started</button>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">🚀 Open Source Hardware Simulation Platform</div>
        <h1 className="hero-title">
          Build. Simulate.<br />
          <span className="gradient-text">Learn Electronics.</span>
        </h1>
        <p className="hero-subtitle">
          A browser-based embedded systems simulator with gamified learning,
          classroom tools, and real hardware emulation. No hardware needed.
        </p>
        <div className="hero-actions">
          
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/simulator')}>
            ▶ Try Simulator
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => navigate('/classroom/signup')}>
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
          <div className="board-chip stm coming">STM32 — Coming Soon</div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features">
        <h2 className="section-title">Everything you need to learn embedded systems</h2>
        <div className="features-grid">
          {[
            { icon: '🖥️', title: 'Real-Time Simulation', desc: 'Instruction-level Arduino & Pico emulation directly in your browser. No plugins.' },
            { icon: '🏫', title: 'Classroom Mode', desc: 'Teachers create classes, push templates, lock screens, and grade submissions live.' },
            { icon: '🧩', title: 'Block + Code Editor', desc: 'Start with visual blocks, graduate to full C++ code. Switch modes any time.' },
            { icon: '⚡', title: 'Smart Auto-Assist', desc: 'Drop an LED and get a resistor added automatically. Context-aware circuit help.' },
            { icon: '📊', title: 'Serial Tools', desc: 'Real-time serial monitor and plotter for debugging and sensor visualization.' },
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
        <p style={{ textAlign: 'center', color: 'var(--text2)', marginBottom: '2rem', fontSize: 15 }}>
          Explore pre-built circuits and code — no login required
        </p>
        <div className="features-grid">
          {[
            { icon: '💡', title: 'LED Blink',          slug: 'led-blink',         board: 'Arduino Uno', difficulty: 'Beginner',     xp: 100 },
            { icon: '🌈', title: 'RGB LED',             slug: 'rgb-led',            board: 'Arduino Uno', difficulty: 'Beginner',     xp: 150 },
            { icon: '🔊', title: 'Buzzer',              slug: 'buzzer',             board: 'Arduino Uno', difficulty: 'Beginner',     xp: 150 },
            { icon: '🎛️', title: 'Potentiometer',       slug: 'potentiometer',      board: 'Arduino Uno', difficulty: 'Beginner',     xp: 175 },
            { icon: '🔘', title: 'Button & Debounce',   slug: 'button-debounce',    board: 'Arduino Uno', difficulty: 'Beginner',     xp: 200 },
            { icon: '🌡️', title: 'Temperature Sensor',  slug: 'temperature-sensor', board: 'Arduino Uno', difficulty: 'Intermediate', xp: 250 },
          ].map((p) => (
            <div
              className="feature-card"
              key={p.slug}
              onClick={() => navigate(`/${p.slug}/guide`)}
              style={{ cursor: 'pointer', textAlign: 'left' }}
            >
              <div className="feature-icon">{p.icon}</div>
              <h3 style={{ marginBottom: 4 }}>{p.title}</h3>
              <p style={{ margin: '0 0 10px', fontSize: 13, opacity: 0.6 }}>{p.board}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                  background: p.difficulty === 'Beginner' ? 'rgba(34,197,94,.15)' : 'rgba(251,191,36,.15)',
                  color: p.difficulty === 'Beginner' ? '#22c55e' : '#fbbf24',
                  border: `1px solid ${p.difficulty === 'Beginner' ? 'rgba(34,197,94,.3)' : 'rgba(251,191,36,.3)'}`,
                }}>{p.difficulty}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>+{p.xp} XP</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Ready to start building?</h2>
        <p>Join as a student to track progress, or as a teacher to manage your class.</p>
        <div className="cta-cards">
          <div className="cta-card student-card" onClick={() => navigate('/classroom/signup?role=student')}>
            <div className="cta-icon">🎓</div>
            <h3>I'm a Student</h3>
            <p>Join classes, submit assignments, earn rewards</p>
            <button className="btn btn-primary">Join as Student →</button>
          </div>
      
          <div className="cta-card teacher-card" onClick={() => navigate('/classroom/signup?role=teacher')}>
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
          <img src="/image.png" alt="OpenHW-Studio" className="brand-logo brand-logo--footer" />
        </div>
        <p>Open Source Hardware Simulation & Learning Platform</p>
        <div className="footer-links">
          <a href="#">GitHub</a>
          <a href="#">Documentation</a>
          <a href="#">Examples</a>
        </div>
      </footer>
    </div>
  )
}