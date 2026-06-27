import { getAdminToken, getToken } from "./authService.js";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const authHeaders = () => {
  const token = getToken();
  if (!token) throw new Error("No token found. Please sign in again.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const adminAuthHeaders = () => {
  const token = getAdminToken();
  if (!token) throw new Error("No admin token found. Please sign in again.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const parseResponse = async (response, fallbackErrorMessage) => {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || fallbackErrorMessage);
  return data;
};

export const getClassAdventureConfig = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/adventure/config`, {
    method: "GET",
    headers: authHeaders(),
    credentials: 'include'
  });
  return parseResponse(response, "Failed to fetch adventure configuration");
};

export const updateClassAdventureConfig = async (classId, content) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/adventure/config`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ content }),
    credentials: 'include'
  });
  return parseResponse(response, "Failed to save adventure configuration");
};

export const getResolvedClassAdventure = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/adventure`, {
    method: "GET",
    headers: authHeaders(),
  });
  return parseResponse(response, "Failed to fetch class adventure");
};

export const getMyClassAdventureProgress = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/adventure/progress/me`, {
    method: "GET",
    headers: authHeaders(),
  });
  return parseResponse(response, "Failed to fetch class progress");
};

export const postClassAdventureProgressEvent = async (classId, eventPayload) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/adventure/progress/events`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(eventPayload),
    credentials: 'include'
  });
  return parseResponse(response, "Failed to save progress event");
};

export const getClassAdventureStudentProgress = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/adventure/progress/students`, {
    method: "GET",
    headers: authHeaders(),
    credentials: 'include'
  });
  return parseResponse(response, "Failed to fetch student progress");
};

export const getAdminGlobalAdventureConfig = async () => {
  const response = await fetch(`${BASE_URL}/admin/adventure/config`, {
    method: "GET",
    headers: adminAuthHeaders(),
    credentials: "include",
  });
  return parseResponse(response, "Failed to fetch global adventure configuration");
};

export const updateAdminGlobalAdventureConfig = async (content) => {
  const response = await fetch(`${BASE_URL}/admin/adventure/config`, {
    method: "PUT",
    headers: adminAuthHeaders(),
    body: JSON.stringify({ content }),
    credentials: "include",
  });
  return parseResponse(response, "Failed to save global adventure configuration");
};

export const getGlobalAdventureConfig = async () => {
  const response = await fetch(`${BASE_URL}/adventure/config`, {
    method: "GET",
    headers: authHeaders(),
    credentials: "include",
  });
  return parseResponse(response, "Failed to fetch global adventure content");
};

export const getAdventureUnlocks = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/adventure/unlocks`, {
    method: "GET",
    headers: authHeaders(),
  });
  return parseResponse(response, "Failed to fetch adventure unlocks");
};
