
import { useNavigate } from 'react-router-dom'

export default function RoleSelectPage() {
  const navigate = useNavigate()
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Select Your Role</h1>
        <p>How will you be using OpenHW-Studio?</p>
        <div className="role-options">
          <button className="role-btn" onClick={() => navigate('/student/dashboard')}>
            <span className="role-emoji">🎓</span>
            <span className="role-text">Student</span>
          </button>
          <button className="role-btn" onClick={() => navigate('/teacher/dashboard')}>
            <span className="role-emoji">👨‍🏫</span>
            <span className="role-text">Teacher</span>
          </button>
        </div>
      </div>
    </div>
  )
}
