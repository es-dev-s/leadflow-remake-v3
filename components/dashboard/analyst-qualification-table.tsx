"use client";

import {
  dashboardCardListClass,
  ViewMoreFooter,
} from "@/components/dashboard/view-more-footer";
import { useDashboardBucketScroll } from "@/hooks/use-dashboard-bucket-scroll";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import type { AnalystLeadStats } from "@/lib/api";
import { useDashboardFilterStore } from "@/store/dashboard-filter-store";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

export function AnalystQualificationTable() {
  const navigateToLeads = useNavigateToLeads();
  const country = useDashboardFilterStore((s) => s.filters.country);
  const city = useDashboardFilterStore((s) => s.filters.city);

  const page = useDashboardBucketScroll<AnalystLeadStats>({
    dimension: "analyst",
    country,
    city,
  });
  const list = page.previewItems;

  const openAnalyst = (row: AnalystLeadStats, filter?: string) => {
    const analystId = row.id?.trim() || "none";
    navigateToLeads({
      analystId,
      ...(filter ? { filter } : {}),
    });
  };

  return (
    <section className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-[rgba(33,37,41,0.05)] px-3.5 py-3 @[28rem]:px-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium tracking-[-0.03em] text-[#212529] @[28rem]:text-[17px]">
            Analyst qualification
          </h2>
        </div>
        <p className="shrink-0 text-[11px] tabular-nums text-[#868e96] @[28rem]:text-[12px]">
          {page.loading ? "" : `${formatCount(page.bucketCount)} analysts`}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 text-center">
          <p className="text-[13px] text-[#6c757d]">
            {page.loading
              ? "Loading analyst qualifications…"
              : "No analyst data yet."}
          </p>
        </div>
      ) : (
        <div className={dashboardCardListClass(page.expanded)}>
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#f8f9fa]">
              <tr className="border-b border-[rgba(33,37,41,0.05)] text-[10px] font-medium tracking-[0.06em] text-[#adb5bd] uppercase">
                <th className="px-3.5 py-2 font-medium @[28rem]:px-5">
                  Lead analyst
                </th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
                <th className="px-2 py-2 text-right font-medium">Qualified</th>
                <th className="px-2 py-2 text-right font-medium">
                  Not qual.
                </th>
                <th className="px-3.5 py-2 text-right font-medium @[28rem]:px-5">
                  Irrelevant
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr
                  key={row.id || `${row.name}:${row.email}`}
                  className="border-b border-[rgba(33,37,41,0.04)] last:border-b-0 hover:bg-[#fafbfc]"
                >
                  <td className="px-3.5 py-2 @[28rem]:px-5">
                    <button
                      type="button"
                      onClick={() => openAnalyst(row)}
                      className="lf-pressable min-w-0 text-left"
                      title={`Open leads for ${row.name || "analyst"}`}
                    >
                      <p className="truncate text-[13px] font-medium text-[#212529] hover:underline">
                        {row.name || "Unassigned"}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#868e96]">
                        {row.email || "—"}
                      </p>
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openAnalyst(row)}
                      className="lf-pressable text-[13px] font-medium tabular-nums text-[#212529] hover:underline"
                    >
                      {formatCount(row.total)}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openAnalyst(row, "qualified")}
                      className="lf-pressable text-[13px] font-medium tabular-nums text-[#e86812] hover:underline"
                    >
                      {formatCount(row.qualified)}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openAnalyst(row, "new")}
                      className="lf-pressable text-[13px] tabular-nums text-[#495057] hover:underline"
                    >
                      {formatCount(row.notQualified)}
                    </button>
                  </td>
                  <td className="px-3.5 py-2 text-right @[28rem]:px-5">
                    <button
                      type="button"
                      onClick={() => openAnalyst(row, "irrelevant")}
                      className="lf-pressable text-[13px] tabular-nums text-[#868e96] hover:underline"
                    >
                      {formatCount(row.irrelevant)}
                    </button>
                  </td>
                </tr>
              ))}
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
        noun="analysts"
      />
    </section>
  );
}
