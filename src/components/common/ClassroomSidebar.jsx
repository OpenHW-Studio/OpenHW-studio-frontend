import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getAvatarLetters } from './test.js'

export default function ClassroomSidebar({ links, user, onLogout }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('openhw_theme') || document.documentElement.getAttribute('data-theme') || 'light'
  )
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const avatarInitials = getAvatarLetters(user?.name, user?.role === 'teacher' ? 'T' : 'S')

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('openhw_theme', next)
      return next
    })
  }

  return (
    <aside className="teacher-sidebar teacher-sidebar--fixed">
      <div className="teacher-sidebar__brand">
        <img src="/image.png" alt="OpenHW-Studio" className="brand-logo brand-logo--sidebar" />
      </div>

      <nav className="teacher-sidebar__nav" aria-label="Navigation">
        {links.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`teacher-sidebar__link${item.isActive ? ' is-active' : ''}`}
            onClick={item.onClick}
          >
            <span className="teacher-sidebar__link-icon" aria-hidden="true">
              <item.icon size={14} strokeWidth={2.1} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="teacher-sidebar-profile">
        <button type="button" className="teacher-theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <button
          type="button"
          className="teacher-sidebar-profile__trigger"
          onClick={() => setShowProfileMenu((s) => !s)}
        >
          <span className="teacher-sidebar-profile__avatar">{avatarInitials}</span>
          <span className="teacher-sidebar-profile__copy">
            <strong>{user?.name || 'User'}</strong>
            <small>Profile</small>
          </span>
        </button>

        {showProfileMenu && (
          <div className="teacher-sidebar-profile__menu">
            <button type="button" onClick={onLogout}>Logout</button>
          </div>
        )}
      </div>
    </aside>
  )
}
