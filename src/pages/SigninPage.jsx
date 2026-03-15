import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { loginUser } from '../services/authService.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function SigninPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()


  const { login, isAuthenticated, role } = useAuth()

  const [selectedRole, setSelectedRole] = useState(searchParams.get('role') || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  useEffect(() => {
    if (isAuthenticated) {
      navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
    }
  }, [isAuthenticated, role, navigate])

  const handleInputChange = (e) => {
    const value = e.target.type === 'email' ? e.target.value.trim() : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!selectedRole) {
      setError('Please select your role first.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await loginUser({ ...formData, role: selectedRole })
      // Local AuthContext expects (jwtToken, userProfile)
      login(data.token, data.user)
      navigate(data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    if (!selectedRole) {
      setError('Please select your role first.')
      return
    }
    // Note: The backend will currently not know what role was selected. 
    // To support passing the role, we could store it in a cookie or localStorage here briefly,
    // or append it to the Google OAuth URL. Let's save it to localStorage so the profile fetch knows it.
    localStorage.setItem('pending_oauth_role', selectedRole);

    // Redirect directly to the backend passport route
    // The backend uses the base url but without the `/api` depending on how it's mounted.
    // In server.js we mounted passport under /auth
    const authUrl = BASE_URL.replace('/api', '/auth');
    window.location.href = `${authUrl}/google`;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-back">← Back to Home</Link>
        <div className="auth-logo">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">OpenHW<span className="brand-accent">-Studio</span></span>
        </div>
        <h1 className="auth-title">Welcome back</h1>

        <div className="role-section">
          <p className="role-label">I am a...</p>
          <div className="role-options">
            <button
              className={`role-btn ${selectedRole === 'student' ? 'active' : ''}`}
              onClick={() => setSelectedRole('student')}
            >
              <span className="role-emoji">🎓</span>
              <span className="role-text">Student</span>
            </button>
            <button
              className={`role-btn ${selectedRole === 'teacher' ? 'active' : ''}`}
              onClick={() => setSelectedRole('teacher')}
            >
              <span className="role-emoji">👨‍🏫</span>
              <span className="role-text">Teacher</span>
            </button>
          </div>
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        <form className="flex flex-col gap-4 mt-6 w-full" onSubmit={handleEmailLogin}>
          <div className="flex flex-col gap-1.5 text-left w-full">
            <label className="text-sm font-medium text-slate-300">Email Address</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg text-white text-base transition-all duration-200 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
              type="email"
              name="email"
              placeholder="name@college.edu"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 text-left w-full">
            <label className="text-sm font-medium text-slate-300">Password</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg text-white text-base transition-all duration-200 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-sky-400 text-slate-900 font-bold px-4 py-3 rounded-lg border-none cursor-pointer text-base transition-all duration-200 mt-2 hover:bg-sky-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider"><span>or login with</span></div>

        <button
          className={`google-btn ${!selectedRole ? 'disabled' : ''}`}
          onClick={handleGoogleLogin}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </button>

        <button className="guest-btn" onClick={() => navigate('/simulator')}>
          Continue as Guest
        </button>

        <p className="auth-footer-text">
          Don't have an account? <Link to="/signup">Create one</Link>
        </p>
      </div>

      <div className="auth-bg"><div className="auth-bg-circuit" /></div>
    </div>
  )
}