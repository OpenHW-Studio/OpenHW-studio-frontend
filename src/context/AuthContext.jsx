import { createContext, useContext, useState, useEffect } from 'react'
import {
  getUser, getToken, saveUser, saveToken, logout as logoutService,
  getAdminUser, getAdminToken, saveAdminUser, saveAdminToken, removeAdminToken, removeAdminUser
} from '../services/authService.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [adminUser, setAdminUser] = useState(null)
  const [adminToken, setAdminToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session(s) from localStorage on app load
  useEffect(() => {
    const storedUser = getUser()
    const storedToken = getToken()
    if (storedUser && storedToken) {
      if (storedUser.role === 'admin') {
        // Clear the old admin session from standard storage to fix redirect conflicts
        logoutService()
      } else {
        setUser(storedUser)
        setToken(storedToken)
      }
    }

    const storedAdminUser = getAdminUser()
    const storedAdminToken = getAdminToken()
    if (storedAdminUser && storedAdminToken) {
      setAdminUser(storedAdminUser)
      setAdminToken(storedAdminToken)
    }

    setLoading(false)
  }, [])

  /**
   * Called after successful Google OAuth + backend verification
   * @param {string} jwtToken - JWT from your backend
   * @param {object} userProfile - { id, name, email, role, points, coins, level }
   */
  const login = (jwtToken, userProfile) => {
    if (userProfile.role === 'admin') {
      saveAdminToken(jwtToken)
      saveAdminUser(userProfile)
      setAdminToken(jwtToken)
      setAdminUser(userProfile)
    } else {
      saveToken(jwtToken)
      saveUser(userProfile)
      setToken(jwtToken)
      setUser(userProfile)
    }
  }

  const logout = () => {
    logoutService()
    setUser(null)
    setToken(null)
  }

  const adminLogout = () => {
    removeAdminToken()
    removeAdminUser()
    setAdminUser(null)
    setAdminToken(null)
  }

  const isAuthenticated = !!user && !!token
  const role = user?.role || null // 'student' | 'teacher'

  const isAdminAuthenticated = !!adminUser && !!adminToken
  const adminRole = adminUser?.role || null // 'admin'

  return (
    <AuthContext.Provider value={{
      // Main student/teacher session
      user, token, isAuthenticated, role,

      // Admin session
      adminUser, adminToken, isAdminAuthenticated, adminRole,

      // Actions
      login, logout, adminLogout, loading
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
