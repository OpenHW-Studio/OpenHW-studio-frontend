import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Monitor, Settings } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import ClassroomSidebar from '../../components/common/ClassroomSidebar.jsx'

const sidebarLinks = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'simulator', label: 'Open Simulator', icon: Monitor },
  { key: 'settings', label: 'Settings', icon: Settings }
]

export default function UserDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const firstName = user?.name?.split(' ')[0] || 'User'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const navLinks = sidebarLinks.map((item) => ({
    ...item,
    isActive: item.key === 'home',
    onClick: () => {
      if (item.key === 'simulator') navigate('/simulator')
    }
  }))

  return (
    <div className="teacher-dashboard-page">
      <ClassroomSidebar links={navLinks} user={user} onLogout={handleLogout} />

      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="teacher-hero">
          <div className="teacher-hero__content">
            <p className="teacher-hero__eyebrow">Welcome Info</p>
            <h2 className="teacher-hero__title">{firstName}</h2>
            <p className="teacher-hero__summary">
              Welcome to your dashboard. Start a new hardward simulation or explore available components.
            </p>

            <div className="teacher-hero__actions">
              <button type="button" className="teacher-button teacher-button--primary" onClick={() => navigate('/simulator')}>
                Start Simulation
              </button>
              <button type="button" className="teacher-button teacher-button--secondary" onClick={() => navigate('/projects')}>
                Explore Projects
              </button>
            </div>
          </div>

          <div className="teacher-hero__badge" aria-hidden="true">
            <div className="teacher-hero__shape teacher-hero__shape--outer" />
            <div className="teacher-hero__shape teacher-hero__shape--inner" />
            <span className="teacher-hero__monogram">OH</span>
          </div>
        </section>

        <div className="mx-auto max-w-7xl pt-8 px-6 lg:px-8">
           <section className="bg-slate-900 rounded-3xl border border-slate-800 p-8 text-center text-slate-300">
             <Monitor size={48} className="mx-auto mb-4 text-cyan-500 opacity-80" />
             <h3 className="text-xl font-semibold text-white mb-2">Projects Area</h3>
             <p className="max-w-md mx-auto">Your saved simulations and projects will appear here in the future.</p>
           </section>
        </div>
      </main>
    </div>
  )
}
