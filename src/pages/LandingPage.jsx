import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const exampleProjects = [
  { title: 'LED Blink', slug: 'led-blink', board: 'Arduino Uno', difficulty: 'Beginner', icon: '💡', points: 50 },
  { title: 'RGB LED', slug: 'rgb-led', board: 'Arduino Uno', difficulty: 'Beginner', icon: '🎨', points: 80 },
  { title: 'Buzzer', slug: 'buzzer', board: 'Arduino Uno', difficulty: 'Beginner', icon: '🔔', points: 70 },
  { title: 'LED Strip', slug: 'led-strip', board: 'Arduino Uno', difficulty: 'Beginner', icon: '🌈', points: 90 },
  { title: 'Potentiometer', slug: 'potentiometer', board: 'Arduino Uno', difficulty: 'Beginner', icon: '🎚️', points: 100 },
  { title: 'Button & Debounce', slug: 'button-debounce', board: 'Arduino Uno', difficulty: 'Beginner', icon: '🕹️', points: 110 },
  { title: 'LDR', slug: 'ldr', board: 'Arduino Uno', difficulty: 'Intermediate', icon: '☀️', points: 130 },
  { title: 'DC Motor', slug: 'dc-motor', board: 'Arduino Uno', difficulty: 'Intermediate', icon: '🔄', points: 140 },
  { title: 'Servo Motor', slug: 'servo-motor', board: 'Arduino Uno', difficulty: 'Intermediate', icon: '⚙️', points: 120 },
  { title: 'Temperature Sensor', slug: 'temperature-sensor', board: 'Arduino Uno', difficulty: 'Intermediate', icon: '🌡️', points: 150 },
]

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
    else navigate('/student/dashboard')
  }

  return (
    <div className="landing">
      {/* NAV */}
      <nav className="nav">
        <div className="nav-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">OpenHW<span className="brand-accent">-Studio</span></span>
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
            ▶ Try Simulator — No Login Required
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => navigate('/login')}>
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
            { icon: '🎮', title: 'Gamified Learning', desc: 'Earn points, coins and badges. Unlock advanced components as you level up.' },
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

      {/* EXAMPLE PROJECTS */}
      <section className="projects-section">
        <h2 className="section-title">Start with guided projects</h2>
        <p className="section-sub">Complete projects to earn XP and unlock advanced components</p>
        <div className="projects-grid">
          {exampleProjects.map((p) => (
            <div className="project-card" key={p.title} onClick={() => navigate(`/${p.slug}/guide`)}>
              <div className="project-icon">{p.icon}</div>
              <div className="project-info">
                <h4>{p.title}</h4>
                <span className="project-board">{p.board}</span>
              </div>
              <div className="project-meta">
                <span className={`difficulty ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
                <span className="points">+{p.points} XP</span>
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
          <div className="cta-card student-card" onClick={() => navigate('/login?role=student')}>
            <div className="cta-icon">🎓</div>
            <h3>I'm a Student</h3>
            <p>Join classes, submit assignments, earn rewards</p>
            <button className="btn btn-primary">Join as Student →</button>
          </div>
          <div className="cta-card teacher-card" onClick={() => navigate('/login?role=teacher')}>
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
          <span className="brand-icon">⚡</span> OpenHW-Studio
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
