"use client";

import { create } from "zustand";
import {
  dashboardFiltersToDeepLink,
  normalizeDateRange,
} from "@/lib/lead-filter-labels";
import type { LeadsDeepLink } from "@/lib/leads-href";

export type DashboardFilters = {
  country: string;
  city: string;
  source: string;
  portal: string;
  teamId: string;
  teamName: string;
  analystId: string;
  analystName: string;
  salesExecId: string;
  salesExecName: string;
  status: string;
  stage: string;
  addedFrom: string;
  addedTo: string;
  filterValue: string;
};

export const EMPTY_DASHBOARD_FILTERS: DashboardFilters = {
  country: "",
  city: "",
  source: "",
  portal: "",
  teamId: "",
  teamName: "",
  analystId: "",
  analystName: "",
  salesExecId: "",
  salesExecName: "",
  status: "",
  stage: "",
  addedFrom: "",
  addedTo: "",
  filterValue: "all",
};

type DashboardFilterState = {
  filters: DashboardFilters;
  setFilters: (next: DashboardFilters) => void;
  clearFilters: () => void;
};

export function hasDashboardKpiFilters(filters: DashboardFilters) {
  return Boolean(filters.country || filters.city);
}

export function hasDashboardLeadLinkFilters(filters: DashboardFilters) {
  return (
    filters.filterValue !== "all" ||
    Boolean(
      filters.source ||
        filters.portal ||
        filters.teamId ||
        filters.analystId ||
        filters.salesExecId ||
        filters.status ||
        filters.stage ||
        filters.addedFrom ||
        filters.addedTo,
    )
  );
}

export function hasDashboardFilters(filters: DashboardFilters) {
  return hasDashboardKpiFilters(filters) || hasDashboardLeadLinkFilters(filters);
}

export function toDashboardDeepLink(filters: DashboardFilters): LeadsDeepLink {
  return dashboardFiltersToDeepLink(filters);
}

function normalize(next: DashboardFilters): DashboardFilters {
  const { addedFrom, addedTo } = normalizeDateRange(
    next.addedFrom ?? "",
    next.addedTo ?? "",
  );
  let filterValue = next.filterValue?.trim() || "all";
  let status = next.status?.trim() ?? "";
  // Exact status wins over coarse presets in the API — keep UI consistent.
  if (status) filterValue = "all";

  return {
    country: next.country?.trim() ?? "",
    city: next.city?.trim() ?? "",
    source: next.source?.trim() ?? "",
    portal: next.portal?.trim() ?? "",
    teamId: next.teamId?.trim() ?? "",
    teamName: next.teamName?.trim() ?? "",
    analystId: next.analystId?.trim() ?? "",
    analystName: next.analystName?.trim() ?? "",
    salesExecId: next.salesExecId?.trim() ?? "",
    salesExecName: next.salesExecName?.trim() ?? "",
    status,
    stage: next.stage?.trim() ?? "",
    addedFrom,
    addedTo,
    filterValue,
  };
}

export const useDashboardFilterStore = create<DashboardFilterState>()(
  (set, get) => ({
    filters: { ...EMPTY_DASHBOARD_FILTERS },

    setFilters: (next) => {
      const current = get().filters;
      const normalized = normalize(next);
      const same = (
        Object.keys(EMPTY_DASHBOARD_FILTERS) as (keyof DashboardFilters)[]
      ).every((key) => current[key] === normalized[key]);
      if (same) return;
      set({ filters: normalized });
    },

    clearFilters: () => {
      if (!hasDashboardFilters(get().filters)) return;
      set({ filters: { ...EMPTY_DASHBOARD_FILTERS } });
    },
  }),
);
