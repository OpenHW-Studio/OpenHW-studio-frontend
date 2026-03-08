/**
 * AUTH SERVICE
 * Handles API communication between the frontend and the Node.js backend.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// ─── Token & User Storage Helpers ───────────────────────────────────────────

export const saveToken = (token) => localStorage.setItem('openhw_token', token);
export const getToken = () => localStorage.getItem('openhw_token');
export const removeToken = () => localStorage.removeItem('openhw_token');

export const saveUser = (user) => localStorage.setItem('openhw_user', JSON.stringify(user));
export const getUser = () => {
  try {
    const user = localStorage.getItem('openhw_user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};
export const removeUser = () => localStorage.removeItem('openhw_user');

// ─── API Calls ───────────────────────────────────────────────────────────────
/**
 * Register a new user
 * Connects to 'signupUser' in userController.js
 */
export const signupUser = async (userData) => {
  const response = await fetch(`${BASE_URL}/user/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
      college: userData.college,
      branch: userData.branch,
      semester: userData.semester,
      bio: userData.bio
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Backend returns 'error' field for signup failures
    throw new Error(data.error || 'Registration failed');
  }

  // Automatically log in the user after successful registration
  if (data.token) saveToken(data.token);
  if (data.user) saveUser(data.user);

  return data; // Returns { message, user, token }
};

/**
 * Native Email/Password Login
 * Matches 'signinUser' in userController.js
 */
export const loginUser = async (credentials) => {
  const response = await fetch(`${BASE_URL}/user/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }

  // Save the JWT and user data returned by the backend
  if (data.token) saveToken(data.token);
  if (data.user) saveUser(data.user);

  return data; // Returns { message, token, user }
};

/**
 * Google OAuth Login
 * Sends the access token to the backend for verification.
 */
export const googleLogin = async (accessToken, role) => {
  const response = await fetch(`${BASE_URL}/user/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, role }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Google login failed');
  }

  if (data.token) saveToken(data.token);
  if (data.user) saveUser(data.user);

  return data;
};

/**
 * Logout
 * Clears local storage and notifies the backend to clear the JWT cookie.
 */
export const logout = async () => {
  try {
    const token = getToken();
    // Calls logoutController in userController.js
    await fetch(`${BASE_URL}/user/logout`, { 
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (err) {
    console.error("Backend logout failed", err);
  } finally {
    removeToken();
    removeUser();
  }
};

/**
 * Fetch current user profile using stored JWT
 * Protected by protectRoute middleware
 */
export const fetchProfile = async () => {
  const token = getToken();
  if (!token) throw new Error('No token found');

  const response = await fetch(`${BASE_URL}/user/profile`, {
    headers: { 
      'Authorization': `Bearer ${token}` // Handled by protectRoute in backend
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch profile');
  
  return data;
};