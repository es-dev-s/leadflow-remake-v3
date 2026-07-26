"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  fetchSummaryBuckets,
  type SummaryBucketDimension,
} from "@/lib/api";

export const DASHBOARD_BUCKET_PAGE_SIZE = 50;

type Options = {
  dimension: SummaryBucketDimension;
  status?: string;
  country?: string;
  city?: string;
  pageSize?: number;
  enabled?: boolean;
};

/**
 * Offset pagination for high-cardinality dashboard mixes.
 * First page loads immediately; further pages load via IntersectionObserver.
 */
export function useDashboardBucketScroll<T>({
  dimension,
  status,
  country = "",
  city = "",
  pageSize = DASHBOARD_BUCKET_PAGE_SIZE,
  enabled = true,
}: Options) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [bucketCount, setBucketCount] = useState(0);
  const [leadTotal, setLeadTotal] = useState(0);
  const [wonTotal, setWonTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const epochRef = useRef(0);

  const geoKey = `${country}\0${city}\0${status ?? ""}\0${dimension}`;

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setHasMore(false);
      setBucketCount(0);
      setLeadTotal(0);
      setWonTotal(0);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const epoch = ++epochRef.current;
    offsetRef.current = 0;
    loadingMoreRef.current = false;
    setLoading(true);
    setLoadingMore(false);
    setError(null);

    void fetchSummaryBuckets<T>({
      dimension,
      status,
      country: country || undefined,
      city: city || undefined,
      offset: 0,
      limit: pageSize,
      signal: controller.signal,
    })
      .then((page) => {
        if (controller.signal.aborted || epoch !== epochRef.current) return;
        setItems(page.items);
        setHasMore(page.hasMore);
        setBucketCount(page.bucketCount);
        setLeadTotal(page.leadTotal);
        setWonTotal(page.wonTotal ?? 0);
        offsetRef.current = page.items.length;
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || epoch !== epochRef.current) return;
        setItems([]);
        setHasMore(false);
        setBucketCount(0);
        setLeadTotal(0);
        setWonTotal(0);
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!controller.signal.aborted && epoch === epochRef.current) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [enabled, geoKey, dimension, status, country, city, pageSize]);

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || loadingMoreRef.current) return;
    const epoch = epochRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchSummaryBuckets<T>({
        dimension,
        status,
        country: country || undefined,
        city: city || undefined,
        offset: offsetRef.current,
        limit: pageSize,
      });
      if (epoch !== epochRef.current) return;
      setItems((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
      setBucketCount(page.bucketCount);
      setLeadTotal(page.leadTotal);
      setWonTotal(page.wonTotal ?? 0);
      offsetRef.current += page.items.length;
    } catch (err: unknown) {
      if (epoch !== epochRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      if (epoch === epochRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [enabled, hasMore, dimension, status, country, city, pageSize]);

  const onIntersect = useEffectEvent(() => {
    void loadMore();
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!enabled || !hasMore || !sentinel) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => onIntersect());
      },
      {
        root: root ?? null,
        rootMargin: "240px 0px",
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [enabled, hasMore, items.length, geoKey]);

  return {
    items,
    hasMore,
    bucketCount,
    leadTotal,
    wonTotal,
    loading,
    loadingMore,
    error,
    scrollRootRef,
    sentinelRef,
  };
}
