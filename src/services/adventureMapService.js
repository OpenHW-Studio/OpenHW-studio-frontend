import { getToken } from "./authService";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:5001/api" : "/api");

function getAuthHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/**
 * Fetch adventure maps list with filters
 */
export async function fetchAdventureMaps({ tab = 'all', board, search, page = 1, limit = 12, classroomId } = {}) {
  const params = new URLSearchParams();
  if (tab) params.set('tab', tab);
  if (board && board !== 'all') params.set('board', board);
  if (search) params.set('search', search);
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  if (classroomId) params.set('classroomId', classroomId);

  const res = await fetch(`${API_BASE}/adventure-maps?${params.toString()}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch adventure maps');
  }
  return res.json();
}

/**
 * Fetch a single adventure map by ID or Slug
 */
export async function fetchAdventureMapById(slugOrId) {
  const res = await fetch(`${API_BASE}/adventure-maps/${encodeURIComponent(slugOrId)}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Adventure map not found');
  }
  return res.json();
}

/**
 * Create a new adventure map
 */
export async function createAdventureMap(payload) {
  const res = await fetch(`${API_BASE}/adventure-maps`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create adventure map');
  }
  return data;
}

/**
 * Update an existing adventure map
 */
export async function updateAdventureMap(id, payload) {
  const res = await fetch(`${API_BASE}/adventure-maps/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update adventure map');
  }
  return data;
}

/**
 * Delete an adventure map
 */
export async function deleteAdventureMap(id) {
  const res = await fetch(`${API_BASE}/adventure-maps/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete adventure map');
  }
  return data;
}

/**
 * Record custom mission completion for student
 */
export async function recordAdventureMissionComplete(mapId, missionSlug, xpReward = 100) {
  const res = await fetch(`${API_BASE}/adventure-maps/${encodeURIComponent(mapId)}/complete-mission`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ missionSlug, xpReward })
  });
  return res.json();
}

/**
 * Claim custom adventure certificate
 */
export async function claimAdventureCertificate(mapId) {
  const res = await fetch(`${API_BASE}/adventure-maps/${encodeURIComponent(mapId)}/claim-cert`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to claim certificate');
  }
  return data;
}
