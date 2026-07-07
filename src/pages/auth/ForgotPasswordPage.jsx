import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { forgotPassword } from '../../services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      await forgotPassword(email)
      setMessage('A reset link has been sent to your email address.')
    } catch (err) {
      setError(err.message || 'Failed to send reset link. Please check your email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen auth-screen--signin">
      <div className="auth-shell" style={{ display: 'flex', justifyContent: 'center' }}>
        <section className="auth-panel" style={{ width: '100%', maxWidth: '520px' }}>
          <Link to="/signin" className="auth-panel__back">Back to Sign In</Link>
          
          <div className="auth-panel__brand">
            <img src="/image.png" alt="OpenHW-Studio" className="brand-logo brand-logo--auth" />
          </div>

          <header className="auth-panel__header">
            <h2>Forgot Password</h2>
            <p>Enter your email and we'll send you a link to reset your password.</p>
          </header>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email Address</span>
              <input 
                type="email" 
                placeholder="Enter your email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value.trim())} 
                required 
              />
            </label>

            {message && <div className="auth-form__success" style={{ color: '#059669', marginBottom: '1rem', fontSize: '0.875rem' }}>{message}</div>}
            {error && <div className="auth-form__error" style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

            <button type="submit" className="auth-form__submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
