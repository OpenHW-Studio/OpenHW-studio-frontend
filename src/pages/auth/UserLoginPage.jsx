import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../context/AuthContext.jsx'
import { googleLogin, loginUser } from '../../services/authService.js'
import { 
  ChevronLeft, 
  Mail, 
  Lock, 
  ArrowRight, 
  Check, 
  Building2 
} from 'lucide-react'

export default function UserLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, role } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from || null

  const handleRedirect = (userRole) => {
    if (from) {
      navigate(from)
      return
    }
    navigate('/user/dashboard')
  }

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/user/dashboard')
    }
  }, [isAuthenticated, role, navigate])

  const handleInputChange = (e) => {
    const value = e.target.type === 'email' ? e.target.value.trim() : e.target.value
    setFormData((prev) => ({ ...prev, [e.target.name]: value }))
  }

  const handleUserLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await loginUser(formData)
      login(data.token, data.user)
      handleRedirect(data.user?.role)
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      setError('')
      try {
        const data = await googleLogin(tokenResponse.access_token, 'user')
        login(data.token, data.user)
        handleRedirect(data.user?.role)
      } catch (err) {
        setError(err.message || 'Google authentication failed.')
      } finally {
        setLoading(false)
      }
    },
    onError: () => setError('Google sign-in was cancelled.')
  })

  return (
    <div className="auth-screen">
      <div className="auth-shell auth-shell--wide">
        {/* Left Panel - Branding/Info */}
        <section className="auth-showcase">
          <div className="auth-showcase__badge">General Access</div>
          <h1 className="auth-showcase__title">
            Welcome to <br />
            <span className="gradient-text">OpenHW Studio</span>
          </h1>
          <p className="auth-showcase__copy">
            Explore, design, and simulate hardware projects in minutes. Sign in to sync your work across all devices.
          </p>

          <div className="auth-showcase__highlights">
            <div className="auth-showcase__card">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 rounded-lg bg-white/20">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <strong className="!mb-0">Fast & Seamless</strong>
              </div>
              <span>Experience a lag-free simulation environment tailored for hardware enthusiasts.</span>
            </div>
            
            <div className="auth-showcase__card">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-1.5 rounded-lg bg-white/20">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
                <strong className="!mb-0">Instant Access</strong>
              </div>
              <span>Continue as guest to jump straight into the simulator without an account.</span>
            </div>
          </div>
        </section>

        {/* Right Panel - Form */}
        <section className="auth-panel">
          <Link to="/" className="auth-panel__back">
            <ChevronLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="auth-panel__brand">
             <img src="/image.png" alt="OpenHW-Studio" className="brand-logo brand-logo--auth" />
          </div>

          <header className="auth-panel__header">
            <h2>User Login</h2>
            <p>Access your personal dashboard and projects.</p>
          </header>

          <form className="auth-form" onSubmit={handleUserLogin}>
            <div className="auth-field">
              <span>Email Address</span>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="you@example.com"
                  className="!pl-12"
                />
              </div>
            </div>

            <div className="auth-field">
              <span>Password</span>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="••••••••"
                  className="!pl-12"
                />
              </div>
            </div>

            {error && (
              <div className="auth-form__error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="auth-form__submit mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleGoogleSuccess()}
              disabled={loading}
              className="auth-alt-button flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C17 3.2 14.8 2.2 12 2.2 6.8 2.2 2.6 6.4 2.6 11.6S6.8 21 12 21c6.9 0 9.5-4.8 9.5-7.3 0-.5-.1-.9-.1-1.3H12z"/>
              </svg>
              Google
            </button>

            <button
              type="button"
              onClick={() => {
                if (from) navigate(from); else navigate('/simulator');
              }}
              className="auth-alt-button flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              Guest
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/classroom/signin')}
              className="w-full flex items-center justify-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-5 py-4 text-[0.95rem] font-bold text-cyan-600 transition hover:bg-cyan-500/10 hover:border-cyan-500/30"
            >
              <Building2 className="w-5 h-5" />
              Go to Classroom Login
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}