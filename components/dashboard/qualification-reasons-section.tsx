"use client";

import { useMemo } from "react";
import { useDashboardBucketScroll } from "@/hooks/use-dashboard-bucket-scroll";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import type { StatusReasonCount } from "@/lib/api";
import type { LeadsDeepLink } from "@/lib/leads-href";
import {
  toDashboardDeepLink,
  useDashboardFilterStore,
} from "@/store/dashboard-filter-store";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatPct(pct: number) {
  return pct < 1 ? pct.toFixed(2) : pct.toFixed(1);
}

function statusMeta(status: string) {
  if (status === "NOT_QUALIFIED") {
    return {
      label: "Not qualified",
      filter: "new" as const,
      className:
        "border-[rgba(232,104,18,0.28)] bg-[#fff7ef] text-[#9a3f00]",
    };
  }
  return {
    label: "Irrelevant",
    filter: "irrelevant" as const,
    className: "border-[rgba(33,37,41,0.12)] bg-[#f1f3f5] text-[#495057]",
  };
}

type Props = {
  irrelevantTotal?: number;
  notQualifiedTotal?: number;
};

export function QualificationReasonsSection({
  irrelevantTotal,
  notQualifiedTotal,
}: Props) {
  const navigateToLeads = useNavigateToLeads();
  const filters = useDashboardFilterStore((s) => s.filters);
  const country = filters.country;
  const city = filters.city;

  const page = useDashboardBucketScroll<StatusReasonCount>({
    dimension: "reasons",
    country,
    city,
  });

  const rows = useMemo(() => {
    const denom = page.leadTotal > 0 ? page.leadTotal : 1;
    return (page.items ?? [])
      .filter((item) => item.count > 0)
      .map((item) => ({
        ...item,
        pct: (item.count / denom) * 100,
      }));
  }, [page.items, page.leadTotal]);

  const open = (link: LeadsDeepLink) => {
    const base = toDashboardDeepLink(filters);
    const merged: LeadsDeepLink = { ...base, ...link };
    merged.status = undefined;
    merged.stage = undefined;
    merged.q = undefined;
    merged.field = undefined;
    if (link.filter) merged.filter = link.filter;
    navigateToLeads(merged);
  };

  const irrTotal = irrelevantTotal ?? 0;
  const nqTotal = notQualifiedTotal ?? 0;

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[rgba(33,37,41,0.05)] px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529]">
            Not Qualified / Irrelevant reasons
          </h2>
          <p className="mt-0.5 text-[12px] text-[#868e96]">
            Exact reasons from analyst notes
          </p>
        </div>

        {!page.loading ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => open({ filter: "irrelevant" })}
              className="lf-pressable inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-[#f8f9fa] px-2.5 py-1 text-[11px] tabular-nums text-[#212529] hover:bg-white"
            >
              <span className="text-[#868e96]">Irrelevant</span>
              <span className="font-medium">{formatCount(irrTotal)}</span>
            </button>
            <button
              type="button"
              onClick={() => open({ filter: "new" })}
              className="lf-pressable inline-flex items-center gap-1.5 rounded-lg border border-[rgba(233,136,18,0.28)] bg-[#fff7ef] px-2.5 py-1 text-[11px] tabular-nums text-[#9a3f00] hover:bg-[#fff4e6]"
            >
              <span className="opacity-80">Not qualified</span>
              <span className="font-medium">{formatCount(nqTotal)}</span>
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={page.scrollRootRef}
        className="lf-scroll min-h-0 flex-1 overflow-auto"
      >
        {page.loading && rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-[13px] text-[#868e96]">Loading reasons…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-[13px] text-[#868e96]">No reasons recorded.</p>
          </div>
        ) : (
          <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[140px]" />
              <col />
              <col className="w-[88px]" />
              <col className="w-[72px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-[rgba(33,37,41,0.06)] text-[11px] tracking-[0.08em] text-[#adb5bd] uppercase">
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 text-right font-medium">Count</th>
                <th className="px-4 py-2.5 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = statusMeta(row.status);
                return (
                  <tr
                    key={`${row.status}:${row.reason}`}
                    className="border-b border-[rgba(33,37,41,0.04)] hover:bg-[#fafbfc]"
                  >
                    <td className="px-4 py-2.5 align-middle">
                      <button
                        type="button"
                        onClick={() => open({ filter: meta.filter })}
                        className={[
                          "lf-pressable inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[11px] font-medium",
                          meta.className,
                        ].join(" ")}
                        title={`Open all ${meta.label} leads`}
                      >
                        {meta.label}
                      </button>
                    </td>
                    <td className="min-w-0 px-4 py-2.5 align-middle">
                      <button
                        type="button"
                        onClick={() =>
                          open({
                            filter: meta.filter,
                            reason: row.reason,
                          })
                        }
                        className="lf-pressable block w-full min-w-0 truncate text-left text-[13px] text-[#212529] hover:underline"
                        title={row.reason}
                      >
                        {row.reason}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right align-middle">
                      <button
                        type="button"
                        onClick={() =>
                          open({
                            filter: meta.filter,
                            reason: row.reason,
                          })
                        }
                        className="lf-pressable text-[13px] font-medium tabular-nums text-[#212529] hover:underline"
                      >
                        {formatCount(row.count)}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right align-middle text-[12px] tabular-nums text-[#868e96]">
                      {formatPct(row.pct)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {page.hasMore ? (
          <div
            ref={page.sentinelRef}
            className="flex items-center justify-center px-3 py-3"
          >
            <p className="text-[11px] text-[#adb5bd]">
              {page.loadingMore ? "Loading more…" : "Scroll for more"}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
