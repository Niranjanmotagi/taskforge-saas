import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiFailure } from '@taskforge/shared-types';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Axios client with silent token refresh:
 *  - attaches the in-memory access token
 *  - on 401, performs ONE refresh (deduped across concurrent failures)
 *    against the httpOnly cookie endpoint and replays the request
 */
export const api = axios.create({
  baseURL: clientEnv.apiUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

/** Refresh the access token using the httpOnly cookie. Deduped. */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ data: { accessToken: string } }>(
        `${clientEnv.apiUrl}/auth/refresh`,
        {},
        { withCredentials: true }
      )
      .then((res) => {
        const token = res.data.data.accessToken;
        useAuthStore.getState().setSession(token);
        return token;
      })
      .catch(() => {
        useAuthStore.getState().clear();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiFailure>) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retried && !original.url?.includes('/auth/')) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api.request(original);
      }
    }
    return Promise.reject(error);
  }
);

/** Extract a human-readable message from an API error. */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiFailure | undefined;
    if (body?.error?.details?.length) {
      return body.error.details.map((d) => d.message).join('. ');
    }
    if (body?.error?.message) return body.error.message;
    if (error.code === 'ERR_NETWORK') return 'Cannot reach the server — is the API running?';
  }
  return 'Something went wrong. Please try again.';
}

/** Unwrap the { success, data } envelope. */
export async function get<T>(url: string, params?: object): Promise<T> {
  const res = await api.get<{ data: T }>(url, { params });
  return res.data.data;
}

export async function post<T>(url: string, body?: object): Promise<T> {
  const res = await api.post<{ data: T }>(url, body);
  return res.data.data;
}

export async function patch<T>(url: string, body?: object): Promise<T> {
  const res = await api.patch<{ data: T }>(url, body);
  return res.data.data;
}

export async function put<T>(url: string, body?: object): Promise<T> {
  const res = await api.put<{ data: T }>(url, body);
  return res.data.data;
}

export async function del<T>(url: string): Promise<T> {
  const res = await api.delete<{ data: T }>(url);
  return res.data.data;
}
