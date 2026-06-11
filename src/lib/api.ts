import axios from "axios";
import { clearToken, getToken } from "./token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On an expired/invalid session during normal app use, drop the token and
// bounce to login. Login (/auth/login) and the bootstrap (/auth/me) handle
// their own 401s, so we skip them here to avoid clobbering their error UX.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    const isAuthFlow = url.includes("/auth/login") || url.includes("/auth/me");
    if (status === 401 && !isAuthFlow) {
      clearToken();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

/** Extract structured field errors from a 422 validation response, if present. */
export function apiValidationErrors(
  error: unknown,
): { scope: string; field: string; error: string }[] | null {
  if (axios.isAxiosError(error)) {
    const errs = error.response?.data?.detail?.errors;
    if (Array.isArray(errs)) return errs;
  }
  return null;
}

/** Pull a human-readable message out of an axios error. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail?.message) return detail.message;
    if (error.message) return error.message;
  }
  return fallback;
}
