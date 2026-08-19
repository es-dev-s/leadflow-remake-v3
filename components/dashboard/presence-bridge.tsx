"use client";

import { useEffect } from "react";
import { subscribeRealtime } from "@/lib/realtime";
import { useAuthStore } from "@/store/auth-store";
import { usePresenceStore } from "@/store/presence-store";

/** Keeps live Online/Offline presence in sync with the SSE socket. */
export function PresenceBridge() {
  const userId = useAuthStore((s) => s.user?.id);
  const teamId = useAuthStore((s) => s.user?.teamId);
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (!userId) return;
    usePresenceStore.getState().markSelfOnline({
      userId,
      teamId: teamId ?? "",
      role: role ?? "",
    });
    return subscribeRealtime((evt) => {
      if (!evt.type.startsWith("presence.")) return;
      usePresenceStore.getState().applyEvent(evt);
    });
  }, [userId, teamId, role]);

  return null;
}
