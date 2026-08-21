"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnalystQualificationTable } from "@/components/dashboard/analyst-qualification-table";
import { AttributionPerformanceSection } from "@/components/dashboard/attribution-performance-section";
import { GeographyMixSection } from "@/components/dashboard/geography-mix-section";
import { LeadsAddedChart } from "@/components/dashboard/leads-added-chart";
import { QualificationMixChart } from "@/components/dashboard/qualification-mix-chart";
import { QualificationReasonsSection } from "@/components/dashboard/qualification-reasons-section";
import { RoutedTeamsMixChart } from "@/components/dashboard/routed-teams-mix-chart";
import { SalesExecOutcomesTable } from "@/components/dashboard/sales-exec-outcomes-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { TeamMixChart } from "@/components/dashboard/team-mix-chart";
import {
  OVERVIEW_SCROLL_ATTR,
  useNavigateToLeads,
} from "@/hooks/use-navigate-to-leads";
import { usePersistedOverviewScroll } from "@/hooks/use-persisted-overview-scroll";
import { fetchLeadsSummary, type LeadSummary } from "@/lib/api";
import { formatFacetChips } from "@/lib/lead-filter-labels";
import { isAbortError } from "@/lib/reset-client-state";
import type { LeadsDeepLink } from "@/lib/leads-href";
import {
  canViewLeadData,
  canViewUsers,
  isAnalyticsScoped,
  isAssigneeScoped,
  isSuperadmin,
  isTeamScoped,
} from "@/lib/roles";
import {
  toDashboardDeepLink,
  useDashboardFilterStore,
} from "@/store/dashboard-filter-store";
import { useAuthStore } from "@/store/auth-store";
import { countOnline, usePresenceStore } from "@/store/presence-store";

