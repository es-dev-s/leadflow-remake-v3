"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  buildLeadsHref,
  mergeLeadDeepLink,
  type LeadsDeepLink,
} from "@/lib/leads-href";
import { useOverviewScrollStore } from "@/store/overview-scroll-store";
import {
  toDashboardDeepLink,
  useDashboardFilterStore,
} from "@/store/dashboard-filter-store";
import { useLeadsStore } from "@/store/leads-store";

export const OVERVIEW_SCROLL_ATTR = "data-lf-overview-scroll";

export function overviewScrollSelector() {
  return `[${OVERVIEW_SCROLL_ATTR}]`;
}

/** Flush overview scroll into the store before leaving the page. */
export function flushOverviewScroll() {
  if (typeof document === "undefined") return;
  const el = document.querySelector(
    overviewScrollSelector(),
  ) as HTMLElement | null;
  if (el) useOverviewScrollStore.getState().setScrollTop(el.scrollTop);
}

/** Navigate to /leads with structured filters (dashboard click-through). */
export function useNavigateToLeads() {
  const router = useRouter();

  return useCallback(
    (link: LeadsDeepLink) => {
      flushOverviewScroll();
      const filters = useDashboardFilterStore.getState().filters;
      const merged = mergeLeadDeepLink(toDashboardDeepLink(filters), link);
      useLeadsStore.getState().applyDeepLink(merged);
      router.push(buildLeadsHref(merged));
    },
    [router],
  );
}
