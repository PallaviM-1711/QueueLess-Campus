/**
 * axiosClient.ts
 * Pre-configured Axios instance.
 * - Reads the API base URL from the VITE_API_URL env var (fallback to '' so
 *   the Vite dev-server proxy handles /api/* transparently in development).
 * - Attaches the JWT stored in localStorage on every request (Phase 2).
 * - Converts non-2xx responses to thrown errors with useful messages.
 */

import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach auth token if present
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('qlc_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — surface meaningful error messages
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message: string =
      error?.response?.data?.message ?? error.message ?? 'An error occurred';
    const apiError = new Error(message) as Error & { status?: number };
    apiError.status = error?.response?.status;
    return Promise.reject(apiError);
  }
);

export default axiosClient;
