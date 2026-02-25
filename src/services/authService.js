/**
 * AUTH SERVICE
 * All API calls related to authentication.
 * Replace BASE_URL with your actual backend URL when ready.
 * 
 * Currently uses localStorage to simulate auth state (no backend needed).
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

// ─── Token Helpers ───────────────────────────────────────────────────────────

export const saveToken = (token) => localStorage.setItem('openhw_token', token)
export const getToken = () => localStorage.getItem('openhw_token')
export const removeToken = () => localStorage.removeItem('openhw_token')

export const saveUser = (user) => localStorage.setItem('openhw_user', JSON.stringify(user))
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('openhw_user'))
  } catch {
    return null
  }
}
export const removeUser = () => localStorage.removeItem('openhw_user')

// ─── API Calls ───────────────────────────────────────────────────────────────

/**
 * Send Google OAuth credential token to backend.
 * Backend verifies it, creates/finds user, returns JWT + user profile.
 * 
 * @param {string} googleCredential - The credential string from Google OAuth response
 * @param {string} role - 'student' | 'teacher'
 * @returns {Promise<{token: string, user: object}>}
 */
export const googleLogin = async (googleCredential, role) => {
  const response = await fetch(`${BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: googleCredential, role }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Google login failed')
  }

  return response.json() // expects { token, user: { id, name, email, role, points, coins, level } }
}

/**
 * Email/password login (future use)
 */
export const emailLogin = async (email, password) => {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Login failed')
  }

  return response.json()
}

/**
 * Fetch current user profile using stored JWT
 */
export const fetchProfile = async () => {
  const token = getToken()
  if (!token) throw new Error('No token found')

  const response = await fetch(`${BASE_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) throw new Error('Failed to fetch profile')
  return response.json()
}

/**
 * Logout - clears local storage
 */
export const logout = () => {
  removeToken()
  removeUser()
}
