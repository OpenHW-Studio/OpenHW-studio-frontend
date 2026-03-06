import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { signupUser } from '../services/authService.js'

export default function SignupPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, role } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student', // default role
    college: '',
    semester: ''
  })

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
    }
  }, [isAuthenticated, role, navigate])

  const handleInputChange = (e) => {
    const value = e.target.type === 'email' ? e.target.value.trim() : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Call backend signup service
      const data = await signupUser(formData)
      // Log the user in with returned token
      login(data.token, data.user)
      navigate(data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <style>{`
        .auth-form { display: flex; flex-direction: column; gap: 1.25rem; margin-top: 1rem; }
        
        /* Grid Layout */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; width: 100%; }
        
        /* Stack grid on smaller screens */
        @media (max-width: 480px) {
          .form-grid { grid-template-columns: 1fr; }
        }

        .form-group { display: flex; flex-direction: column; gap: 0.5rem; text-align: left; width: 100%; }
        .form-group label { font-size: 0.875rem; font-weight: 500; color: #cbd5e1; }
        
        /* FIXED: Added width 100% and box-sizing */
        .form-group input { 
          width: 100%; 
          box-sizing: border-box; 
          background: #0f172a; 
          border: 1px solid #334155; 
          padding: 0.75rem 1rem; 
          border-radius: 0.5rem; 
          color: white; 
          font-size: 1rem; 
          transition: border-color 0.2s, box-shadow 0.2s; 
        }
        
        .form-group input:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
        .login-submit-btn { background: #38bdf8; color: #0f172a; font-weight: 700; padding: 0.75rem; border-radius: 0.5rem; border: none; cursor: pointer; font-size: 1rem; transition: transform 0.1s, background 0.2s; margin-top: 0.5rem; width: 100%; box-sizing: border-box; }
        .login-submit-btn:hover:not(:disabled) { background: #7dd3fc; }
        .login-submit-btn:active:not(:disabled) { transform: scale(0.98); }
        .login-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-card.signup-card { max-width: 500px; width: 100%; box-sizing: border-box; }
      `}</style>

      <div className="auth-card signup-card">
        <div className="auth-logo">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">OpenHW<span className="brand-accent">-Studio</span></span>
        </div>
        <h1 className="auth-title">Create an Account</h1>

        <div className="role-section">
          <p className="role-label">I am a...</p>
          <div className="role-options">
            <button type="button" className={`role-btn ${formData.role === 'student' ? 'active' : ''}`} onClick={() => setFormData({...formData, role: 'student'})}>
              <span className="role-emoji">🎓</span>
              <span className="role-text">Student</span>
            </button>
            <button type="button" className={`role-btn ${formData.role === 'teacher' ? 'active' : ''}`} onClick={() => setFormData({...formData, role: 'teacher'})}>
              <span className="role-emoji">👨‍🏫</span>
              <span className="role-text">Teacher</span>
            </button>
          </div>
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        <form className="auth-form" onSubmit={handleSignup}>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" name="name" placeholder="John Doe" value={formData.name} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" name="email" placeholder="name@college.edu" value={formData.email} onChange={handleInputChange} required />
            </div>
          </div>

          <div className="form-group">
            <label>Password (Min 8 chars)</label>
            <input type="password" name="password" placeholder="••••••••" minLength="8" value={formData.password} onChange={handleInputChange} required />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>College (Optional)</label>
              <input type="text" name="college" placeholder="IIT Bombay" value={formData.college} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>Semester (Optional)</label>
              <input type="number" name="semester" min="1" max="12" placeholder="1" value={formData.semester} onChange={handleInputChange} />
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-footer-text" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }}>Sign In</Link>
        </p>
      </div>
      <div className="auth-bg"><div className="auth-bg-circuit" /></div>
    </div>
  )
}