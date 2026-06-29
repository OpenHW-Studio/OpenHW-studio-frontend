// Service for handling user component unlocks via MongoDB/API
import axios from 'axios';
import { getToken } from '../authService.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}` : (import.meta.env.DEV ? 'http://localhost:5001/api' : '/api');

const getAuthHeaders = () => {
  const token = getToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const fetchUserUnlocks = async (userId) => {
  try {
    const response = await axios.get(`/gamification/unlocks/${userId}`, {
      baseURL: API_BASE_URL,
      headers: getAuthHeaders(),
    });

    // If no unlocks found, return empty array (will be combined with level unlocks)
    return { unlockedComponentTypes: response.data.unlockedComponentTypes || [] };
  } catch (error) {
    console.error('Error fetching user unlocks:', error);
    // If user has no unlocks recorded yet, return empty array
    if (error.response && error.response.status === 404) {
      return { unlockedComponentTypes: [] };
    }
    throw error;
  }
};

export const saveUserUnlocks = async (userId, unlocks) => {
  const token = getToken();
  if (!token) {
    // No auth token - skip API call, user may not be logged in
    console.warn('No auth token available, skipping unlock save to MongoDB');
    return { unlockedComponentTypes: unlocks };
  }
  try {
    const response = await axios.put(
      `/gamification/unlocks/${userId}`,
      { unlockedComponentTypes: unlocks },
      { baseURL: API_BASE_URL, headers: getAuthHeaders() }
    );

    return response.data;
  } catch (error) {
    // Handle 404 (not found) gracefully - return local data
    if (error.response && error.response.status === 404) {
      console.log('No unlocks record found yet, will be created on next save');
      return { unlockedComponentTypes: unlocks };
    }
    console.error('Error saving user unlocks:', error);
    throw error;
  }
};

export const fetchUserGamificationState = async (userId) => {
  try {
    const response = await axios.get(`/gamification/state/${userId}`, {
      baseURL: API_BASE_URL,
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user gamification state:', error);
    if (error.response && error.response.status === 404) {
      return { state: {} };
    }
    throw error;
  }
};

export const saveUserGamificationState = async (userId, state) => {
  const token = getToken();
  if (!token) {
    console.warn('No auth token available, skipping state save to MongoDB');
    return { state };
  }
  try {
    const response = await axios.put(
      `/gamification/state/${userId}`,
      { state },
      { baseURL: API_BASE_URL, headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Error saving user gamification state:', error);
    throw error;
  }
};

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