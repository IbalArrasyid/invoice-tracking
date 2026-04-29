import axios from 'axios';

// ─── Base URL ────────────────────────────────────────────────────
// Vite env: tambahkan VITE_API_URL=http://localhost:3000 di .env frontend
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─── Axios Instance ───────────────────────────────────────────────
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor — tambahkan JWT token otomatis ───────────
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

// ─── Response Interceptor — tangani 401 global ───────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token kedaluwarsa atau tidak valid → hapus sesi
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect ke login jika ada router (opsional)
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
