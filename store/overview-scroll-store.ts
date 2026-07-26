"use client";

import { create } from "zustand";

const STORAGE_KEY = "lf:overview-scroll-v1";

type OverviewScrollState = {
  /** Main dashboard page scroll offset (px). */
  scrollTop: number;
  setScrollTop: (scrollTop: number) => void;
  resetSession: () => void;
};

function readStoredScroll(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeStoredScroll(scrollTop: number) {
  if (typeof window === "undefined") return;
  try {
    if (scrollTop <= 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, String(Math.round(scrollTop)));
  } catch {
    /* private mode / quota — memory store still works */
  }
}

/**
 * Survives client navigations (dashboard → leads → dashboard).
 * Mirrored to sessionStorage so a soft refresh in the same tab keeps position.
 */
export const useOverviewScrollStore = create<OverviewScrollState>()((set) => ({
  scrollTop: 0,

  setScrollTop: (scrollTop) => {
    const next = Math.max(0, Math.round(scrollTop));
    set((state) => (state.scrollTop === next ? state : { scrollTop: next }));
    writeStoredScroll(next);
  },

  resetSession: () => {
    set({ scrollTop: 0 });
    writeStoredScroll(0);
  },
}));

/** Hydrate from sessionStorage once on the client (SSR-safe). */
export function hydrateOverviewScrollStore() {
  const stored = readStoredScroll();
  if (stored > 0 && useOverviewScrollStore.getState().scrollTop === 0) {
    useOverviewScrollStore.setState({ scrollTop: stored });
  }
}
