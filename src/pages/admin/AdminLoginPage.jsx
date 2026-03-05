import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../context/AuthContext.jsx'
// import { googleLogin } from '../../services/authService.js'

export default function AdminLoginPage() {
    const navigate = useNavigate()
    const { login, isAdminAuthenticated, adminRole } = useAuth()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // If already logged in as admin, redirect to admin page
    useEffect(() => {
        if (isAdminAuthenticated && adminRole === 'admin') {
            navigate('/admin/dashboard')
        }
    }, [isAdminAuthenticated, adminRole, navigate])

    const mockAdminLogin = (googleUserInfo) => {
        const mockToken = 'mock_admin_jwt_token_replace_when_backend_ready'
        const mockUser = {
            id: 'mock_admin_001',
            name: googleUserInfo.name || 'Admin User',
            email: googleUserInfo.email || 'admin@openhw.io',
            picture: googleUserInfo.picture || '',
            role: 'admin',
            points: 0,
            coins: 0,
            level: 1,
        }
        login(mockToken, mockUser)
        navigate('/admin/dashboard')
    }

    const handleGoogleSuccess = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setLoading(true)
            setError('')
            try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                })
                const googleUser = await res.json()

                // Strictly restrict to this email for admin access
                if (googleUser.email !== '9661346164h@gmail.com') {
                    setError('Access denied. You are not authorized as an admin.')
                    setLoading(false)
                    return
                }

                // MOCK: simulate backend response
                mockAdminLogin(googleUser)

                // When backend is ready:
                // const { token, user } = await googleLogin(tokenResponse.access_token, 'admin')
                // login(token, user)
                // navigate('/admin')

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
                <div className="auth-logo">
                    <span className="brand-icon">⚡</span>
                    <span className="brand-name">OpenHW<span className="brand-accent">-Studio</span></span>
                </div>
                <h1 className="auth-title">Admin Login</h1>
                <p className="auth-subtitle">Restricted Area. Authorized Access Only.</p>

                {error && <div className="auth-error">⚠️ {error}</div>}

                <button
                    className={`google-btn ${loading ? 'loading' : ''}`}
                    onClick={() => handleGoogleSuccess()}
                    disabled={loading}
                >
                    {loading ? (
                        <span className="btn-loading">Verifying...</span>
                    ) : (
                        <>
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Admin Google Login
                        </>
                    )}
                </button>

                <p className="auth-guest-note mt-6">
                    <Link to="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Return to main site</Link>
                </p>
            </div>

            <div className="auth-bg">
                <div className="auth-bg-circuit" />
            </div>
        </div>
    )
}
