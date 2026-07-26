"use client";

import { useEffect, useState } from "react";
import {
  hydrateLeadsScrollStore,
  useLeadsScrollStore,
} from "@/store/leads-scroll-store";
import { useLeadsStore } from "@/store/leads-store";

/**
 * Server-backed leads query.
 * Filter/sort/page happen in Postgres via keyset cursors — the browser only
 * keeps the loaded window (not the full million-row table).
 */
export function useLeadsQuery() {
  const [ready, setReady] = useState(false);

  const filterValue = useLeadsStore((s) => s.filterValue);
  const sortValue = useLeadsStore((s) => s.sortValue);
  const items = useLeadsStore((s) => s.items);
  const totalAvailable = useLeadsStore((s) => s.totalAvailable);
  const hasMore = useLeadsStore((s) => s.hasMore);
  const queryEpoch = useLeadsStore((s) => s.queryEpoch);
  const isQueryPending = useLeadsStore((s) => s.isQueryPending);
  const isInitialLoading = useLeadsStore((s) => s.isInitialLoading);
  const error = useLeadsStore((s) => s.error);
  const refreshLeads = useLeadsStore((s) => s.refreshLeads);
  const refreshLeadsPreservingWindow = useLeadsStore(
    (s) => s.refreshLeadsPreservingWindow,
  );

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        await useLeadsStore.persist?.rehydrate?.();
      } catch {
        // Prefs hydrate is best-effort; leads still load from API.
      }
      if (cancelled) return;
      setReady(true);
      hydrateLeadsScrollStore();
      const scrollTop = useLeadsScrollStore.getState().scrollTop;
      if (scrollTop > 0) {
        await refreshLeadsPreservingWindow({
          scrollTop,
          clientHeight:
            typeof window !== "undefined" ? window.innerHeight : 720,
          rowHeight: 64,
        });
      } else {
        await refreshLeads();
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [refreshLeads, refreshLeadsPreservingWindow]);

  return {
    filterValue,
    sortValue,
    isQueryPending: isQueryPending || isInitialLoading || !ready,
    isInitialLoading: isInitialLoading || !ready,
    windowLeads: items,
    totalAvailable,
    windowCount: items.length,
    hasMore,
    queryEpoch,
    error,
    refreshLeads,
    refreshLeadsPreservingWindow,
  };
}
