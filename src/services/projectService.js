import { getToken } from './authService.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

function authHeaders() {
  const token = getToken();
  if (!token) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function saveProjectToCloud(project) {
  const headers = authHeaders();
  if (!headers) return null;
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify(project),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to save project');
  return data.project;
}

export async function listProjectsFromCloud() {
  const headers = authHeaders();
  if (!headers) return null;
  const res = await fetch(`${API_BASE}/projects`, { headers });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to list projects');
  return data.projects;
}

export async function getProjectFromCloud(projectId) {
  const headers = authHeaders();
  if (!headers) return null;
  const res = await fetch(`${API_BASE}/projects/${projectId}`, { headers });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to get project');
  return data.project;
}

export async function deleteProjectFromCloud(projectId) {
  const headers = authHeaders();
  if (!headers) return null;
  const res = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to delete project');
  return data;
}

export async function renameProjectOnCloud(projectId, name) {
  const headers = authHeaders();
  if (!headers) return null;
  const res = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to rename project');
  return data.project;
}
