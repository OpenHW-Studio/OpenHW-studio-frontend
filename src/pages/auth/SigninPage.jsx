import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { googleLogin, loginUser } from '../../services/authService.js'
import { useGoogleLogin } from '@react-oauth/google';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

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
    const value = e.target.type === 'email' ? e.target.value.trim() : e.target.value
    setFormData({ ...formData, [e.target.name]: value })
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
      const data = await loginUser(formData)
      login(data.token, data.user)
      navigate(data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (!selectedRole) {
        setError('Please select your role first.')
        return
      }

      setLoading(true)
      setError('')
      try {
        const data = await googleLogin(tokenResponse.access_token, selectedRole)
        login(data.token, data.user)
        navigate(data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
      } catch (err) {
        setError(err.message || 'Google authentication failed.')
      } finally {
        setLoading(false)
      }
    },
    onError: () => setError('Google sign-in was cancelled.')
  })

  return (
    <div className="auth-screen auth-screen--signin">
      <div className="auth-shell auth-shell--wide">
        <section className="auth-showcase">
          <div className="auth-showcase__badge">Teacher and student access</div>
          <h1 className="auth-showcase__title">Sign in to continue building, teaching, and reviewing.</h1>
          <p className="auth-showcase__copy">
            Access classrooms, assignments, simulation projects, and progress history from a single workspace.
          </p>

          <div className="auth-showcase__highlights">
            <div className="auth-showcase__card">
              <strong>Classroom ready</strong>
              <span>Organize classes, deadlines, and simulator sessions in one place.</span>
            </div>
            <div className="auth-showcase__card">
              <strong>Role aware</strong>
              <span>Switch between teacher and student entry without losing context.</span>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <Link to="/" className="auth-panel__back">Back to Home</Link>

          <div className="auth-panel__brand">
            <img src="/image.png" alt="OpenHW-Studio" className="brand-logo brand-logo--auth" />
          </div>

          <header className="auth-panel__header">
            <h2>Sign In</h2>
            <p>Select your role and continue with email or Google.</p>
          </header>

          <form className="auth-form" onSubmit={handleEmailLogin}>
            <div className="auth-role-picker">
              <button
                type="button"
                className={`auth-role-picker__option${selectedRole === 'teacher' ? ' is-active' : ''}`}
                onClick={() => setSelectedRole('teacher')}
              >
                <strong>Teacher</strong>
                <span>Manage classes and reviews</span>
              </button>
              <button
                type="button"
                className={`auth-role-picker__option${selectedRole === 'student' ? ' is-active' : ''}`}
                onClick={() => setSelectedRole('student')}
              >
                <strong>Student</strong>
                <span>Join classes and submit work</span>
              </button>
            </div>

            <label className="auth-field">
              <span>Email</span>
              <input type="email" name="email" placeholder="Enter your email" value={formData.email} onChange={handleInputChange} required />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input type="password" name="password" placeholder="Enter your password" value={formData.password} onChange={handleInputChange} required />
              <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
                <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: '#3b82f6' }}>Forgot Password?</Link>
              </div>
            </label>

            {error && <div className="auth-form__error">{error}</div>}

            <button type="submit" className="auth-form__submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider"><span>or continue with</span></div>

          <button
            type="button"
            onClick={() => selectedRole ? handleGoogleSuccess() : setError('Please select your role first.')}
            className={`auth-alt-button${selectedRole ? '' : ' is-disabled'}`}
            disabled={!selectedRole || loading}
          >
            Google
          </button>

          <button
            type="button"
            onClick={() => navigate('/simulator')}
            className="auth-alt-button auth-alt-button--ghost"
          >
            Continue as Guest
          </button>

          <p className="auth-panel__footer">
            Don't have an account? <Link to="/signup">Create one</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
