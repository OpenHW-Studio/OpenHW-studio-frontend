import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const getAuthHeader = () => {
  const token = localStorage.getItem("openhw_token") || localStorage.getItem("openhw_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const submitBugReport = async (data) => {
  const res = await axios.post(`${BASE_URL}/bugs`, data, {
    headers: getAuthHeader(),
    withCredentials: true,
  });
  return res.data;
};

export const fetchPublicBugReports = async (params = {}) => {
  const res = await axios.get(`${BASE_URL}/bugs`, { params });
  return res.data;
};

export const toggleBugUpvote = async (id) => {
  const res = await axios.post(
    `${BASE_URL}/bugs/${id}/upvote`,
    {},
    {
      headers: getAuthHeader(),
      withCredentials: true,
    }
  );
  return res.data;
};

export const toggleBugDownvote = async (id) => {
  const res = await axios.post(
    `${BASE_URL}/bugs/${id}/downvote`,
    {},
    {
      headers: getAuthHeader(),
      withCredentials: true,
    }
  );
  return res.data;
};

export const addBugCommentAdmin = async (id, text, adminToken) => {
  const headers = getAuthHeader();
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  const res = await axios.post(
    `${BASE_URL}/bugs/${id}/comments`,
    { text },
    {
      headers,
      withCredentials: true,
    }
  );
  return res.data;
};

export const updateBugStatusAdmin = async (id, updates, adminToken) => {
  const headers = {};
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  const res = await axios.patch(`${BASE_URL}/bugs/${id}`, updates, {
    headers,
    withCredentials: true,
  });
  return res.data;
};

export const deleteBugReportAdmin = async (id, adminToken) => {
  const headers = {};
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }
  const res = await axios.delete(`${BASE_URL}/bugs/${id}`, {
    headers,
    withCredentials: true,
  });
  return res.data;
};
