"use client";

import { create } from "zustand";
import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from "@/lib/auth-token";
import { resetClientState } from "@/lib/reset-client-state";
import { writeCachedUser } from "@/lib/auth-user-cache";
import { realtime } from "@/lib/realtime";
import type { PublicUser } from "@/lib/api";
import {
  canManageUsers as canManageUsersRole,
  canViewUsers as canViewUsersRole,
  isSuperadmin as roleIsSuperadmin,
} from "@/lib/roles";

type AuthState = {
  token: string | null;
  user: PublicUser | null;
  bootstrapped: boolean;
  setSession: (token: string, expiresAt: string, user: PublicUser) => void;
  setUser: (user: PublicUser | null) => void;
  clearSession: () => void;
  markBootstrapped: () => void;
  hydrateToken: () => string | null;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  user: null,
  bootstrapped: false,

  setSession: (token, expiresAt, user) => {
    const prevUserId = get().user?.id;
    setAuthToken(token, expiresAt);
    writeCachedUser(user);
    set({ token, user, bootstrapped: true });
    // Switching accounts in the same browser must drop the previous user's data.
    if (prevUserId && prevUserId !== user.id) {
      resetClientState();
    }
    realtime.refreshAuth();
  },

  setUser: (user) => {
    writeCachedUser(user);
    set({ user });
  },

  clearSession: () => {
    clearAuthToken();
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
