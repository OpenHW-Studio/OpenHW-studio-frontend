import { getToken } from "./authService.js";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const authHeaders = () => {
  const token = getToken();
  if (!token) throw new Error("No token found. Please sign in again.");
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
  });
  return parseResponse(response, "Failed to fetch adventure configuration");
};

export const updateClassAdventureConfig = async (classId, content) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/adventure/config`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ content }),
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
  });
  return parseResponse(response, "Failed to save progress event");
};

export const getClassAdventureStudentProgress = async (classId) => {
  const response = await fetch(`${BASE_URL}/classroom/${classId}/adventure/progress/students`, {
    method: "GET",
    headers: authHeaders(),
  });
  return parseResponse(response, "Failed to fetch student progress");
};
