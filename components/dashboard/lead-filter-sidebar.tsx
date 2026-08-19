"use client";

import { showActionToast } from "@/store/action-toast-store";
import { Check, LoaderCircle, RotateCcw, SlidersHorizontal, X } from "lucide-react";
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
import {
  BLANK_GEO,
  filterCityGeoOptions,
  LEAD_STAGE_OPTIONS,
  leadPresetOptionsForRole,
  mergeExternalFilters,
  normalizeDateRange,
} from "@/lib/lead-filter-labels";
import {
  type LeadFacets,
  useLeadsStore,
} from "@/store/leads-store";
import { useUiStore } from "@/store/ui-store";
import { isAssigneeScoped, isCreatorScoped, isTeamScoped } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

const STAGE_OPTIONS = LEAD_STAGE_OPTIONS;

const EMPTY_DRAFT_FACETS: LeadFacets = {
  country: "",
  city: "",
  teamId: "",
  analystId: "",
  salesExecId: "",
  source: "",
  portal: "",
  metaProfile: "",
  status: "",
  stage: "",
  serviceLine: "",
  reason: "",
  addedFrom: "",
  addedTo: "",
};

type Draft = {
  filterValue: string;
  facets: LeadFacets;
};

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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] px-3 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[#adb5bd] hover:border-[rgba(33,37,41,0.14)] focus:border-[rgba(33,37,41,0.2)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(33,37,41,0.04)]"
      />
    </div>
  );
}

function draftFromStore(filterValue: string, facets: LeadFacets): Draft {
  return {
    filterValue: filterValue || "all",
    facets: { ...EMPTY_DRAFT_FACETS, ...facets },
  };
}

