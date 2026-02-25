import { createContext, useContext, useState, useEffect } from 'react'
import { getUser, getToken, saveUser, saveToken, logout as logoutService } from '../services/authService.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on app load
  useEffect(() => {
    const storedUser = getUser()
    const storedToken = getToken()
    if (storedUser && storedToken) {
      setUser(storedUser)
      setToken(storedToken)
    }
    setLoading(false)
  }, [])

  /**
   * Called after successful Google OAuth + backend verification
   * @param {string} jwtToken - JWT from your backend
   * @param {object} userProfile - { id, name, email, role, points, coins, level }
   */
  const login = (jwtToken, userProfile) => {
    saveToken(jwtToken)
    saveUser(userProfile)
    setToken(jwtToken)
    setUser(userProfile)
  }

  const logout = () => {
    logoutService()
    setUser(null)
    setToken(null)
  }

  const isAuthenticated = !!user && !!token
  const role = user?.role || null // 'student' | 'teacher' | 'admin'

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
