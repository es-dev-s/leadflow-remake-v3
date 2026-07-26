"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VirtualWindowOptions = {
  root: HTMLElement | null;
  count: number;
  rowHeight: number;
  overscan?: number;
};

type VirtualWindow = {
  startIndex: number;
  endIndex: number;
  offsetTop: number;
  offsetBottom: number;
  totalHeight: number;
};

function computeWindow(
  scrollTop: number,
  viewportHeight: number,
  count: number,
  rowHeight: number,
  overscan: number,
): VirtualWindow {
  const safeCount = Math.max(0, count);
  const safeHeight = Math.max(1, rowHeight);
  const totalHeight = safeCount * safeHeight;
  const startIndex = Math.max(
    0,
    Math.floor(Math.max(0, scrollTop) / safeHeight) - overscan,
  );
  const visibleCount =
    Math.ceil(Math.max(1, viewportHeight) / safeHeight) + overscan * 2;
  const endIndex = Math.min(safeCount, startIndex + visibleCount);
  const offsetTop = startIndex * safeHeight;
  const offsetBottom = Math.max(0, totalHeight - endIndex * safeHeight);
  return { startIndex, endIndex, offsetTop, offsetBottom, totalHeight };
}

/**
 * Viewport window for large lists. Commits React state only when the visible
 * index range (or total height) changes — not on every scroll pixel.
 */
export function useVirtualWindow({
  root,
  count,
  rowHeight,
  overscan = 8,
}: VirtualWindowOptions): VirtualWindow {
  const paramsRef = useRef({ count, rowHeight, overscan });
  paramsRef.current = { count, rowHeight, overscan };

  const [windowState, setWindowState] = useState<VirtualWindow>(() =>
    computeWindow(0, 600, count, rowHeight, overscan),
  );
  const lastRef = useRef({ start: -1, end: -1, vh: -1, total: -1 });
  const rafRef = useRef(0);

  const commit = useCallback((scrollTop: number, viewportHeight: number) => {
    const { count: c, rowHeight: rh, overscan: ov } = paramsRef.current;
    const next = computeWindow(scrollTop, viewportHeight, c, rh, ov);
    const last = lastRef.current;
    if (
      last.start === next.startIndex &&
      last.end === next.endIndex &&
      last.vh === viewportHeight &&
      last.total === next.totalHeight
    ) {
      return;
    }
    lastRef.current = {
      start: next.startIndex,
      end: next.endIndex,
      vh: viewportHeight,
      total: next.totalHeight,
    };
    setWindowState(next);
  }, []);

  // Attach scroll + resize listeners once per root element.
  useEffect(() => {
    if (!root) return;

    const schedule = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        commit(root.scrollTop, root.clientHeight || 600);
      });
    };

    lastRef.current = { start: -1, end: -1, vh: -1, total: -1 };
    schedule();
    root.addEventListener("scroll", schedule, { passive: true });
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);

    return () => {
      cancelAnimationFrame(rafRef.current);
      root.removeEventListener("scroll", schedule);
      resizeObserver.disconnect();
    };
  }, [root, commit]);

  // Recompute when list length / row metrics change (no listener churn).
  useEffect(() => {
    if (!root) {
      const next = computeWindow(0, 600, count, rowHeight, overscan);
      lastRef.current = {
        start: next.startIndex,
        end: next.endIndex,
        vh: 600,
        total: next.totalHeight,
      };
      setWindowState(next);
      return;
    }
    lastRef.current = { start: -1, end: -1, vh: -1, total: -1 };
    commit(root.scrollTop, root.clientHeight || 600);
  }, [count, rowHeight, overscan, root, commit]);

  return windowState;
}
