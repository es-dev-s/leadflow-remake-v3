"use client";

import { clearQueryCache } from "@/lib/query-cache";
import { useDashboardFilterStore } from "@/store/dashboard-filter-store";
import { useLeadsScrollStore } from "@/store/leads-scroll-store";
import { useLeadsStore } from "@/store/leads-store";
import { useOverviewScrollStore } from "@/store/overview-scroll-store";
import { usePresenceStore } from "@/store/presence-store";
import { useUiStore } from "@/store/ui-store";

/** Drop ephemeral client data so a new session never inherits another user's view. */
export function resetClientState() {
  clearQueryCache();
  useLeadsStore.getState().resetSession();
  useUiStore.getState().resetSession();
  useOverviewScrollStore.getState().resetSession();
  useLeadsScrollStore.getState().resetSession();
  useDashboardFilterStore.getState().clearFilters();
  usePresenceStore.getState().reset();
}

export function isAbortError(err: unknown) {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}
