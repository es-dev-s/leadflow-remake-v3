"use client";

import { useMemo } from "react";
import {
  dashboardCardListClass,
  ViewMoreFooter,
} from "@/components/dashboard/view-more-footer";
import { useDashboardBucketScroll } from "@/hooks/use-dashboard-bucket-scroll";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import type { AttributionStats, SummaryBucketDimension } from "@/lib/api";
import type { LeadsDeepLink } from "@/lib/leads-href";
import { useDashboardFilterStore } from "@/store/dashboard-filter-store";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatConv(pct: number) {
  if (pct <= 0) return "0%";
  if (pct < 0.1) return `${pct.toFixed(2)}%`;
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(1)}%`;
}

function barWidth(pct: number) {
  return Math.min(100, Math.max(pct, pct > 0 ? 2.5 : 0));
}

function isUnassigned(name: string) {
  return name.trim().toLowerCase() === "unassigned";
}

function convTone(pct: number): string {
  if (pct <= 0) return "#adb5bd";
  if (pct < 0.1) return "#868e96";
  if (pct < 0.5) return "#e86812";
  if (pct < 1) return "#2f9e44";
  return "#2b8a3e";
}

type Props = {
  title: string;
  nameHeader: string;
  facet: "portal" | "metaProfile" | "source";
};

export function AttributionPerformanceSection({
  title,
  nameHeader,
  facet,
}: Props) {
  const navigateToLeads = useNavigateToLeads();
  const country = useDashboardFilterStore((s) => s.filters.country);
  const city = useDashboardFilterStore((s) => s.filters.city);

  const dimension: SummaryBucketDimension =
    facet === "portal"
      ? "portal"
      : facet === "metaProfile"
        ? "metaProfile"
        : "source";

  const page = useDashboardBucketScroll<AttributionStats>({
    dimension,
    country,
    city,
  });

  const list = page.previewItems;

  const openRow = (name: string) => {
    const value = name.trim();
    const link: LeadsDeepLink = {};
    const key = !value || isUnassigned(value) ? "none" : value;
    if (facet === "portal") link.portal = key;
    else if (facet === "metaProfile") link.metaProfile = key;
    else link.source = key;
    navigateToLeads(link);
  };

  const unassigned = useMemo(
    () =>
      list
        .filter((row) => isUnassigned(row.name))
        .reduce((acc, row) => acc + row.total, 0),
    [list],
  );

  const overallConv =
    page.leadTotal > 0 ? ((page.wonTotal || 0) * 100) / page.leadTotal : 0;

  const maxTotal = useMemo(
    () => list.reduce((max, row) => Math.max(max, row.total), 0) || 1,
    [list],
  );

  return (
    <section className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[rgba(33,37,41,0.05)] px-3.5 py-3 @[40rem]:px-5">
        <div className="flex flex-col gap-3 @[48rem]:flex-row @[48rem]:items-end @[48rem]:justify-between">
          <div className="min-w-0">
            <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529] @[28rem]:text-[17px]">
              {title}
            </h2>
          </div>

          {!page.loading ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-[#f8f9fa] px-2.5 py-1 text-[11px] tabular-nums text-[#212529] @[28rem]:text-[12px]">
                <span className="text-[#868e96]">Leads</span>
                <span className="font-medium">
                  {formatCount(page.leadTotal)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(47,158,68,0.22)] bg-[#ebfbee] px-2.5 py-1 text-[11px] tabular-nums text-[#2b8a3e] @[28rem]:text-[12px]">
                <span className="opacity-80">Won</span>
                <span className="font-medium">
                  {formatCount(page.wonTotal || 0)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(233,136,18,0.28)] bg-[#fff7ef] px-2.5 py-1 text-[11px] tabular-nums text-[#9a3f00] @[28rem]:text-[12px]">
                <span className="opacity-80">Conv.</span>
                <span className="font-medium">{formatConv(overallConv)}</span>
              </span>
              {unassigned > 0 ? (
                <span className="text-[11px] tabular-nums text-[#9a3f00] @[28rem]:text-[12px]">
                  {formatCount(unassigned)} unassigned
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 text-center">
          <p className="text-[13px] text-[#6c757d]">
            {page.loading ? "Loading…" : "No data yet."}
          </p>
        </div>
      ) : (
        <div className={dashboardCardListClass(page.expanded)}>
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#f8f9fa]">
              <tr className="border-b border-[rgba(33,37,41,0.05)] text-[10px] font-medium tracking-[0.06em] text-[#adb5bd] uppercase">
                <th className="w-10 px-3.5 py-2 font-medium @[28rem]:px-5">
                  #
                </th>
                <th className="px-2 py-2 font-medium">{nameHeader}</th>
                <th className="hidden min-w-[140px] px-2 py-2 font-medium @[48rem]:table-cell">
                  Volume
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  Total leads
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  Total won
                </th>
                <th className="px-3.5 py-2 text-right font-medium @[28rem]:px-5">
                  Total Conv.
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, index) => {
                const blank = isUnassigned(row.name);
                const share = (row.total / maxTotal) * 100;
                const tone = convTone(row.conversion);
                return (
                  <tr
                    key={`${nameHeader}:${row.name}`}
                    className={`border-b border-[rgba(33,37,41,0.04)] last:border-b-0 ${
                      blank
                        ? "bg-[#fff7ef] hover:bg-[#fff1e4]"
                        : "bg-white hover:bg-[#fafbfc]"
                    }`}
                  >
                    <td className="px-3.5 py-2 text-[11px] tabular-nums text-[#adb5bd] @[28rem]:px-5">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => openRow(row.name)}
                        className="lf-pressable flex min-w-0 items-center gap-2 text-left"
                        title={`Open leads for ${row.name || nameHeader}`}
                      >
                        <p
                          className={`truncate text-[13px] font-medium hover:underline ${
                            blank ? "text-[#9a3f00]" : "text-[#212529]"
                          }`}
                        >
                          {row.name || "Unnamed"}
                        </p>
                        {blank ? (
                          <span className="shrink-0 rounded-md border border-[rgba(233,136,18,0.28)] bg-white px-1.5 py-0.5 text-[10px] font-medium tracking-[0.04em] text-[#9a3f00] uppercase">
                            Blank
                          </span>
                        ) : null}
                      </button>
                    </td>
                    <td className="hidden px-2 py-2 @[48rem]:table-cell">
                      <span className="block h-1 w-full overflow-hidden rounded-full bg-[rgba(33,37,41,0.06)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${barWidth(share)}%`,
                            backgroundColor: blank ? "#e86812" : "#495057",
                          }}
                        />
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openRow(row.name)}
                        className={`lf-pressable text-[13px] font-medium tabular-nums hover:underline ${
                          blank ? "text-[#9a3f00]" : "text-[#212529]"
                        }`}
                      >
                        {formatCount(row.total)}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right text-[13px] font-medium tabular-nums text-[#2f9e44]">
                      {formatCount(row.won)}
                    </td>
                    <td className="px-3.5 py-2 text-right @[28rem]:px-5">
                      <span
                        className="inline-flex min-w-[3.25rem] justify-end rounded-md px-1.5 py-0.5 text-[12px] font-medium tabular-nums"
                        style={{
                          color: tone,
                          backgroundColor:
                            row.conversion > 0
                              ? "rgba(47,158,68,0.08)"
                              : "rgba(33,37,41,0.04)",
                        }}
                      >
                        {formatConv(row.conversion)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ViewMoreFooter
        total={page.bucketCount || page.items.length}
        expanded={page.expanded}
        onExpand={() => {
          void page.revealAll();
        }}
        onCollapse={page.collapse}
        loading={page.loadingMore}
        noun="rows"
      />
    </section>
  );
}
