"use client";

import { useEffect } from "react";
import { sendHeartbeat } from "@/lib/telemetry-api";
import { useAuthStore } from "@/store/auth-store";

const INTERVAL_MS = 20_000;

/** Quiet presence heartbeat for all authenticated roles. */
export function TelemetryHeartbeat() {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!token || !userId) return;
    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") return;
      void sendHeartbeat();
    };

    beat();
    const id = window.setInterval(beat, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, userId]);

  return null;
}
