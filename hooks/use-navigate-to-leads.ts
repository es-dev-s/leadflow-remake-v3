"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  buildLeadsHref,
  type LeadsDeepLink,
} from "@/lib/leads-href";
import { useOverviewScrollStore } from "@/store/overview-scroll-store";
import {
  toDashboardDeepLink,
  useDashboardFilterStore,
} from "@/store/dashboard-filter-store";

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

function mergeDashboardLeadLink(
  base: LeadsDeepLink,
  link: LeadsDeepLink,
): LeadsDeepLink {
  const merged: LeadsDeepLink = { ...base, ...link };
  if (link.filter) {
    merged.status = undefined;
    merged.stage = undefined;
  }
  if (link.stage) {
    merged.filter = undefined;
    merged.status = undefined;
  }
  if (link.status) {
    merged.filter = undefined;
    merged.stage = undefined;
  }
  return merged;
}

/** Navigate to /leads with structured filters (dashboard click-through). */
export function useNavigateToLeads() {
  const router = useRouter();
  const filters = useDashboardFilterStore((s) => s.filters);

  return useCallback(
    (link: LeadsDeepLink) => {
      flushOverviewScroll();
      router.push(
        buildLeadsHref(mergeDashboardLeadLink(toDashboardDeepLink(filters), link)),
      );
    },
    [router, filters],
  );
}
