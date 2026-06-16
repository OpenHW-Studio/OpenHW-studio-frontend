// Service for Project Bank API operations
import axios from 'axios';
import { getToken } from './authService.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}` : (import.meta.env.DEV ? 'http://localhost:5001/api' : '/api');

const authHeaders = () => {
  const token = getToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

export const getMyProjectBank = async () => {
  const response = await axios.get(`${API_BASE_URL}/project-bank`, { headers: authHeaders() });
  return response.data;
};

export const getSharedProjectBank = async () => {
  const response = await axios.get(`${API_BASE_URL}/project-bank/shared`, { headers: authHeaders() });
  return response.data;
};

export const createProjectBankEntry = async (projectData) => {
  const response = await axios.post(`${API_BASE_URL}/project-bank`, projectData, { headers: authHeaders() });
  return response.data;
};

export const importToProjectBank = async (projectData) => {
  const response = await axios.post(`${API_BASE_URL}/project-bank/import`, projectData, { headers: authHeaders() });
  return response.data;
};

export const duplicateProjectBankEntry = async (projectId) => {
  const response = await axios.post(`${API_BASE_URL}/project-bank/${projectId}/duplicate`, {}, { headers: authHeaders() });
  return response.data;
};

export const updateProjectBankEntry = async (projectId, updates) => {
  const response = await axios.put(`${API_BASE_URL}/project-bank/${projectId}`, updates, { headers: authHeaders() });
  return response.data;
};

export const deleteProjectBankEntry = async (projectId) => {
  const response = await axios.delete(`${API_BASE_URL}/project-bank/${projectId}`, { headers: authHeaders() });
  return response.data;
};

export const publishProjectBankEntry = async (projectId) => {
  const response = await axios.put(`${API_BASE_URL}/project-bank/${projectId}/publish`, {}, { headers: authHeaders() });
  return response.data;
};

export const unpublishProjectBankEntry = async (projectId) => {
  const response = await axios.put(`${API_BASE_URL}/project-bank/${projectId}/unpublish`, {}, { headers: authHeaders() });
  return response.data;
};

export const getProjectBySlug = async (slug) => {
  const response = await axios.get(`${API_BASE_URL}/project-bank/slug/${slug}`, { headers: authHeaders() });
  return response.data;
};