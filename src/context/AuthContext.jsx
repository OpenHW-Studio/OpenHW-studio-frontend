import { createContext, useContext, useState, useEffect } from 'react'
import {
  getUser, getToken, saveUser, saveToken, logout as logoutService,
  getAdminUser, getAdminToken, saveAdminUser, saveAdminToken, removeAdminToken, removeAdminUser,
  fetchProfile
} from '../services/authService.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [adminUser, setAdminUser] = useState(null)
  const [adminToken, setAdminToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session(s) from localStorage or URL on app load
  useEffect(() => {
    const handleInitialLoad = async () => {
      // 1. Check if returning from Google OAuth with a token in URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');

      if (urlToken) {
        // Save token temporarily to fetch profile
        saveToken(urlToken);
        try {
          // Fetch the user's profile using the new token
          const data = await fetchProfile();
          if (data && data.user) {
            login(urlToken, data.user); // Save to context and local storage
          }
        } catch (error) {
          console.error("Failed to fetch profile with OAuth token:", error);
          logoutService();
        } finally {
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        // 2. Normal load: Check local storage
        const storedUser = getUser()
        const storedToken = getToken()
        if (storedUser && storedToken) {
          if (storedUser.role === 'admin') {
            logoutService()
          } else {
            setUser(storedUser)
            setToken(storedToken)
          }
        }
      }

      const storedAdminUser = getAdminUser()
      const storedAdminToken = getAdminToken()
      if (storedAdminUser && storedAdminToken) {
        setAdminUser(storedAdminUser)
        setAdminToken(storedAdminToken)
      }

      setLoading(false)
    };

    handleInitialLoad();
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

  const updateUserSession = (userProfile) => {
    saveUser(userProfile)
    setUser(userProfile)
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
      login, logout, adminLogout, updateUserSession, loading
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
