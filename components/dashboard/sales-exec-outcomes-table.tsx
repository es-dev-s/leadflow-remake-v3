"use client";

import { useMemo } from "react";
import {
  dashboardCardListClass,
  ViewMoreFooter,
} from "@/components/dashboard/view-more-footer";
import { useDashboardBucketScroll } from "@/hooks/use-dashboard-bucket-scroll";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import type { SalesExecOutcome } from "@/lib/api";
import { useDashboardFilterStore } from "@/store/dashboard-filter-store";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function barWidth(pct: number) {
  return Math.min(100, Math.max(pct, pct > 0 ? 2.5 : 0));
}

function n(value: number | undefined) {
  return Number.isFinite(value) ? value ?? 0 : 0;
}

export function SalesExecOutcomesTable() {
  const navigateToLeads = useNavigateToLeads();
  const country = useDashboardFilterStore((s) => s.filters.country);
  const city = useDashboardFilterStore((s) => s.filters.city);

  const page = useDashboardBucketScroll<SalesExecOutcome>({
    dimension: "salesExec",
    country,
    city,
  });
  const list = page.previewItems;

  const openExec = (
    row: SalesExecOutcome,
    extra?: { filter?: string; stage?: string },
  ) => {
    const salesExecId = row.id?.trim();
    if (!salesExecId) return;
    navigateToLeads({
      salesExecId,
      ...extra,
    });
  };

  const totals = useMemo(() => {
    return list.reduce(
      (acc, row) => {
        acc.assigned += n(row.assigned);
        acc.withRep += n(row.withRep);
        acc.inProgress += n(row.inProgress);
        acc.won += n(row.won);
        acc.lost += n(row.lost);
        acc.other += n(row.other);
        return acc;
      },
      {
        assigned: 0,
        withRep: 0,
        inProgress: 0,
        won: 0,
        lost: 0,
        other: 0,
      },
    );
  }, [list]);

  const maxAssigned = useMemo(
    () => list.reduce((max, row) => Math.max(max, n(row.assigned)), 0) || 1,
    [list],
  );

  return (
    <section className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[rgba(33,37,41,0.05)] px-3.5 py-3 @[40rem]:px-5">
        <div className="flex flex-col gap-3 @[48rem]:flex-row @[48rem]:items-end @[48rem]:justify-between">
          <div className="min-w-0">
            <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529] @[28rem]:text-[17px]">
              Leads by Sales Executive
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-[#868e96] @[28rem]:text-[12px]">
              Assigned leads only. Leads = Active leads + In progress + Won +
              Lost + Other
            </p>
          </div>

          {!page.loading ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-[#f8f9fa] px-2.5 py-1 text-[11px] tabular-nums text-[#212529] @[28rem]:text-[12px]">
                <span className="text-[#868e96]">Assigned</span>
                <span className="font-medium">
                  {formatCount(page.leadTotal)}
                </span>
              </span>
            </div>
          ) : null}
        </div>

        {!page.loading ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums text-[#868e96] @[28rem]:text-[12px]">
            <span>{formatCount(page.bucketCount)} executives</span>
            <span>{formatCount(totals.withRep)} active leads</span>
            <span>{formatCount(totals.inProgress)} in progress</span>
            <span className="text-[#2f9e44]">{formatCount(totals.won)} won</span>
            <span>{formatCount(totals.lost)} lost</span>
            {totals.other > 0 ? (
              <span>{formatCount(totals.other)} other</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {list.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 text-center">
          <p className="text-[13px] text-[#6c757d]">
            {page.loading
              ? "Loading sales executive coverage…"
              : "No sales executive coverage data yet."}
          </p>
        </div>
      ) : (
        <div className={dashboardCardListClass(page.expanded)}>
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#f8f9fa]">
              <tr className="border-b border-[rgba(33,37,41,0.05)] text-[10px] font-medium tracking-[0.06em] text-[#adb5bd] uppercase">
                <th className="w-10 px-3.5 py-2 font-medium @[28rem]:px-5">
                  #
                </th>
                <th className="px-2 py-2 font-medium">Sales executive</th>
                <th className="hidden min-w-[120px] px-2 py-2 font-medium @[48rem]:table-cell">
                  Share
                </th>
                <th className="px-2 py-2 text-right font-medium">Leads</th>
                <th
                  className="px-2 py-2 text-right font-medium"
                  title="Sales stage: With executive"
                >
                  Active leads
                </th>
                <th
                  className="px-2 py-2 text-right font-medium"
                  title="Not connected, in negotiation, or no response"
                >
                  In progress
                </th>
                <th className="px-2 py-2 text-right font-medium">Won</th>
                <th className="px-2 py-2 text-right font-medium">Lost</th>
                <th
                  className="px-3.5 py-2 text-right font-medium @[28rem]:px-5"
                  title="Pre-sales and any stage outside the other columns"
                >
                  Other
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, index) => {
                const share = (n(row.assigned) / maxAssigned) * 100;
                return (
                  <tr
                    key={row.id || row.name}
                    className="border-b border-[rgba(33,37,41,0.04)] bg-white last:border-b-0 hover:bg-[#fafbfc]"
                  >
                    <td className="px-3.5 py-2 text-[11px] tabular-nums text-[#adb5bd] @[28rem]:px-5">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => openExec(row)}
                        className="lf-pressable flex min-w-0 items-center gap-2 text-left"
                        title={`Open leads for ${row.name || "executive"}`}
                      >
                        <p className="truncate text-[13px] font-medium text-[#212529] hover:underline">
                          {row.name || "Unnamed"}
                        </p>
                      </button>
                    </td>
                    <td className="hidden px-2 py-2 @[48rem]:table-cell">
                      <button
                        type="button"
                        onClick={() => openExec(row)}
                        className="lf-pressable block w-full"
                      >
                        <span className="block h-1 w-full overflow-hidden rounded-full bg-[rgba(33,37,41,0.06)]">
                          <span
                            className="block h-full rounded-full bg-[#495057]"
                            style={{ width: `${barWidth(share)}%` }}
                          />
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openExec(row)}
                        className="lf-pressable text-[13px] font-medium tabular-nums text-[#212529] hover:underline"
                      >
                        {formatCount(n(row.assigned))}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          openExec(row, { stage: "WITH_EXECUTIVE" })
                        }
                        className="lf-pressable text-[13px] tabular-nums text-[#495057] hover:underline"
                      >
                        {formatCount(n(row.withRep))}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          openExec(row, { filter: "in-progress" })
                        }
                        className="lf-pressable text-[13px] tabular-nums text-[#495057] hover:underline"
                      >
                        {formatCount(n(row.inProgress))}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openExec(row, { filter: "converted" })}
                        className="lf-pressable text-[13px] font-medium tabular-nums text-[#2f9e44] hover:underline"
                      >
                        {formatCount(n(row.won))}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openExec(row, { filter: "lost" })}
                        className="lf-pressable text-[13px] tabular-nums text-[#868e96] hover:underline"
                      >
                        {formatCount(n(row.lost))}
                      </button>
                    </td>
                    <td className="px-3.5 py-2 text-right @[28rem]:px-5">
                      <button
                        type="button"
                        onClick={() =>
                          openExec(row, { filter: "not-passed" })
                        }
                        className="lf-pressable text-[13px] tabular-nums text-[#868e96] hover:underline"
                      >
                        {formatCount(n(row.other))}
                      </button>
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
        noun="executives"
      />
    </section>
  );
}
