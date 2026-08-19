"use client";

import { showActionToast } from "@/store/action-toast-store";
import { Check, ExternalLink, LoaderCircle, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FilterPanelShell } from "@/components/dashboard/filter-panel-shell";
import {
  fetchAssignableUsers,
  fetchGeoOptions,
  fetchSummaryBuckets,
  type AssignableUser,
  type AnalystLeadStats,
  type NamedCount,
} from "@/lib/api";
import {
  LEAD_SOURCES,
  PORTAL_WEBSITES,
  QUALIFICATION_OPTIONS,
} from "@/lib/lead-form-options";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import {
  filterCityGeoOptions,
  LEAD_STAGE_OPTIONS,
  leadPresetOptionsForRole,
  mergeExternalFilters,
} from "@/lib/lead-filter-labels";
import {
  EMPTY_DASHBOARD_FILTERS,
  hasDashboardFilters,
  toDashboardDeepLink,
  useDashboardFilterStore,
  type DashboardFilters,
} from "@/store/dashboard-filter-store";
import { useUiStore } from "@/store/ui-store";
import { isAssigneeScoped, isCreatorScoped, isTeamScoped } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

const STAGE_OPTIONS = LEAD_STAGE_OPTIONS;

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-medium tracking-[0.1em] text-[#adb5bd] uppercase">
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] px-3 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow,background-color] hover:border-[rgba(33,37,41,0.14)] focus:border-[rgba(33,37,41,0.2)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(33,37,41,0.04)] disabled:opacity-50"
      >
        {children}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] px-3 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#adb5bd] hover:border-[rgba(33,37,41,0.14)] focus:border-[rgba(33,37,41,0.2)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(33,37,41,0.04)]"
      />
    </div>
  );
}