function formatCount(value: number | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

function formatRevenue(value: number | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

export function OverviewContent() {
  const router = useRouter();
  const navigateToLeads = useNavigateToLeads();
  const scrollRef = usePersistedOverviewScroll();
  const role = useAuthStore((s) => s.user?.role);
  const userTeamId = useAuthStore((s) => s.user?.teamId);
  const analyticsScoped = isAnalyticsScoped(role);
  const assigneeScoped = isAssigneeScoped(role);
  const teamScoped = isTeamScoped(role);
  const superadmin = isSuperadmin(role);
  const hideCrossTeam = analyticsScoped || teamScoped;
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filters = useDashboardFilterStore((s) => s.filters);
  const clearFilters = useDashboardFilterStore((s) => s.clearFilters);
  const filterKey = [
    filters.country,
    filters.city,
    filters.filterValue,
    filters.teamId,
    filters.analystId,
    filters.salesExecId,
    filters.source,
    filters.portal,
    filters.status,
    filters.stage,
    filters.addedFrom,
    filters.addedTo,
  ].join("\0");

  useEffect(() => {
    if (!canViewLeadData(role)) {
      setLoading(false);
      setSummary(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    void fetchLeadsSummary({
      country: filters.country || undefined,
      city: filters.city || undefined,
      filter:
        filters.filterValue && filters.filterValue !== "all"
          ? filters.filterValue
          : undefined,
      teamId: filters.teamId || undefined,
      analystId: filters.analystId || undefined,
      salesExecId: filters.salesExecId || undefined,
      source: filters.source || undefined,
      portal: filters.portal || undefined,
      status: filters.status || undefined,
      stage: filters.stage || undefined,
      addedFrom: filters.addedFrom || undefined,
      addedTo: filters.addedTo || undefined,
      signal: controller.signal,
    })
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled || isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load summary");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filterKey, role, filters.country, filters.city, filters.filterValue, filters.teamId, filters.analystId, filters.salesExecId, filters.source, filters.portal, filters.status, filters.stage, filters.addedFrom, filters.addedTo]);

  const activeChips = useMemo(
    () => formatFacetChips({ facets: filters }),
    [filters],
  );

  const presenceTeamId =
    filters.teamId || (teamScoped ? userTeamId : "") || undefined;
  const liveActiveUsers = usePresenceStore((s) =>
    s.hydrated ? countOnline(s.byId, presenceTeamId) : null,
  );

  if (!canViewLeadData(role)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm text-[#6c757d]">
          This account does not have access to CRM data.
        </p>
      </div>
    );
  }

  const open = (link: LeadsDeepLink) => {
    // KPIs now use the same facet scope as the leads list.
    const base = toDashboardDeepLink(filters);
    const merged: LeadsDeepLink = { ...base, ...link };
    // Card facet must not fight leftover status/stage/preset from the dashboard.
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
    navigateToLeads(merged);
  };

  const withTeamLeads = summary?.withTeamLeads ?? 0;
  const withSalesExecs = summary?.withSalesExecs ?? 0;
  const passedSeTlTotal = withTeamLeads + withSalesExecs;
  const passedLabel = assigneeScoped
    ? "Assigned to me"
    : teamScoped
      ? "Passed to SEs"
      : "Passed to SE/TLs";
  const passedDetail = assigneeScoped
    ? "Currently with you"
    : summary
      ? `With team lead ${formatCount(withTeamLeads)} · With executive ${formatCount(withSalesExecs)}`
      : undefined;

  const primary: Array<{
    label: string;
    value: string;
    detail?: string;
    link?: LeadsDeepLink;
    href?: string;
  }> = [
    ...(analyticsScoped
      ? []
      : [
          {
            label: "Active users",
            value: formatCount(liveActiveUsers ?? summary?.activeUsers),
            href: canViewUsers(role) ? "/users?online=1" : undefined,
          },
        ]),
    {
      label: "Total leads",
      value: formatCount(summary?.leadsTotal),
      link: { filter: "all" },
    },
    {
      label: "Irrelevant",
      value: formatCount(summary?.irrelevantLeads),
      link: { filter: "irrelevant" },
    },
    {
      label: "Qualified",
      value: formatCount(summary?.qualifiedLeads),
      link: { filter: "qualified" },
    },
    {
      label: "Not qualified",
      value: formatCount(summary?.notQualifiedLeads),
      link: { filter: "new" },
    },
    {
      label: passedLabel,
      value: formatCount(summary ? passedSeTlTotal : undefined),
      detail: passedDetail,
      link: { filter: "passed-se-tl" },
    },
    {
      label: "Total lost",
      value: formatCount(summary?.totalLost),
      link: { filter: "lost" },
    },
  ];

  const secondary: Array<{
    label: string;
    value: string;
    detail?: string;
    link: LeadsDeepLink;
  }> = [
    ...(superadmin
      ? [
          {
            label: "Total revenue",
            value: formatRevenue(summary?.closedRevenue),
            detail: "Closed-won deal value (AUD)",
            link: { filter: "converted" as const },
          },
        ]
      : []),
    {
      label: "Total won",
      value: formatCount(summary?.totalWon),
      link: { filter: "converted" },
    },
    {
      label: "No response from client",
      value: formatCount(summary?.noResponse),
      link: { stage: "NO_RESPONSE_FROM_CLIENT" },
    },
  ];

  return (
    <div
      ref={scrollRef}
      {...{ [OVERVIEW_SCROLL_ATTR]: "" }}
      className="lf-scroll h-full min-h-0 overflow-y-auto overscroll-contain outline-none focus:outline-none -mx-3 -my-3 px-3 py-3 sm:-mx-4 sm:-my-3.5 sm:px-4 sm:py-3.5 lg:-mx-6 lg:-my-4 lg:px-6 lg:py-4 2xl:-mx-8 2xl:px-8"
    >
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 pb-8 2xl:gap-5">
        {activeChips.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-lg border border-[rgba(33,37,41,0.08)] bg-white px-2.5 py-1 text-[11px] text-[#495057]"
                >
                  {chip}
                </span>
              ))}
              <button
                type="button"
                onClick={() => clearFilters()}
                className="lf-pressable inline-flex items-center gap-1 rounded-lg border border-[rgba(33,37,41,0.08)] bg-white px-2.5 py-1 text-[11px] font-medium text-[#868e96] hover:text-[#212529]"
              >
                <X size={11} strokeWidth={1.75} />
                Clear
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={`grid w-full auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-3 lg:grid-cols-4 ${
            analyticsScoped ? "xl:grid-cols-6" : "xl:grid-cols-7"
          }`}
        >
          {primary.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              detail={card.detail}
              compact
              onClick={
                card.link
                  ? () => open(card.link!)
                  : card.href
                    ? () => router.push(card.href!)
                    : undefined
              }
            />
          ))}
        </div>

        <div
          className={`grid w-full auto-rows-fr grid-cols-1 items-stretch gap-3 ${
            secondary.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
          }`}
        >
          {secondary.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              detail={card.detail}
              onClick={() => open(card.link)}
            />
          ))}
        </div>

        <div className="w-full">
          <LeadsAddedChart />
        </div>

        <div className="h-[560px] min-h-0 w-full">
          <GeographyMixSection
            country={filters.country}
            city={filters.city}
          />
        </div>

        <div className="w-full">
          <QualificationMixChart
            mix={summary?.qualificationMix ?? []}
            total={summary?.leadsTotal ?? 0}
            loading={loading}
          />
        </div>

        {hideCrossTeam ? null : (
          <div className="grid w-full grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
            <div className="h-[560px] min-h-0">
              <TeamMixChart
                mix={Array.isArray(summary?.teamMix) ? summary.teamMix : []}
                total={summary?.leadsTotal ?? 0}
                loading={loading}
              />
            </div>
            <div className="h-[360px] min-h-0 xl:h-[560px]">
              <RoutedTeamsMixChart
                mix={Array.isArray(summary?.teamMix) ? summary.teamMix : []}
                total={summary?.leadsTotal ?? 0}
                loading={loading}
              />
            </div>
          </div>
        )}

        {analyticsScoped ? null : (
          <div
            className={`grid w-full grid-cols-1 items-stretch gap-4 ${
              teamScoped ? "" : "xl:grid-cols-2"
            }`}
          >
            {teamScoped ? null : (
              <div className="h-[520px] min-h-0">
                <AnalystQualificationTable />
              </div>
            )}
            <div className="h-[520px] min-h-0">
              <SalesExecOutcomesTable />
            </div>
          </div>
        )}

        <div className="h-[520px] min-h-0 w-full">
          <QualificationReasonsSection
            irrelevantTotal={summary?.irrelevantLeads}
            notQualifiedTotal={summary?.notQualifiedLeads}
          />
        </div>

        {analyticsScoped ? null : (
          <>
            <div className="grid w-full grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
              <div className="h-[520px] min-h-0">
                <AttributionPerformanceSection
                  title="Website / Brand"
                  nameHeader="Website"
                  facet="portal"
                />
              </div>
              <div className="h-[520px] min-h-0">
                <AttributionPerformanceSection
                  title="Meta profiles"
                  nameHeader="Meta profile"
                  facet="metaProfile"
                />
              </div>
            </div>

            <div className="h-[520px] min-h-0 w-full">
              <AttributionPerformanceSection
                title="By source"
                nameHeader="Source"
                facet="source"
              />
            </div>
          </>
        )}

        {error ? (
          <p className="text-[12px] text-[#868e96]">
            Couldn’t refresh KPIs: {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
