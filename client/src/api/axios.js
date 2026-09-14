import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_URL || 'https://vaksetu.onrender.com/api';
// Automatically sanitize any -api typo in Render domain
const cleanBaseUrl = rawBaseUrl.replace('vaksetu-api.onrender.com', 'vaksetu.onrender.com');

const api = axios.create({
  baseURL: cleanBaseUrl,
  withCredentials: true,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for attaching auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Auto-logout if token is expired or invalid
      // localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export default api;
