"use client";

import { create } from "zustand";
import {
  clearAuthToken,
  COOKIE_SESSION,
  getAuthToken,
  setAuthToken,
  setSessionId,
  setSessionUserId,
  clearSessionId,
  getSessionId,
} from "@/lib/auth-token";
import { resetClientState } from "@/lib/reset-client-state";
import { writeCachedUser } from "@/lib/auth-user-cache";
import {
  announceSession,
  bumpAuthEpoch,
  noteAuthWrite,
} from "@/lib/session-lock";
import { realtime } from "@/lib/realtime";
import type { PublicUser } from "@/lib/api";
import {
  canManageUsers as canManageUsersRole,
  canViewUsers as canViewUsersRole,
  isSuperadmin as roleIsSuperadmin,
} from "@/lib/roles";

type AuthState = {
  /** Opaque session marker — never a JWT. */
  token: string | null;
  user: PublicUser | null;
  bootstrapped: boolean;
  setSession: (
    token: string,
    expiresAt: string,
    user: PublicUser,
    sessionId?: string,
  ) => void;
  setUser: (user: PublicUser | null) => void;
  clearSession: (opts?: { server?: boolean }) => void;
  markBootstrapped: () => void;
  hydrateToken: () => string | null;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  user: null,
  bootstrapped: false,

  setSession: (_token, expiresAt, user, sessionId) => {
    const prevUserId = get().user?.id;
    noteAuthWrite();
    setAuthToken(COOKIE_SESSION, expiresAt);
    if (sessionId?.trim()) {
      setSessionId(sessionId.trim());
      setSessionUserId(user.id);
      announceSession(sessionId.trim(), user.id);
    }
    writeCachedUser(user);
    set({ token: COOKIE_SESSION, user, bootstrapped: true });
    if (prevUserId && prevUserId !== user.id) {
      resetClientState();
    }
    realtime.refreshAuth();
  },

  setUser: (user) => {
    writeCachedUser(user);
    set({ user });
  },

  clearSession: (opts) => {
    const server = opts?.server !== false;
    const sid = getSessionId();
    bumpAuthEpoch();
    if (server) {
      void import("@/lib/api")
        .then((m) => m.logoutRequest(sid))
        .catch(() => {
          /* ignore */
        });
    }
    clearAuthToken();
    clearSessionId();
    writeCachedUser(null);
    resetClientState();
    set({ token: null, user: null, bootstrapped: true });
    realtime.refreshAuth();
  },

  markBootstrapped: () => set({ bootstrapped: true }),

  hydrateToken: () => {
    const token = getAuthToken();
    set({ token });
    return token;
  },
}));

export function isSuperadmin(user: PublicUser | null | undefined) {
  return roleIsSuperadmin(user?.role);
}

export function canManageUsers(user: PublicUser | null | undefined) {
  return canManageUsersRole(user?.role);
}

export function canViewUsers(user: PublicUser | null | undefined) {
  return canViewUsersRole(user?.role);
}