function draftsEqual(a: Draft, b: Draft) {
  if (a.filterValue !== b.filterValue) return false;
  return (Object.keys(EMPTY_DRAFT_FACETS) as (keyof LeadFacets)[]).every(
    (key) => a.facets[key] === b.facets[key],
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

export function LeadFilterSidebar() {
  const open = useUiStore((s) => s.filterSidebarOpen);
  const closeFilterSidebar = useUiStore((s) => s.closeFilterSidebar);
  const filterValue = useLeadsStore((s) => s.filterValue);
  const facets = useLeadsStore((s) => s.facets);
  const applyFilters = useLeadsStore((s) => s.applyFilters);
  const clearFacets = useLeadsStore((s) => s.clearFacets);
  const role = useAuthStore((s) => s.user?.role);
  const creatorScoped = isCreatorScoped(role);
  const assigneeScoped = isAssigneeScoped(role);
  const teamScoped = isTeamScoped(role);
  const hideTeamFilter = teamScoped || assigneeScoped;
  const hideAnalystFilter = creatorScoped || teamScoped || assigneeScoped;
  const presetOptions = useMemo(() => leadPresetOptionsForRole(role), [role]);

  const [draft, setDraft] = useState<Draft>(() =>
    draftFromStore(filterValue, facets),
  );
  const [appliedFlash, setAppliedFlash] = useState(false);
  const [countries, setCountries] = useState<NamedCount[]>([]);
  const [cities, setCities] = useState<NamedCount[]>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [analysts, setAnalysts] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [salesExecs, setSalesExecs] = useState<AssignableUser[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const openRef = useRef(false);
  const baselineRef = useRef<Draft>(draftFromStore(filterValue, facets));

  const applied = useMemo(
    () => draftFromStore(filterValue, facets),
    [filterValue, facets],
  );
  const dirty = !draftsEqual(draft, applied);
  const hasActive =
    applied.filterValue !== "all" ||
    Object.values(applied.facets).some(Boolean);

  useEffect(() => {
    if (!open) {
      openRef.current = false;
      return;
    }
    const next = draftFromStore(filterValue, facets);
    if (!openRef.current) {
      openRef.current = true;
      setDraft(next);
      baselineRef.current = next;
      setAppliedFlash(false);
      return;
    }
    setDraft((prev) => {
      const merged: Draft = {
        filterValue:
          prev.filterValue === baselineRef.current.filterValue
            ? next.filterValue
            : prev.filterValue,
        facets: mergeExternalFilters(
          prev.facets,
          baselineRef.current.facets,
          next.facets,
        ),
      };
      baselineRef.current = next;
      return merged;
    });
  }, [open, filterValue, facets]);

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
    const country = draft.facets.country.trim();
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
  }, [open, draft.facets.country, countries]);

  const patchFacet = <K extends keyof LeadFacets>(
    key: K,
    value: LeadFacets[K],
  ) => {
    setAppliedFlash(false);
    setDraft((prev) => {
      const nextFacets = { ...prev.facets, [key]: value };
      if (key === "country") nextFacets.city = "";
      if (key === "addedFrom" || key === "addedTo") {
        const range = normalizeDateRange(
          key === "addedFrom" ? value : nextFacets.addedFrom,
          key === "addedTo" ? value : nextFacets.addedTo,
        );
        nextFacets.addedFrom = range.addedFrom;
        nextFacets.addedTo = range.addedTo;
      }
      const nextFilter =
        key === "status" && value ? "all" : prev.filterValue;
      return { filterValue: nextFilter, facets: nextFacets };
    });
  };

  const handleApply = () => {
    const range = normalizeDateRange(
      draft.facets.addedFrom,
      draft.facets.addedTo,
    );
    const next = {
      filterValue: draft.facets.status ? "all" : draft.filterValue,
      facets: { ...draft.facets, ...range },
    };
    applyFilters(next);
    baselineRef.current = next;
    setDraft(next);
    setAppliedFlash(true);
    showActionToast("Applied");
  };

  const handleReset = () => {
    const empty = { filterValue: "all", facets: { ...EMPTY_DRAFT_FACETS } };
    setDraft(empty);
    baselineRef.current = empty;
    clearFacets();
    setAppliedFlash(false);
  };

  return (
    <FilterPanelShell
      open={open}
      id="lead-filter-sidebar"
      label="Lead filters"
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
                Refine leads
              </h2>
              <p className="mt-0.5 text-[12px] text-[#868e96]">
                {hasActive
                  ? "Active filters applied to this list"
                  : "Set criteria, then apply"}
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
              <SelectField
                label="Preset"
                value={draft.filterValue}
                onChange={(value) => {
                  setAppliedFlash(false);
                  setDraft((prev) => ({
                    ...prev,
                    filterValue: value,
                    facets: {
                      ...prev.facets,
                      status: value !== "all" ? "" : prev.facets.status,
                    },
                  }));
                }}
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
                  value={draft.facets.status}
                  onChange={(value) => patchFacet("status", value)}
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
                  value={draft.facets.stage}
                  onChange={(value) => patchFacet("stage", value)}
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
                  label="Country"
                  value={draft.facets.country}
                  onChange={(value) => patchFacet("country", value)}
                >
                  <option value="">Any</option>
                  <option value={BLANK_GEO}>Blank</option>
                  {countries.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="City"
                  value={draft.facets.city}
                  disabled={!draft.facets.country}
                  onChange={(value) => patchFacet("city", value)}
                >
                  <option value="">
                    {citiesLoading ? "Loading…" : "Any"}
                  </option>
                  <option value={BLANK_GEO}>Blank</option>
                  {cities.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField
                  label="Source"
                  value={draft.facets.source}
                  onChange={(value) => patchFacet("source", value)}
                >
                  <option value="">Any</option>
                  <option value="none">Blank</option>
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Portal"
                  value={draft.facets.portal}
                  onChange={(value) => patchFacet("portal", value)}
                >
                  <option value="">Any</option>
                  <option value="none">Blank</option>
                  {PORTAL_WEBSITES.map((portal) => (
                    <option key={portal} value={portal}>
                      {portal}
                    </option>
                  ))}
                </SelectField>
              </div>

              <TextField
                label="Meta profile"
                value={draft.facets.metaProfile}
                placeholder="Exact profile name"
                onChange={(value) => patchFacet("metaProfile", value)}
              />

              {hideTeamFilter ? null : (
                <SelectField
                  label="Team"
                  value={draft.facets.teamId}
                  onChange={(value) => patchFacet("teamId", value)}
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
                  value={draft.facets.analystId}
                  onChange={(value) => patchFacet("analystId", value)}
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
                  value={draft.facets.salesExecId}
                  onChange={(value) => patchFacet("salesExecId", value)}
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
                  value={draft.facets.addedFrom}
                  onChange={(value) => patchFacet("addedFrom", value)}
                />
                <TextField
                  label="Added to"
                  type="date"
                  value={draft.facets.addedTo}
                  onChange={(value) => patchFacet("addedTo", value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[rgba(33,37,41,0.06)] bg-white px-5 py-3">
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
        </div>
      </div>
    </FilterPanelShell>
  );
}
