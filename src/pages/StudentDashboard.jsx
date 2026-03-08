import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from "../store/authStore.js";

export default function StudentDashboard() {
  const { isAuthenticated, user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const S = { logo: { background: 'none', border: 'none', color: 'var(--accent)', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 } }

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <button style={S.logo} onClick={() => navigate('/')}>? OpenHW-Studio</button>
        </div>
        <nav className="sidebar-nav">
          <a className="sidebar-link active">?? Dashboard</a>
          <a className="sidebar-link" onClick={() => navigate('/simulator')}>??? Simulator</a>
          <a className="sidebar-link">?? My Classes</a>
          <a className="sidebar-link">?? My Projects</a>
          <a className="sidebar-link">?? Achievements</a>
          <a className="sidebar-link">?? Progress</a>
        </nav>
        <button className="sidebar-logout" onClick={handleLogout}>Sign Out</button>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        {/* Header */}
        <div className="dash-header">
          <div>
            <h1>Welcome back, {user?.name?.split(' ')[0]} ??</h1>
            <p>Level {user?.level || 1} Student · {user?.email}</p>
          </div>
          <div className="dash-header-actions">
            <button className="btn btn-ghost" onClick={toggleTheme} title="Toggle Dark/Light Mode">
              {theme === 'dark' ? '?? Light' : '?? Dark'}
            </button>
            <div className="user-avatar">
              {user?.picture ? (
                <img src={user.picture} alt="Profile" referrerPolicy="no-referrer" />
              ) : (
                <div className="avatar-placeholder">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card"><div className="stat-num">{user?.points || 0}</div><div className="stat-label">? Points</div></div>
          <div className="stat-card"><div className="stat-num">{user?.coins || 0}</div><div className="stat-label">?? Coins</div></div>
          <div className="stat-card"><div className="stat-num">{user?.level || 1}</div><div className="stat-label">?? Level</div></div>
          <div className="stat-card"><div className="stat-num">0</div><div className="stat-label">? Completed</div></div>
        </div>

        {/* Quick Actions */}
        <div className="section-title-row"><h2>Quick Actions</h2></div>
        <div className="quick-actions">
          <button className="action-card" onClick={() => navigate('/simulator')}>
            <span>???</span>
            <span>Open Simulator</span>
          </button>
          <button className="action-card">
            <span>?</span>
            <span>Join a Class</span>
          </button>
          <button className="action-card">
            <span>??</span>
            <span>View Assignments</span>
          </button>
        </div>

        {/* Classes */}
        <div className="section-title-row"><h2>My Classes</h2></div>
        <div className="empty-state">
          <div className="empty-icon">??</div>
          <p>You haven't joined any classes yet.</p>
          <button className="btn btn-primary">Join a Class with Code</button>
        </div>
      </main>
    </div>
  )
}