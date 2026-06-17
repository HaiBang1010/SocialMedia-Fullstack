import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/authStore';
import type { RefreshResponse } from '@/types/api';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// withCredentials → the httpOnly refresh cookie is sent on /auth/* requests (Phase Polish).
export const apiClient = axios.create({ baseURL, withCredentials: true });

// Mark requests we've already retried after a refresh, to avoid loops.
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Request interceptor: attach the current access token.
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single in-flight refresh shared by all concurrent 401s.
let refreshPromise: Promise<string> | null = null;

async function runRefresh(): Promise<string> {
  // Bare axios (not apiClient) so this call skips the interceptors — but WITH credentials so the
  // httpOnly refresh cookie is sent. The token lives in the cookie now, not in the request body.
  const { data } = await axios.post<RefreshResponse>(
    `${baseURL}/auth/refresh`,
    {},
    { withCredentials: true }
  );
  useAuthStore.getState().setAccessToken(data.accessToken);
  return data.accessToken;
}

// Response interceptor: on 401, try one refresh + retry. FIX 1: never
// redirect from here — just clear the store. ProtectedRoute reacts to
// !isAuthenticated and redirects to /login on its own.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;

    // Backend gộp chung error message (BACKLOG P2) → quyết định theo HTTP
    // status, không parse message.
    const isAuthError = error.response?.status === 401;
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (!isAuthError || !original || original._retry || isRefreshCall) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      // Single-flight: all concurrent 401s share one refresh attempt. The httpOnly cookie is sent
      // automatically (no token to read from the store anymore).
      refreshPromise = refreshPromise ?? runRefresh();
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original as AxiosRequestConfig);
    } catch (refreshError) {
      // Refresh failed (expired / wrong type / invalid) → force logout.
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  }
);
