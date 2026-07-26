"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useLeadsStore } from "@/store/leads-store";

type InfiniteScrollOptions = {
  root: HTMLElement | null;
  enabled: boolean;
  hasMore: boolean;
  queryEpoch: number;
  /** Re-arm when the loaded window grows (sentinel may stay intersecting). */
  itemCount: number;
};

/**
 * Race-safe infinite scroll against the API cursor.
 * Captures queryEpoch per observation; stale epochs no-op inside the store.
 */
export function useInfiniteLeadScroll({
  root,
  enabled,
  hasMore,
  queryEpoch,
  itemCount,
}: InfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMore = useLeadsStore((s) => s.loadMore);
  const isLoadingMore = useLeadsStore((s) => s.isLoadingMore);
  const loadingRef = useRef(false);
  loadingRef.current = isLoadingMore;

  const onIntersect = useEffectEvent(() => {
    if (!enabled || !hasMore || loadingRef.current) return;
    void loadMore(queryEpoch);
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !sentinel || !hasMore) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          onIntersect();
        });
      },
      {
        root: root ?? null,
        rootMargin: "280px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // Intentionally omit isLoadingMore — re-arming the observer on every page
    // load caused scroll jitter when the sentinel stayed near the viewport.
  }, [enabled, root, queryEpoch, hasMore, itemCount]);

  return {
    sentinelRef,
    isLoadingMore,
  };
}
