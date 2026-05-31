// Service for handling user component unlocks via MongoDB/API
import axios from 'axios';
import { getToken } from '../authService.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}`
  : import.meta.env.DEV
    ? 'http://localhost:5001/api'
    : '/api';

const getAuthHeaders = () => {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

// ─── Fetch all unlocked components for a user ─────────────────────────────────
// Backend route: GET /api/progress  (returns progress.unlockedComponents[])
export const fetchUserUnlocks = async (_userId) => {
  try {
    const response = await axios.get('/progress', {
      baseURL: API_BASE_URL,
      headers: getAuthHeaders(),
    });

    const unlockedComponents = response.data?.data?.unlockedComponents || [];
    return { unlockedComponentTypes: unlockedComponents };
  } catch (error) {
    console.error('Error fetching user unlocks:', error);
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Not authenticated — return empty, context will use level defaults
      return { unlockedComponentTypes: [] };
    }
    if (error.response?.status === 404) {
      return { unlockedComponentTypes: [] };
    }
    // Any other error — return empty so the app still works
    return { unlockedComponentTypes: [] };
  }
};

// ─── Save / sync unlocked components ─────────────────────────────────────────
// Backend route: POST /api/progress/unlock  (one component at a time)
// We only POST components that are NOT already on the server to avoid duplicates.
export const saveUserUnlocks = async (_userId, unlocks) => {
  const token = getToken();
  if (!token) {
    console.warn('No auth token available, skipping unlock save to MongoDB');
    return { unlockedComponentTypes: unlocks };
  }

  if (unlocks === '*') {
    // Wildcard — nothing to persist individually; just return
    return { unlockedComponentTypes: '*' };
  }

  const types = Array.isArray(unlocks) ? unlocks.filter(Boolean) : [];
  if (types.length === 0) return { unlockedComponentTypes: [] };

  // Fetch what is already stored so we only POST new ones
  let alreadyStored = [];
  try {
    const existing = await fetchUserUnlocks(_userId);
    alreadyStored = existing.unlockedComponentTypes || [];
  } catch {
    // If fetch fails we'll just try to save all — duplicates are handled server-side
  }

  const alreadySet = new Set(alreadyStored);
  const newTypes = types.filter(t => !alreadySet.has(t));

  if (newTypes.length === 0) {
    return { unlockedComponentTypes: types };
  }

  // POST each new unlock. The backend's unlockComponent() is idempotent (ignores duplicates).
  const results = await Promise.allSettled(
    newTypes.map(componentId =>
      axios.post(
        '/progress/unlock',
        { componentId, xpReward: 0, coinReward: 0 },
        { baseURL: API_BASE_URL, headers: getAuthHeaders() }
      )
    )
  );

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`Failed to save ${failed.length} unlock(s) to MongoDB`, failed);
  }

  return { unlockedComponentTypes: types };
};

// ─── Mark a project complete on the backend ───────────────────────────────────
// Backend route: POST /api/progress/complete
export const saveProjectComplete = async (projectSlug, xpReward = 0, badgeId = null) => {
  const token = getToken();
  if (!token) return null;

  try {
    const body = { projectId: projectSlug, slug: projectSlug, xpReward };
    if (badgeId) body.badgeId = badgeId;
    const response = await axios.post('/progress/complete', body, {
      baseURL: API_BASE_URL,
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.warn('Failed to save project completion to backend:', error);
    return null;
  }
};

// ─── Fetch completed projects from backend ────────────────────────────────────
export const fetchCompletedProjects = async () => {
  try {
    const response = await axios.get('/progress', {
      baseURL: API_BASE_URL,
      headers: getAuthHeaders(),
    });
    const rawProjects = response.data?.data?.completedProjects || [];
    // completedProjects on the backend is an array of objects {projectId, slug, ...}
    // The frontend stores them as plain slug strings — normalise here
    return rawProjects.map(p => (typeof p === 'string' ? p : p.slug || p.projectId)).filter(Boolean);
  } catch (error) {
    console.error('Error fetching completed projects:', error);
    return [];
  }
};

// ─── Classroom adventure unlocks (unchanged) ──────────────────────────────────
export const saveClassAdventureUnlocks = async (classId, componentTypes) => {
  try {
    const response = await axios.post(
      `/classroom/${classId}/adventure/unlocks`,
      { componentTypes },
      { baseURL: API_BASE_URL, headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Error saving classroom adventure unlocks:', error);
    throw error;
  }
};

export const fetchClassAdventureUnlocks = async (classId) => {
  try {
    const response = await axios.get(`/classroom/${classId}/adventure/unlocks`, {
      baseURL: API_BASE_URL,
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching classroom adventure unlocks:', error);
    throw error;
  }
};
