"use client";

/**
 * Tiny TTL cache for aggregate GET responses (summaries, buckets, geo…).
 * Makes tab back-navigation instant instead of refetching identical data.
 * Cleared on every realtime event and on login/logout, so it can never show
 * stale data after a mutation — the TTL only bounds staleness from writes
 * made outside this app.
 */

type CacheEntry = {
  data: unknown;
  at: number;
};

const entries = new Map<string, CacheEntry>();
const MAX_ENTRIES = 300;

export function readQueryCache<T>(key: string, ttlMs: number): T | undefined {
  const hit = entries.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttlMs) {
    entries.delete(key);
    return undefined;
  }
  return hit.data as T;
}

export function writeQueryCache(key: string, data: unknown) {
  if (entries.size >= MAX_ENTRIES) {
    entries.clear();
  }
  entries.set(key, { data, at: Date.now() });
}

export function clearQueryCache() {
  entries.clear();
}
