import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { signupUser } from '../../services/authService.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

export default function SignupPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, role } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    college: '',
    semester: '',
    bio: '',
    image: ''
  })

  useEffect(() => {
    if (isAuthenticated) {
      if (role === 'teacher') navigate('/teacher/dashboard')
      else if (role === 'student') navigate('/student/dashboard')
      else navigate('/user/dashboard')
    }
  }, [isAuthenticated, role, navigate])

  const handleInputChange = (e) => {
    const value = e.target.type === 'email' ? e.target.value.trim() : e.target.value
    setFormData({ ...formData, [e.target.name]: value })
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await signupUser(formData)
      login(data.token, data.user)
      const handleRedirect = (userRole) => {
        if (userRole === 'teacher') navigate('/teacher/dashboard')
        else if (userRole === 'student') navigate('/student/dashboard')
        else navigate('/user/dashboard')
      }
      handleRedirect(data.user.role)
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    // Save the selected role before redirecting to Google OAuth
    localStorage.setItem('pending_oauth_role', formData.role);

    const authUrl = BASE_URL.replace('/api', '/auth');
    window.location.href = `${authUrl}/google`;
  }

  return (
    <div className="auth-screen auth-screen--signup">
      <div className="auth-shell auth-shell--wide auth-shell--reverse">
        <section className="auth-panel">
          <Link to="/login" className="auth-panel__back">Back to User Login</Link>

          <div className="auth-panel__brand">
            <img src="/image.png" alt="OpenHW-Studio" className="brand-logo brand-logo--auth" />
          </div>

          <header className="auth-panel__header">
            <h2>Classroom Sign Up</h2>
            <p>Set up your role, profile, and access details.</p>
          </header>

          <form className="auth-form" onSubmit={handleSignup}>
            <div className="auth-role-picker">
              <button
                type="button"
                className={`auth-role-picker__option${formData.role === 'teacher' ? ' is-active' : ''}`}
                onClick={() => setFormData({ ...formData, role: 'teacher' })}
              >
                <strong>Teacher</strong>
                <span>Create classes and assignments</span>
              </button>

              <button
                type="button"
                className={`auth-role-picker__option${formData.role === 'student' ? ' is-active' : ''}`}
                onClick={() => setFormData({ ...formData, role: 'student' })}
              >
                <strong>Student</strong>
                <span>Track coursework and progress</span>
              </button>
            </div>

            <div className="auth-form__grid">
              <label className="auth-field auth-field--full">
                <span>Full Name</span>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label className="auth-field auth-field--full">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label className="auth-field auth-field--full">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label className="auth-field auth-field--full">
                <span>Bio (optional)</span>
                <input
                  type="text"
                  name="bio"
                  placeholder="Tell us about yourself"
                  value={formData.bio}
                  onChange={handleInputChange}
                />
              </label>

              <label className="auth-field auth-field--full">
                <span>Profile Image URL (optional)</span>
                <input
                  type="url"
                  name="image"
                  placeholder="https://..."
                  value={formData.image}
                  onChange={handleInputChange}
                />
              </label>

              {formData.role === 'student' && (
                <>
                  <label className="auth-field">
                    <span>College</span>
                    <input
                      type="text"
                      name="college"
                      placeholder="Enter your college"
                      value={formData.college}
                      onChange={handleInputChange}
                    />
                  </label>

                  <label className="auth-field">
                    <span>Semester</span>
                    <input
                      type="text"
                      name="semester"
                      placeholder="Enter your semester"
                      value={formData.semester}
                      onChange={handleInputChange}
                    />
                  </label>
                </>
              )}
            </div>

            {error && <div className="auth-form__error">{error}</div>}

            <button type="submit" className="auth-form__submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="auth-panel__footer">
            Already have an account? <Link to="/classroom/signin">Sign in</Link>
          </p>
        </section>

        <section className="auth-showcase auth-showcase--signup">
          <div className="auth-showcase__badge">Normal CSS powered UI</div>
          <h1 className="auth-showcase__title">Build a clean onboarding flow that matches the rest of the product.</h1>
          <p className="auth-showcase__copy">
            The signup experience now uses custom classes instead of Tailwind utilities, so the styling is consistent even when utility generation is unavailable.
          </p>

          <div className="auth-showcase__metrics">
            <div>
              <strong>4</strong>
              <span>sample classes</span>
            </div>
            <div>
              <strong>3</strong>
              <span>views refreshed</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>custom CSS</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
