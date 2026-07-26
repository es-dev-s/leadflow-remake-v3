"use client";

import { create } from "zustand";

const STORAGE_KEY = "lf:leads-scroll-v1";

type LeadsScrollState = {
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
    /* ignore */
  }
}

export const useLeadsScrollStore = create<LeadsScrollState>()((set) => ({
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

export function hydrateLeadsScrollStore() {
  const stored = readStoredScroll();
  if (stored > 0 && useLeadsScrollStore.getState().scrollTop === 0) {
    useLeadsScrollStore.setState({ scrollTop: stored });
  }
}

export const LEADS_SCROLL_ATTR = "data-lf-leads-scroll";

export function leadsScrollSelector() {
  return `[${LEADS_SCROLL_ATTR}]`;
}

export function flushLeadsScroll() {
  if (typeof document === "undefined") return;
  const el = document.querySelector(
    leadsScrollSelector(),
  ) as HTMLElement | null;
  if (el) useLeadsScrollStore.getState().setScrollTop(el.scrollTop);
}
