import type { LeadsDeepLink } from "@/lib/leads-href";
import { QUALIFICATION_OPTIONS } from "@/lib/lead-form-options";
import type { DashboardFilters } from "@/store/dashboard-filter-store";
import type { LeadFacets } from "@/store/leads-store";

export const LEAD_PRESET_OPTIONS = [
  { id: "all", label: "All leads" },
  { id: "qualified", label: "Qualified" },
  { id: "new", label: "Not qualified" },
  { id: "irrelevant", label: "Irrelevant" },
  { id: "passed-se-tl", label: "Passed to SE/TLs" },
  { id: "not-passed", label: "Not passed" },
  { id: "in-progress", label: "In progress" },
  { id: "converted", label: "Closed" },
  { id: "lost", label: "Lost" },
  { id: "open", label: "Open" },
] as const;

/** Legacy / chip labels kept for deep links that are not in the preset picker. */
export const EXTRA_LEAD_PRESET_OPTIONS = [
  { id: "passed", label: "Passed to sales" },
  { id: "assigned", label: "Passed to SE/TLs" },
  { id: "contacted", label: "In progress" },
  { id: "with-team-lead", label: "With team lead" },
  { id: "with-sales-exec", label: "With executive" },
] as const;

export const LEAD_STAGE_OPTIONS = [
  { value: "WITH_TEAM_LEAD", label: "With team lead" },
  { value: "WITH_EXECUTIVE", label: "With executive" },
  { value: "NOT_CONNECTED", label: "Not Connected" },
  { value: "IN_NEGOTIATION", label: "In Negotiation" },
  { value: "NO_RESPONSE_FROM_CLIENT", label: "No Response from Client" },
  { value: "CLOSED_WON", label: "Closed" },
  { value: "CLOSED_LOST", label: "Lost" },
] as const;

/** Global SE outcome statuses (per lead). */
export const SE_OUTCOME_OPTIONS = [
  { value: "IN_NEGOTIATION", label: "In Negotiation" },
  { value: "NOT_CONNECTED", label: "Not Connected" },
  { value: "NO_RESPONSE_FROM_CLIENT", label: "No Response from Client" },
  { value: "CLOSED_WON", label: "Closed" },
  { value: "CLOSED_LOST", label: "Lost" },
] as const;

export type SeOutcomeValue = (typeof SE_OUTCOME_OPTIONS)[number]["value"];

export function isSeOutcomeValue(
  value: string | null | undefined,
): value is SeOutcomeValue {
  return SE_OUTCOME_OPTIONS.some((option) => option.value === value);
}

export function seOutcomeLabel(value: string | null | undefined) {
  const match = SE_OUTCOME_OPTIONS.find((option) => option.value === value);
  return match?.label ?? (value ? value.replace(/_/g, " ") : "");
}

/** Blank geo bucket — matches DB coalesced "Unknown" and UI sentinels. */
export const BLANK_GEO = "Unknown";

export function isBlankGeoValue(value: string | null | undefined) {
  const v = (value ?? "").trim().toLowerCase();
  return v === "unknown" || v === "none" || v === "unassigned" || v === "blank";
}

export function presetLabel(id: string | null | undefined) {
  const match =
    LEAD_PRESET_OPTIONS.find((o) => o.id === id) ??
    EXTRA_LEAD_PRESET_OPTIONS.find((o) => o.id === id);
  return match?.label ?? (id && id !== "all" ? id : "");
}

/** Preset picker labels — SE sees personal wording instead of org handoff labels. */
export function leadPresetOptionsForRole(role: string | null | undefined) {
  const assigneeScoped = role === "SALES_EXECUTIVE";
  if (!assigneeScoped) return [...LEAD_PRESET_OPTIONS];
  return LEAD_PRESET_OPTIONS.map((option) =>
    option.id === "passed-se-tl"
      ? { ...option, label: "Assigned to me" }
      : option.id === "not-passed"
        ? { ...option, label: "Not with me yet" }
        : option,
  );
}

export function presetLabelForRole(
  id: string | null | undefined,
  role: string | null | undefined,
) {
  if (role === "SALES_EXECUTIVE") {
    if (id === "passed-se-tl" || id === "assigned") return "Assigned to me";
    if (id === "not-passed") return "Not with me yet";
  }
  return presetLabel(id);
}

export function statusLabel(value: string | null | undefined) {
  const match = QUALIFICATION_OPTIONS.find((o) => o.value === value);
  return match?.label ?? (value ? value.replace(/_/g, " ") : "");
}

