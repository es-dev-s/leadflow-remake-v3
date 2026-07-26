const TOKEN_KEY = "leadflow.auth.token";
const EXPIRES_KEY = "leadflow.auth.expiresAt";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const expiresAt = window.localStorage.getItem(EXPIRES_KEY);
  if (expiresAt) {
    const ms = Date.parse(expiresAt);
    if (!Number.isNaN(ms) && ms <= Date.now()) {
      clearAuthToken();
      return null;
    }
  }
  return token;
}

export function setAuthToken(token: string, expiresAt?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  if (expiresAt) {
    window.localStorage.setItem(EXPIRES_KEY, expiresAt);
  } else {
    window.localStorage.removeItem(EXPIRES_KEY);
  }
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(EXPIRES_KEY);
}
