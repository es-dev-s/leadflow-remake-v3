/**
 * Browser session marker only — the JWT lives in an HttpOnly cookie set by
 * the CRM API. Never persist tokens in localStorage/sessionStorage.
 *
 * sessionId is a per-tab id (JWT jti) used to detect a newer login in
 * another window that still shares this origin's cookie.
 */

const SESSION_KEY = "leadflow.auth.session";
const EXPIRES_KEY = "leadflow.auth.expiresAt";
const SID_KEY = "leadflow.auth.sid";
const UID_KEY = "leadflow.auth.uid";
/** Legacy keys cleared on bootstrap so old JWTs are not left on disk. */
const LEGACY_TOKEN_KEY = "leadflow.auth.token";

export const COOKIE_SESSION = "cookie-session";
export const SESSION_HEADER = "X-LeadFlow-Session";

function purgeLegacyToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

/** True when this tab believes a cookie session may exist. */
export function hasSessionMarker(): boolean {
  if (typeof window === "undefined") return false;
  purgeLegacyToken();
  const marker = window.sessionStorage.getItem(SESSION_KEY);
  if (!marker) return false;
  const expiresAt = window.sessionStorage.getItem(EXPIRES_KEY);
  if (expiresAt) {
    const ms = Date.parse(expiresAt);
    if (!Number.isNaN(ms) && ms <= Date.now()) {
      clearAuthToken();
      return false;
    }
  }
  return true;
}

/** @deprecated Use hasSessionMarker — JWT is no longer readable by JS. */
export function getAuthToken(): string | null {
  return hasSessionMarker() ? COOKIE_SESSION : null;
}

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const id = window.sessionStorage.getItem(SID_KEY)?.trim();
  return id || null;
}

export function setSessionId(sessionId: string) {
  if (typeof window === "undefined") return;
  const id = sessionId.trim();
  if (!id) return;
  window.sessionStorage.setItem(SID_KEY, id);
}

export function getSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  const id = window.sessionStorage.getItem(UID_KEY)?.trim();
  return id || null;
}

export function setSessionUserId(userId: string) {
  if (typeof window === "undefined") return;
  const id = userId.trim();
  if (!id) return;
  window.sessionStorage.setItem(UID_KEY, id);
}

export function clearSessionId() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SID_KEY);
  window.sessionStorage.removeItem(UID_KEY);
}

export function setAuthToken(_token: string, expiresAt?: string) {
  if (typeof window === "undefined") return;
  purgeLegacyToken();
  window.sessionStorage.setItem(SESSION_KEY, "1");
  if (expiresAt) {
    window.sessionStorage.setItem(EXPIRES_KEY, expiresAt);
  } else {
    window.sessionStorage.removeItem(EXPIRES_KEY);
  }
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  purgeLegacyToken();
  window.sessionStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(EXPIRES_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  window.localStorage.removeItem(EXPIRES_KEY);
}