function uniqueTeams(users: AssignableUser[]) {
  const map = new Map<string, string>();
  for (const user of users) {
    const id = user.teamId?.trim();
    if (!id) continue;
    const name = user.teamName?.trim() || id;
    if (!map.has(id)) map.set(id, name);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function draftsEqual(a: DashboardFilters, b: DashboardFilters) {
  return (Object.keys(EMPTY_DASHBOARD_FILTERS) as (keyof DashboardFilters)[]).every(
    (key) => a[key] === b[key],
  );
}

function toDeepLink(filters: DashboardFilters) {
  return toDashboardDeepLink(filters);
}

export function DashboardFilterSidebar() {
  const open = useUiStore((s) => s.filterSidebarOpen);
  const closeFilterSidebar = useUiStore((s) => s.closeFilterSidebar);
  const filters = useDashboardFilterStore((s) => s.filters);
  const setFilters = useDashboardFilterStore((s) => s.setFilters);
  const clearFilters = useDashboardFilterStore((s) => s.clearFilters);
  const navigateToLeads = useNavigateToLeads();
  const role = useAuthStore((s) => s.user?.role);
  const creatorScoped = isCreatorScoped(role);
  const assigneeScoped = isAssigneeScoped(role);
  const teamScoped = isTeamScoped(role);
  const hideTeamFilter = teamScoped || assigneeScoped;
  const hideAnalystFilter = creatorScoped || teamScoped || assigneeScoped;
  const presetOptions = useMemo(() => leadPresetOptionsForRole(role), [role]);

  const [draft, setDraft] = useState<DashboardFilters>({ ...filters });
  const [appliedFlash, setAppliedFlash] = useState(false);
  const [countries, setCountries] = useState<NamedCount[]>([]);
  const [cities, setCities] = useState<NamedCount[]>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [analysts, setAnalysts] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [salesExecs, setSalesExecs] = useState<AssignableUser[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const openRef = useRef(false);
  const baselineRef = useRef<DashboardFilters>({ ...filters });

  const dirty = !draftsEqual(draft, filters);
  const hasActive = hasDashboardFilters(filters);

  useEffect(() => {
    if (!open) {
      openRef.current = false;
      return;
    }
    if (!openRef.current) {
      openRef.current = true;
      setDraft({ ...filters });
      baselineRef.current = { ...filters };
      setAppliedFlash(false);
      return;
    }
    setDraft((prev) => {
      const merged = mergeExternalFilters(prev, baselineRef.current, filters);
      baselineRef.current = { ...filters };
      return merged;
    });
  }, [open, filters]);

  useEffect(() => {
    if (!open || optionsLoaded) return;
    const controller = new AbortController();
    setOptionsLoading(true);

    const emptyUsers: AssignableUser[] = [];
    const emptyAnalysts = { items: [] as AnalystLeadStats[] };

    void Promise.all([
      fetchGeoOptions({ type: "countries", signal: controller.signal }),
      hideTeamFilter
        ? Promise.resolve(emptyUsers)
        : fetchAssignableUsers("team-leads", controller.signal),
      assigneeScoped
        ? Promise.resolve(emptyUsers)
        : fetchAssignableUsers("members", controller.signal),
      hideAnalystFilter
        ? Promise.resolve(emptyAnalysts)
        : fetchSummaryBuckets<AnalystLeadStats>({
            dimension: "analyst",
            limit: 200,
            signal: controller.signal,
          }),
    ])
      .then(([geo, teamLeads, members, analystsPage]) => {
        if (controller.signal.aborted) return;
        setOptionsLoaded(true);
        setCountries(geo.items ?? []);
        setTeams(uniqueTeams(teamLeads));
        setSalesExecs(
          [...members].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setAnalysts(
          (analystsPage.items ?? [])
            .filter((row) => row.id)
            .map((row) => ({
              id: row.id,
              name: row.name || row.email || row.id,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setOptionsLoading(false);
      });

    return () => controller.abort();
  }, [
    open,
    optionsLoaded,
    hideTeamFilter,
    assigneeScoped,
    hideAnalystFilter,
  ]);

  useEffect(() => {
    const country = draft.country.trim();
    if (!open || !country) {
      setCities([]);
      return;
    }

    const controller = new AbortController();
    setCitiesLoading(true);
    void fetchGeoOptions({
      type: "cities",
      country,
      signal: controller.signal,
    })
      .then((geo) => {
        if (controller.signal.aborted) return;
        if (geo.type !== "cities") return;
        setCities(
          filterCityGeoOptions(geo.items ?? [], countries, country),
        );
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setCities([]);
        console.error(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCitiesLoading(false);
      });

    return () => controller.abort();
  }, [open, draft.country, countries]);

  const patch = <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K],
  ) => {
    setAppliedFlash(false);
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "country") {
        next.city = "";
      }
      if (key === "filterValue" && value && value !== "all") {
        next.status = "";
      }
      if (key === "status" && value) {
        next.filterValue = "all";
      }
      if (key === "teamId") {
        if (!value) next.teamName = "";
        else if (value === "none") next.teamName = "Unassigned";
      }
      if (key === "analystId") {
        if (!value) next.analystName = "";
        else if (value === "none") next.analystName = "Unassigned";
      }
      if (key === "salesExecId") {
        if (!value) next.salesExecName = "";
        else if (value === "none") next.salesExecName = "Unassigned";
      }
      return next;
    });
  };

  const handleApply = () => {
    setFilters(draft);
    baselineRef.current = { ...draft };
    setAppliedFlash(true);
    showActionToast("Applied");
  };

  const handleReset = () => {
    setDraft({ ...EMPTY_DASHBOARD_FILTERS });
    baselineRef.current = { ...EMPTY_DASHBOARD_FILTERS };
    clearFilters();
    setAppliedFlash(false);
  };

  const handleViewLeads = () => {
    setFilters(draft);
    baselineRef.current = { ...draft };
    navigateToLeads(toDeepLink(draft));
  };

  const summaryBits = useMemo(() => {
    const parts: string[] = [];
    if (draft.country) parts.push(draft.country);
    if (draft.city) parts.push(draft.city);
    if (draft.filterValue !== "all") {
      parts.push(
        presetOptions.find((o) => o.id === draft.filterValue)?.label ??
          draft.filterValue,
      );
    }
    return parts;
  }, [draft, presetOptions]);

  return (
    <FilterPanelShell
      open={open}
      id="dashboard-filter-sidebar"
      label="Dashboard filters"
      onClose={closeFilterSidebar}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative shrink-0 overflow-hidden border-b border-[rgba(33,37,41,0.06)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,rgba(248,249,250,0.95)_0%,rgba(255,255,255,0.7)_45%,rgba(241,243,245,0.9)_100%)]"
          />
          <div className="relative flex items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.14em] text-[#495057] uppercase">
                <SlidersHorizontal size={11} strokeWidth={1.75} />
                Filters
              </p>
              <h2 className="mt-1 text-[16px] font-medium tracking-[-0.03em] text-[#212529]">
                Refine dashboard
              </h2>
              <p className="mt-0.5 text-[12px] text-[#868e96]">
                {summaryBits.length > 0
                  ? summaryBits.join(" · ")
                  : "Country & city update KPIs live"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeFilterSidebar}
              className="lf-pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(33,37,41,0.08)] bg-white/80 text-[#868e96] hover:bg-white hover:text-[#212529]"
              aria-label="Close filters"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="lf-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {optionsLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-[12px] text-[#adb5bd]">
              <LoaderCircle size={14} className="animate-spin" />
              Loading options…
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField
                  label="Country"
                  value={draft.country}
                  onChange={(value) => patch("country", value)}
                >
                  <option value="">Any</option>
                  {countries.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="City"
                  value={draft.city}
                  disabled={!draft.country}
                  onChange={(value) => patch("city", value)}
                >
                  <option value="">
                    {citiesLoading ? "Loading…" : "Any"}
                  </option>
                  {cities.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </SelectField>
              </div>

              <SelectField
                label="Preset"
                value={draft.filterValue}
                onChange={(value) => patch("filterValue", value)}
              >
                {presetOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectField>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField
                  label="Status"
                  value={draft.status}
                  onChange={(value) => patch("status", value)}
                >
                  <option value="">Any</option>
                  {QUALIFICATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Stage"
                  value={draft.stage}
                  onChange={(value) => patch("stage", value)}
                >
                  <option value="">Any</option>
                  {STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField
                  label="Source"
                  value={draft.source}
                  onChange={(value) => patch("source", value)}
                >
                  <option value="">Any</option>
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Portal"
                  value={draft.portal}
                  onChange={(value) => patch("portal", value)}
                >
                  <option value="">Any</option>
                  {PORTAL_WEBSITES.map((portal) => (
                    <option key={portal} value={portal}>
                      {portal}
                    </option>
                  ))}
                </SelectField>
              </div>

              {hideTeamFilter ? null : (
                <SelectField
                  label="Team"
                  value={draft.teamId}
                  onChange={(value) => {
                    const team = teams.find((row) => row.id === value);
                    setAppliedFlash(false);
                    setDraft((prev) => ({
                      ...prev,
                      teamId: value,
                      teamName:
                        value === "none"
                          ? "Unassigned"
                          : team?.name || "",
                    }));
                  }}
                >
                  <option value="">Any</option>
                  <option value="none">Unassigned</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </SelectField>
              )}

              {hideAnalystFilter ? null : (
                <SelectField
                  label="Analyst"
                  value={draft.analystId}
                  onChange={(value) => {
                    const row = analysts.find((item) => item.id === value);
                    setAppliedFlash(false);
                    setDraft((prev) => ({
                      ...prev,
                      analystId: value,
                      analystName:
                        value === "none"
                          ? "Unassigned"
                          : row?.name || "",
                    }));
                  }}
                >
                  <option value="">Any</option>
                  <option value="none">Unassigned</option>
                  {analysts.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </SelectField>
              )}

              {assigneeScoped ? null : (
                <SelectField
                  label="Sales executive"
                  value={draft.salesExecId}
                  onChange={(value) => {
                    const user = salesExecs.find((item) => item.id === value);
                    setAppliedFlash(false);
                    setDraft((prev) => ({
                      ...prev,
                      salesExecId: value,
                      salesExecName:
                        value === "none"
                          ? "Unassigned"
                          : user?.name || "",
                    }));
                  }}
                >
                  <option value="">Any</option>
                  <option value="none">Unassigned</option>
                  {salesExecs.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </SelectField>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Added from"
                  type="date"
                  value={draft.addedFrom}
                  onChange={(value) => patch("addedFrom", value)}
                />
                <TextField
                  label="Added to"
                  type="date"
                  value={draft.addedTo}
                  onChange={(value) => patch("addedTo", value)}
                />
              </div>

              <p className="rounded-xl border border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] px-3 py-2.5 text-[11px] leading-relaxed text-[#868e96]">
                Country and city refresh dashboard KPIs. Other fields apply when
                you open matching leads.
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-[rgba(33,37,41,0.06)] bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasActive && !dirty}
              className="lf-pressable inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[rgba(33,37,41,0.08)] bg-white text-[13px] font-medium text-[#495057] hover:bg-[#f8f9fa] disabled:pointer-events-none disabled:opacity-40"
            >
              <RotateCcw size={13} strokeWidth={1.75} />
              Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!dirty}
              className={[
                "lf-pressable inline-flex h-10 flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-[#212529] text-[13px] font-medium text-white hover:opacity-90 disabled:pointer-events-none",
                appliedFlash && !dirty
                  ? "disabled:opacity-100"
                  : "disabled:opacity-40",
              ].join(" ")}
            >
              {appliedFlash && !dirty ? (
                <>
                  <Check size={14} strokeWidth={2} />
                  Applied
                </>
              ) : (
                "Apply filters"
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={handleViewLeads}
            className="lf-pressable inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[rgba(33,37,41,0.08)] bg-white text-[13px] font-medium text-[#212529] hover:bg-[#f8f9fa]"
          >
            <ExternalLink size={13} strokeWidth={1.75} />
            View matching leads
          </button>
        </div>
      </div>
    </FilterPanelShell>
  );
}
