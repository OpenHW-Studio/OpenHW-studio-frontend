import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'

export default function TeacherDashboard() {
  const { user, logout } = useAuthStore() 
  const navigate = useNavigate()

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="brand-icon">⚡</span>
          <span>OpenHW-Studio</span>
        </div>
        <nav className="sidebar-nav">
          <a className="sidebar-link active">🏠 Dashboard</a>
          <a className="sidebar-link" onClick={() => navigate('/simulator')}>🖥️ Simulator</a>
          <a className="sidebar-link">🏫 My Classes</a>
          <a className="sidebar-link">📋 Assignments</a>
          <a className="sidebar-link">📊 Analytics</a>
          <a className="sidebar-link">🔴 Live Session</a>
        </nav>
        <button className="sidebar-logout" onClick={() => { logout(); navigate('/') }}>Sign Out</button>
      </aside>

      <main className="dashboard-main">
        <div className="dash-header">
          <div>
            <h1>Teacher Dashboard 👨‍🏫</h1>
            <p>{user?.name} · {user?.email}</p>
          </div>
          <div className="user-avatar">
            {user?.picture
              ? <img src={user.picture} alt="avatar" />
              : <div className="avatar-placeholder">{user?.name?.[0]}</div>
            }
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card"><div className="stat-num">0</div><div className="stat-label">🏫 Classes</div></div>
          <div className="stat-card"><div className="stat-num">0</div><div className="stat-label">👩‍🎓 Students</div></div>
          <div className="stat-card"><div className="stat-num">0</div><div className="stat-label">📋 Assignments</div></div>
          <div className="stat-card"><div className="stat-num">0</div><div className="stat-label">✅ Submissions</div></div>
        </div>

        <div className="section-title-row"><h2>Quick Actions</h2></div>
        <div className="quick-actions">
          <button className="action-card">
            <span>➕</span><span>Create Class</span>
          </button>
          <button className="action-card">
            <span>📋</span><span>New Assignment</span>
          </button>
          <button className="action-card">
            <span>🔴</span><span>Start Live Session</span>
          </button>
          <button className="action-card" onClick={() => navigate('/simulator')}>
            <span>🖥️</span><span>Open Simulator</span>
          </button>
        </div>

        <div className="section-title-row"><h2>My Classes</h2></div>
        <div className="empty-state">
          <div className="empty-icon">🏫</div>
          <p>No classes created yet. Create your first class to get started.</p>
          <button className="btn btn-primary">+ Create a Class</button>
        </div>
      </main>
    </div>
  )
}