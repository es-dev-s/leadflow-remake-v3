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
  type LeadScopeQuery,
  type SummaryBucketDimension,
} from "@/lib/api";
import {
  dashboardFiltersToScope,
  useDashboardFilterStore,
} from "@/store/dashboard-filter-store";

export const DASHBOARD_BUCKET_PAGE_SIZE = 10;

type Options = {
  dimension: SummaryBucketDimension;
  status?: string;
  country?: string;
  city?: string;
  pageSize?: number;
  enabled?: boolean;
  /** When false (default), the page scroll stays primary — load the rest via revealAll. */
  autoLoad?: boolean;
  previewLimit?: number;
};

function scopeFromFilters(
  dimension: SummaryBucketDimension,
  status: string | undefined,
  filters: ReturnType<typeof dashboardFiltersToScope>,
): LeadScopeQuery & { dimension: SummaryBucketDimension; status?: string } {
  const scope = { ...filters };
  if (dimension === "reasons") {
    scope.status = undefined;
  }
  return {
    ...scope,
    dimension,
    ...(status ? { status } : {}),
  };
}

/**
 * Offset pagination for high-cardinality dashboard mixes.
 * First page loads immediately. Extra rows load on demand (View more),
 * not by trapping the wheel inside the card.
 */
export function useDashboardBucketScroll<T>({
  dimension,
  status,
  pageSize = DASHBOARD_BUCKET_PAGE_SIZE,
  enabled = true,
  autoLoad = false,
  previewLimit = DASHBOARD_BUCKET_PAGE_SIZE,
}: Options) {
  const filters = useDashboardFilterStore((s) => s.filters);
  const scope = dashboardFiltersToScope(filters);
  const scopeKey = JSON.stringify(scopeFromFilters(dimension, status, scope));
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [bucketCount, setBucketCount] = useState(0);
  const [leadTotal, setLeadTotal] = useState(0);
  const [wonTotal, setWonTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const epochRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setHasMore(false);
      setBucketCount(0);
      setLeadTotal(0);
      setWonTotal(0);
      setLoading(false);
      setExpanded(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const epoch = ++epochRef.current;
    offsetRef.current = 0;
    loadingMoreRef.current = false;
    setLoading(true);
    setLoadingMore(false);
    setExpanded(false);
    setError(null);

    void fetchSummaryBuckets<T>({
      ...scopeFromFilters(dimension, status, scopeRef.current),
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
  }, [enabled, scopeKey, dimension, status, pageSize]);

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || loadingMoreRef.current) return;
    const epoch = epochRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchSummaryBuckets<T>({
        ...scopeFromFilters(dimension, status, scopeRef.current),
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
  }, [enabled, hasMore, dimension, status, pageSize]);

  const revealAll = useCallback(async () => {
    if (!enabled) {
      setExpanded(true);
      return;
    }
    if (hasMore && !loadingMoreRef.current) {
      const epoch = epochRef.current;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      try {
        const remaining = Math.max(bucketCount - offsetRef.current, pageSize);
        const page = await fetchSummaryBuckets<T>({
          ...scopeFromFilters(dimension, status, scopeRef.current),
          offset: offsetRef.current,
          limit: Math.max(remaining, 1_000),
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
    }
    setExpanded(true);
  }, [enabled, hasMore, bucketCount, dimension, status, pageSize]);

  const collapse = useCallback(() => setExpanded(false), []);

  const onIntersect = useEffectEvent(() => {
    void loadMore();
  });

  useEffect(() => {
    if (!autoLoad) return;
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
  }, [autoLoad, enabled, hasMore, items.length, scopeKey]);

  const previewItems = expanded ? items : items.slice(0, previewLimit);
  const hiddenCount = Math.max(bucketCount, items.length) - previewLimit;

  return {
    items,
    previewItems,
    hasMore,
    bucketCount,
    leadTotal,
    wonTotal,
    loading,
    loadingMore,
    error,
    expanded,
    canExpand: hiddenCount > 0 || hasMore,
    hiddenCount: Math.max(hiddenCount, 0),
    revealAll,
    collapse,
    scrollRootRef,
    sentinelRef,
  };
}
