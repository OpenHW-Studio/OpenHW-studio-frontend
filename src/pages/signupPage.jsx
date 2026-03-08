import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'
import { signupUser } from '../services/authService.js'

export default function SignupPage() {
  const navigate = useNavigate()
 
  const { login, isAuthenticated, role } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student', 
    college: '',
    semester: ''
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

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await signupUser(formData)
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
 
      <div className="auth-card max-w-[500px] w-full box-border">
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

   
        <form className="flex flex-col gap-4 mt-4 w-full" onSubmit={handleSignup}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <div className="flex flex-col gap-1.5 text-left w-full">
              <label className="text-sm font-medium text-slate-300">Full Name</label>
              <input className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg text-white text-base transition-all duration-200 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400" type="text" name="name" placeholder="John Doe" value={formData.name} onChange={handleInputChange} required />
            </div>
            <div className="flex flex-col gap-1.5 text-left w-full">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <input className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg text-white text-base transition-all duration-200 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400" type="email" name="email" placeholder="name@college.edu" value={formData.email} onChange={handleInputChange} required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-left w-full">
            <label className="text-sm font-medium text-slate-300">Password (Min 8 chars)</label>
            <input className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg text-white text-base transition-all duration-200 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400" type="password" name="password" placeholder="••••••••" minLength="8" value={formData.password} onChange={handleInputChange} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <div className="flex flex-col gap-1.5 text-left w-full">
              <label className="text-sm font-medium text-slate-300">College (Optional)</label>
              <input className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg text-white text-base transition-all duration-200 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400" type="text" name="college" placeholder="IIT Bombay" value={formData.college} onChange={handleInputChange} />
            </div>
            <div className="flex flex-col gap-1.5 text-left w-full">
              <label className="text-sm font-medium text-slate-300">Semester (Optional)</label>
              <input className="w-full bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg text-white text-base transition-all duration-200 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400" type="number" name="semester" min="1" max="12" placeholder="1" value={formData.semester} onChange={handleInputChange} />
            </div>
          </div>

          <button type="submit" className="w-full bg-sky-400 text-slate-900 font-bold px-4 py-3 rounded-lg border-none cursor-pointer text-base transition-all duration-200 mt-2 hover:bg-sky-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-400">
          Already have an account? <Link to="/signin" className="text-sky-400 font-bold no-underline ml-1">Sign In</Link>
        </p>
      </div>
      <div className="auth-bg"><div className="auth-bg-circuit" /></div>
    </div>
  )
}