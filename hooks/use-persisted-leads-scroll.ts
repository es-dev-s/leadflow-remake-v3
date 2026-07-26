"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import {
  hydrateLeadsScrollStore,
  LEADS_SCROLL_ATTR,
  useLeadsScrollStore,
} from "@/store/leads-scroll-store";

const RESTORE_MAX_MS = 1200;
const RESTORE_EPSILON = 2;

type Options = {
  /** When true, attempt restore (e.g. after rows are present). */
  enabled?: boolean;
  rowHeight?: number;
};

/**
 * Persist leads table scroll across route changes and soft reloads.
 * Race-safe: epoch cancel, user-interrupt, ResizeObserver retry.
 */
export function usePersistedLeadsScroll({
  enabled = true,
  rowHeight = 64,
}: Options = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const setScrollTop = useLeadsScrollStore((s) => s.setScrollTop);
  const restoringRef = useRef(false);
  const userInterruptedRef = useRef(false);
  const epochRef = useRef(0);

  const flushSave = useEffectEvent(() => {
    const el = ref.current;
    if (!el || restoringRef.current) return;
    setScrollTop(el.scrollTop);
  });

  useEffect(() => {
    hydrateLeadsScrollStore();
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      if (restoringRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollTop(el.scrollTop));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    const onPageHide = () => flushSave();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      flushSave();
    };
  }, [setScrollTop]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    hydrateLeadsScrollStore();
    const target = useLeadsScrollStore.getState().scrollTop;
    if (target <= 0) {
      restoringRef.current = false;
      return;
    }

    const epoch = ++epochRef.current;
    restoringRef.current = true;
    userInterruptedRef.current = false;
    const startedAt = performance.now();

    const markInterrupted = () => {
      if (!restoringRef.current) return;
      userInterruptedRef.current = true;
      restoringRef.current = false;
      setScrollTop(el.scrollTop);
    };

    el.addEventListener("wheel", markInterrupted, { passive: true });
    el.addEventListener("touchstart", markInterrupted, { passive: true });
    el.addEventListener("pointerdown", markInterrupted);

    const apply = () => {
      if (epoch !== epochRef.current || userInterruptedRef.current) return false;
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const next = Math.min(target, maxScroll);
      if (Math.abs(el.scrollTop - next) > RESTORE_EPSILON) {
        el.scrollTop = next;
      }
      const reached =
        maxScroll + RESTORE_EPSILON >= target &&
        Math.abs(el.scrollTop - target) <= RESTORE_EPSILON;
      const timedOut = performance.now() - startedAt >= RESTORE_MAX_MS;
      if (reached || timedOut) {
        restoringRef.current = false;
        setScrollTop(el.scrollTop);
        return true;
      }
      return false;
    };

    let raf = 0;
    const tick = () => {
      if (epoch !== epochRef.current || userInterruptedRef.current) return;
      if (apply()) return;
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => {
      if (epoch !== epochRef.current || userInterruptedRef.current) return;
      if (restoringRef.current) apply();
    });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    raf = requestAnimationFrame(tick);

    return () => {
      epochRef.current += 1;
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("wheel", markInterrupted);
      el.removeEventListener("touchstart", markInterrupted);
      el.removeEventListener("pointerdown", markInterrupted);
      restoringRef.current = false;
    };
  }, [enabled, rowHeight, setScrollTop]);

  return {
    scrollRef: ref,
    scrollAttr: { [LEADS_SCROLL_ATTR]: "" } as Record<string, string>,
    flushSave,
  };
}

/** Restore scroll to an anchor row or previous offset after a soft reload. */
export function restoreLeadsScrollPosition(
  el: HTMLElement | null,
  opts: {
    scrollTop: number;
    anchorId?: string;
    items: ReadonlyArray<{ id: string }>;
    rowHeight?: number;
  },
) {
  if (!el) return;
  const rowHeight = opts.rowHeight ?? 64;
  const index = opts.anchorId
    ? opts.items.findIndex((item) => item.id === opts.anchorId)
    : -1;
  const next =
    index >= 0
      ? index * rowHeight
      : Math.min(
          opts.scrollTop,
          Math.max(0, el.scrollHeight - el.clientHeight),
        );
  el.scrollTop = next;
  useLeadsScrollStore.getState().setScrollTop(el.scrollTop);
}
