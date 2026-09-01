/**
 * AUTH SERVICE
 * Handles API communication between the frontend and the Node.js backend.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// ─── User Profile Normalisation ────────────────────────────────────────────

/**
 * Standardises field aliases on a raw user object in-place.
 * The backend may return `school` instead of `college`, or
 * `classStandard` instead of `semester`. This ensures the rest
 * of the app always reads the same field names.
 * @param {object|null} user
 * @returns {object|null}
 */
export const normalizeUser = (user) => {
  if (!user) return user;
  user.college = user.school || user.college;
  user.semester = user.classStandard || user.semester;
  return user;
};

// ─── Token & User Storage Helpers ───────────────────────────────────────────

export const saveToken = (token) => localStorage.setItem('openhw_token', token);
export const getToken = () => {
  const t = localStorage.getItem('openhw_token');
  return t === 'null' ? null : t;
};
export const removeToken = () => localStorage.removeItem('openhw_token');

export const saveUser = (user) => {
  localStorage.setItem('openhw_user', JSON.stringify(normalizeUser(user)));
};
export const getUser = () => {
  try {
    const userStr = localStorage.getItem('openhw_user');
    if (!userStr) return null;
    return normalizeUser(JSON.parse(userStr));
  } catch (e) {
    return null;
  }
};
export const removeUser = () => localStorage.removeItem('openhw_user');

// ─── Admin session Helpers ───────────────────────────────────────────────────
export const saveAdminToken = (token) => localStorage.setItem('openhw_admin_token', token)
export const getAdminToken = () => localStorage.getItem('openhw_admin_token')
export const removeAdminToken = () => localStorage.removeItem('openhw_admin_token')

export const saveAdminUser = (user) => localStorage.setItem('openhw_admin_user', JSON.stringify(user))
export const getAdminUser = () => {
  try {
    return JSON.parse(localStorage.getItem('openhw_admin_user'))
  } catch (e) {
    return null
  }
}
export const removeAdminUser = () => localStorage.removeItem('openhw_admin_user')

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
      bio: userData.bio,
      image: userData.image
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
export const loginUser = async (credentials, isAdminPortal = false) => {
  const response = await fetch(`${BASE_URL}/user/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
      role: credentials.role
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Login failed');
  }

  // Save the JWT and user data returned by the backend
  if (isAdminPortal) {
    if (data.token) saveAdminToken(data.token);
    if (data.user) saveAdminUser(data.user);
  } else {
    if (data.token) saveToken(data.token);
    if (data.user) saveUser(data.user);
  }

  return data; // Returns { message, token, user }
};

/**
 * Step 1 of OTP email verification signup.
 * Sends user's signup data to backend which validates it,
 * generates an OTP and emails it to the provided address.
 */
export const sendOtp = async (userData) => {
  const response = await fetch(`${BASE_URL}/user/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
      college: userData.college,
      semester: userData.semester,
      bio: userData.bio,
      image: userData.image,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to send verification code');
  }
  return data;
};

/**
 * Step 2 of OTP email verification signup.
 * Submits the OTP the user received. If correct, the backend creates
 * the user account and returns a JWT token.
 */
export const verifyOtp = async (email, otp) => {
  const response = await fetch(`${BASE_URL}/user/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Verification failed');
  }

  // On success, backend returns token + user — save them
  if (data.token) saveToken(data.token);
  if (data.user) saveUser(data.user);

  return data; // Returns { message, token, user }
};


/**
 * Google OAuth Login
 * Sends the access token to the backend for verification.
 */
export const googleLogin = async (accessToken, role, isAdminPortal = false) => {
  const response = await fetch(`${BASE_URL}/user/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, role }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Google login failed');
  }

  if (isAdminPortal) {
    if (data.token) saveAdminToken(data.token);
    if (data.user) saveAdminUser(data.user);
  } else {
    if (data.token) saveToken(data.token);
    if (data.user) saveUser(data.user);
  }

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

  // The /auth/me route is mounted at the root, not inside /api
  const authUrl = BASE_URL.replace(/\/api$/, '') + '/auth/me';

  const response = await fetch(authUrl, {
    headers: { 
      'Authorization': `Bearer ${token}` // Handled by protectRoute in backend
    },
  });

  const data = await response.json();
  if (!response.ok) {
    if (data && data.status === 'pending_deletion') {
      const pendingUser = {
        ...data,
        role: data.role || 'user',
        status: 'pending_deletion',
      };
      saveUser(pendingUser);
      return { success: true, user: pendingUser };
    }
    throw new Error(data.message || 'Failed to fetch profile');
  }
  
  if (data.user) saveUser(data.user); // normalizeUser is called inside saveUser
  
  return data;
};

export const updateProfile = async (profileData) => {
  const token = getToken();
  if (!token) throw new Error('No token found');

  const response = await fetch(`${BASE_URL}/user/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(profileData)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update profile');

  if (data.user) {
    saveUser(data.user);
  }

  return data;
};

export const forgotPassword = async (email) => {
  const response = await fetch(`${BASE_URL}/user/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to send reset link');
  return data;
};

export const resetPassword = async (token, password) => {
  const response = await fetch(`${BASE_URL}/user/reset-password/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Failed to reset password');
  return data;
};

// ─── Account Deletion ─────────────────────────────────────────────────────────

/** Step 1: Request an OTP to confirm account deletion */
export const requestDeletionOtp = async (token) => {
  const response = await fetch(`${BASE_URL}/user/delete-account/request-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Failed to send confirmation code');
  return data;
};

/** Step 2: Confirm deletion with the 6-digit OTP (and optional exit reason) */
export const confirmDeletion = async (token, otp, reason = '', feedback = '') => {
  const response = await fetch(`${BASE_URL}/user/delete-account/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ otp, reason, feedback }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Failed to confirm deletion');
  return data;
};

/** Request OTP for account reactivation */
export const requestReactivationOtp = async (token) => {
  const response = await fetch(`${BASE_URL}/user/delete-account/request-reactivate-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Failed to send reactivation code');
  return data;
};

/** Cancel deletion (Confirm reactivation with OTP) */
export const cancelDeletion = async (token, otp) => {
  const response = await fetch(`${BASE_URL}/user/delete-account/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ otp }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Failed to cancel deletion');
  return data;
};
