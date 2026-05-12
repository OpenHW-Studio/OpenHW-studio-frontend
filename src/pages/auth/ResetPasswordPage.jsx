import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { resetPassword } from '../../services/authService'

export default function ResetPasswordPage() {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
        setError('Password must be at least 8 characters long.')
        return
    }

    setLoading(true)
    setError('')

    try {
      await resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/signin'), 3000)
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may be invalid or expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen auth-screen--signin">
      <div className="auth-shell" style={{ display: 'flex', justifyContent: 'center' }}>
        <section className="auth-panel" style={{ width: '100%', maxWidth: '520px' }}>
          <div className="auth-panel__brand">
            <img src="/image.png" alt="OpenHW-Studio" className="brand-logo brand-logo--auth" />
          </div>

          <header className="auth-panel__header">
            <h2>Reset Password</h2>
            <p>Enter your new password below to regain access.</p>
          </header>

          {success ? (
            <div className="auth-form__success-container" style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ color: '#059669', fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>
                Password Reset Successful!
              </div>
              <p style={{ color: '#64748b', marginBottom: '2rem' }}>Redirecting you to the sign-in page...</p>
              <Link to="/signin" className="auth-form__submit" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
                Go to Sign In Now
              </Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span>New Password</span>
                <input 
                  type="password" 
                  placeholder="At least 8 characters" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </label>

              <label className="auth-field">
                <span>Confirm New Password</span>
                <input 
                  type="password" 
                  placeholder="Confirm your password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                />
              </label>

              {error && <div className="auth-form__error" style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

              <button type="submit" className="auth-form__submit" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
