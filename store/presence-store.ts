"use client";

import { create } from "zustand";
import type { RealtimeEvent } from "@/lib/realtime";

export type PresenceUser = {
  userId: string;
  teamId?: string;
  role?: string;
};

type PresenceState = {
  hydrated: boolean;
  byId: Record<string, PresenceUser>;
  applyEvent: (evt: RealtimeEvent) => void;
  markSelfOnline: (user: PresenceUser) => void;
  reset: () => void;
};

function upsert(
  byId: Record<string, PresenceUser>,
  user: PresenceUser,
): Record<string, PresenceUser> {
  const id = user.userId.trim();
  if (!id) return byId;
  return { ...byId, [id]: { ...byId[id], ...user, userId: id } };
}

export function countOnline(
  byId: Record<string, PresenceUser>,
  teamId?: string | null,
) {
  const team = teamId?.trim();
  let n = 0;
  for (const row of Object.values(byId)) {
    if (team && team !== "none" && (row.teamId || "") !== team) continue;
    n += 1;
  }
  return n;
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  hydrated: false,
  byId: {},

  markSelfOnline: (user) => {
    set({ byId: upsert(get().byId, user) });
  },

  applyEvent: (evt) => {
    const type = evt.type;
    if (type === "presence.sync") {
      const next: Record<string, PresenceUser> = {};
      for (const row of evt.users ?? []) {
        const id = row.userId?.trim();
        if (!id) continue;
        next[id] = {
          userId: id,
          teamId: row.teamId,
          role: row.role,
        };
      }
      set({ hydrated: true, byId: next });
      return;
    }
    const userId = evt.userId?.trim();
    if (!userId) return;
    if (type === "presence.online") {
      set({
        hydrated: true,
        byId: upsert(get().byId, {
          userId,
          teamId: evt.teamId,
          role: evt.role,
        }),
      });
      return;
    }
    if (type === "presence.offline") {
      const byId = { ...get().byId };
      delete byId[userId];
      set({ hydrated: true, byId });
    }
  },

  reset: () => set({ hydrated: false, byId: {} }),
}));
