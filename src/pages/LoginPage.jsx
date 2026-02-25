import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext.jsx'
import { googleLogin } from '../services/authService.js'

/**
 * LOGIN PAGE
 * 
 * Flow:
 * 1. User clicks "Continue with Google"
 * 2. Google OAuth popup opens (useGoogleLogin hook)
 * 3. On success, we get an access_token from Google
 * 4. We call our backend: POST /api/auth/google { access_token, role }
 * 5. Backend verifies with Google, creates/finds user, returns JWT + user profile
 * 6. We store JWT in localStorage, update AuthContext
 * 7. Redirect to role-based dashboard
 * 
 * NOTE: If backend is not ready yet, a MOCK login is used (see mockLogin below)
 */

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, isAuthenticated, role } = useAuth()

  const [selectedRole, setSelectedRole] = useState(searchParams.get('role') || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If already logged in, redirect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
    }
  }, [isAuthenticated])

  // ─── MOCK LOGIN (Remove when backend is ready) ────────────────────────────
  const mockLogin = (googleUserInfo, chosenRole) => {
    const mockToken = 'mock_jwt_token_replace_when_backend_ready'
    const mockUser = {
      id: 'mock_001',
      name: googleUserInfo.name || 'Demo User',
      email: googleUserInfo.email || 'demo@openhw.io',
      picture: googleUserInfo.picture || '',
      role: chosenRole,
      points: 0,
      coins: 0,
      level: 1,
    }
    login(mockToken, mockUser)
    navigate(chosenRole === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
  }
  // ─────────────────────────────────────────────────────────────────────────

  const handleGoogleSuccess = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (!selectedRole) {
        setError('Please select your role first.')
        return
      }
      setLoading(true)
      setError('')
      try {
        // Get Google user info
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const googleUser = await res.json()

        // ── Try real backend ──────────────────────────────────────────
        // When backend is ready, replace mockLogin with:
        // const { token, user } = await googleLogin(tokenResponse.access_token, selectedRole)
        // login(token, user)
        // navigate(user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')
        // ─────────────────────────────────────────────────────────────

        // MOCK: simulate backend response
        mockLogin(googleUser, selectedRole)

      } catch (err) {
        setError('Authentication failed. Please try again.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed.')
      setLoading(false)
    },
  })

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Header */}
        <Link to="/" className="auth-back">← Back to Home</Link>
        <div className="auth-logo">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">OpenHW<span className="brand-accent">-Studio</span></span>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to access your workspace</p>

        {/* Role Selection */}
        <div className="role-section">
          <p className="role-label">I am a...</p>
          <div className="role-options">
            <button
              className={`role-btn ${selectedRole === 'student' ? 'active' : ''}`}
              onClick={() => setSelectedRole('student')}
            >
              <span className="role-emoji">🎓</span>
              <span className="role-text">Student</span>
              <span className="role-desc">Learn & complete assignments</span>
            </button>
            <button
              className={`role-btn ${selectedRole === 'teacher' ? 'active' : ''}`}
              onClick={() => setSelectedRole('teacher')}
            >
              <span className="role-emoji">👨‍🏫</span>
              <span className="role-text">Teacher</span>
              <span className="role-desc">Manage classes & grade</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div className="auth-error">⚠️ {error}</div>}

        {/* Google OAuth Button */}
        <button
          className={`google-btn ${!selectedRole ? 'disabled' : ''} ${loading ? 'loading' : ''}`}
          onClick={() => {
            if (!selectedRole) {
              setError('Please select your role first.')
              return
            }
            handleGoogleSuccess()
          }}
          disabled={loading}
        >
          {loading ? (
            <span className="btn-loading">Signing in...</span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <div className="auth-divider"><span>or</span></div>

        {/* Guest option */}
        <button className="guest-btn" onClick={() => navigate('/simulator')}>
          Continue as Guest (Limited Access)
        </button>

        <p className="auth-guest-note">
          Guest mode: simulator access only. No cloud save or progress tracking.
        </p>

        {/* Footer note */}
        <p className="auth-terms">
          By signing in, you agree to our Terms of Service.<br />
          Your data is used only for your OpenHW-Studio workspace.
        </p>
      </div>

      {/* Background decoration */}
      <div className="auth-bg">
        <div className="auth-bg-circuit" />
      </div>
    </div>
  )
}