export function stageLabel(value: string | null | undefined) {
  const match = LEAD_STAGE_OPTIONS.find((o) => o.value === value);
  return match?.label ?? (value ? value.replace(/_/g, " ") : "");
}

export function normalizeDateRange(from: string, to: string) {
  let addedFrom = from.trim();
  let addedTo = to.trim();
  if (addedFrom && addedTo && addedFrom > addedTo) {
    [addedFrom, addedTo] = [addedTo, addedFrom];
  }
  return { addedFrom, addedTo };
}

export function dashboardFiltersToDeepLink(
  filters: DashboardFilters,
): LeadsDeepLink {
  return {
    filter: filters.filterValue !== "all" ? filters.filterValue : undefined,
    country: filters.country || undefined,
    city: filters.city || undefined,
    source: filters.source || undefined,
    portal: filters.portal || undefined,
    teamId: filters.teamId || undefined,
    analystId: filters.analystId || undefined,
    salesExecId: filters.salesExecId || undefined,
    status: filters.status || undefined,
    stage: filters.stage || undefined,
    addedFrom: filters.addedFrom || undefined,
    addedTo: filters.addedTo || undefined,
  };
}

export function formatFacetChips(input: {
  filterValue?: string;
  facets?: Partial<LeadFacets> | DashboardFilters;
  names?: {
    teamName?: string;
    analystName?: string;
    salesExecName?: string;
  };
}): string[] {
  const chips: string[] = [];
  const f = input.facets ?? {};
  const names = input.names ?? {};
  const filterValue =
    "filterValue" in f && typeof f.filterValue === "string"
      ? f.filterValue
      : input.filterValue;

  if (filterValue && filterValue !== "all") {
    const label = presetLabel(filterValue);
    if (label) chips.push(label);
  }
  if (f.country) {
    chips.push(
      isBlankGeoValue(f.country) ? "Country: Blank" : `Country: ${f.country}`,
    );
  }
  if (f.city) {
    chips.push(isBlankGeoValue(f.city) ? "City: Blank" : `City: ${f.city}`);
  }
  if (f.status) chips.push(`Status: ${statusLabel(f.status)}`);
  if (f.stage) chips.push(`Stage: ${stageLabel(f.stage)}`);
  if ("reason" in f && f.reason) {
    chips.push(
      f.reason === "No reason recorded" || f.reason === "none"
        ? "Reason: None recorded"
        : `Reason: ${f.reason}`,
    );
  }
  if (f.source)
    chips.push(f.source === "none" ? "Source: Blank" : `Source: ${f.source}`);
  if (f.portal)
    chips.push(f.portal === "none" ? "Portal: Blank" : `Portal: ${f.portal}`);
  if ("metaProfile" in f && f.metaProfile)
    chips.push(
      f.metaProfile === "none" ? "Meta: Blank" : `Meta: ${f.metaProfile}`,
    );

  const teamName =
    names.teamName ||
    ("teamName" in f && typeof f.teamName === "string" ? f.teamName : "");
  const analystName =
    names.analystName ||
    ("analystName" in f && typeof f.analystName === "string"
      ? f.analystName
      : "");
  const salesExecName =
    names.salesExecName ||
    ("salesExecName" in f && typeof f.salesExecName === "string"
      ? f.salesExecName
      : "");

  if (f.teamId)
    chips.push(
      f.teamId === "none"
        ? "Team: Unassigned"
        : `Team: ${teamName || "Selected"}`,
    );
  if (f.analystId)
    chips.push(
      f.analystId === "none"
        ? "Analyst: Unassigned"
        : `Analyst: ${analystName || "Selected"}`,
    );
  if (f.salesExecId)
    chips.push(
      f.salesExecId === "none"
        ? "Sales exec: Unassigned"
        : `Sales exec: ${salesExecName || "Selected"}`,
    );
  if (f.addedFrom || f.addedTo) {
    if (f.addedFrom && f.addedFrom === f.addedTo) {
      chips.push(`Added: ${f.addedFrom}`);
    } else {
      chips.push(`Added: ${f.addedFrom || "…"} → ${f.addedTo || "…"}`);
    }
  }
  return chips;
}

/**
 * Merge store values into a draft while preserving keys the user has edited
 * since the last synced baseline.
 */
export function mergeExternalFilters<T extends Record<string, string>>(
  draft: T,
  baseline: T,
  next: T,
): T {
  const merged = { ...draft };
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (draft[key] === baseline[key]) {
      merged[key] = next[key];
    }
  }
  return merged;
}
