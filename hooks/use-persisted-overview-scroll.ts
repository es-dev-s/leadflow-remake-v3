"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import {
  hydrateOverviewScrollStore,
  useOverviewScrollStore,
} from "@/store/overview-scroll-store";

const RESTORE_MAX_MS = 2500;
const RESTORE_EPSILON = 2;

/**
 * Persist + restore the main overview scroll container.
 *
 * Race-safe:
 * - Ignores saves while restoring
 * - Retries via rAF + ResizeObserver until content is tall enough
 * - Aborts restore if the user scrolls / wheels / touches
 * - Epoch cancels stale restore loops (Strict Mode / remount)
 */
export function usePersistedOverviewScroll() {
  const ref = useRef<HTMLDivElement | null>(null);
  const setScrollTop = useOverviewScrollStore((s) => s.setScrollTop);
  const restoringRef = useRef(false);
  const userInterruptedRef = useRef(false);
  const epochRef = useRef(0);

  const flushSave = useEffectEvent(() => {
    const el = ref.current;
    if (!el || restoringRef.current) return;
    setScrollTop(el.scrollTop);
  });

  // Hydrate + bind save listeners.
  useEffect(() => {
    hydrateOverviewScrollStore();
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      if (restoringRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
      });
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

  // Restore after mount; keep retrying as async sections grow height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    hydrateOverviewScrollStore();
    const target = useOverviewScrollStore.getState().scrollTop;
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
      // Keep wherever the user landed.
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

      const reachedTarget =
        maxScroll + RESTORE_EPSILON >= target &&
        Math.abs(el.scrollTop - target) <= RESTORE_EPSILON;
      const timedOut = performance.now() - startedAt >= RESTORE_MAX_MS;

      if (reachedTarget || timedOut) {
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
  }, [setScrollTop]);

  return ref;
}
