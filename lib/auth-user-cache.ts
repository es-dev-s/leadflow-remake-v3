import type { PublicUser } from "@/lib/api";

const CACHED_USER_KEY = "lf_cached_user";

export function readCachedUser(): PublicUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicUser;
    if (!parsed?.id || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedUser(user: PublicUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (!user) sessionStorage.removeItem(CACHED_USER_KEY);
    else sessionStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota */
  }
}
