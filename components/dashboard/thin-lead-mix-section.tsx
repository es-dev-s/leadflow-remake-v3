"use client";

import { useMemo, useState } from "react";
import {
  dashboardCardListClass,
  ViewMoreFooter,
} from "@/components/dashboard/view-more-footer";
import { useViewMore } from "@/hooks/use-view-more";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import type { TeamLeadCount } from "@/lib/api";

type Slice = {
  key: string;
  id: string;
  label: string;
  count: number;
  pct: number;
};

function buildSlices(
  mix: TeamLeadCount[] | null | undefined,
  total: number,
  keyPrefix: string,
): Slice[] {
  const rows = Array.isArray(mix) ? mix.filter((item) => item && item.count > 0) : [];
  const sum = rows.reduce((acc, item) => acc + item.count, 0) || Math.max(total, 1);

  return rows.map((item, index) => {
    const label = (item.name ?? "").trim() || "Unassigned";
    const id = (item.id ?? "").trim() || "none";
    const key = item.id
      ? `${keyPrefix}:${item.id}`
      : `${keyPrefix}:unassigned:${label}:${index}`;
    return {
      key,
      id,
      label,
      count: item.count,
      pct: (item.count / sum) * 100,
    };
  });
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatPct(pct: number) {
  return pct < 1 ? pct.toFixed(2) : pct.toFixed(1);
}

function barWidth(pct: number) {
  return Math.min(100, Math.max(pct, pct > 0 ? 2.5 : 0));
}

export type ThinLeadMixProps = {
  title: string;
  entityLabel: string;
  emptyLabel: string;
  keyPrefix: string;
  barTone?: string;
  mix: TeamLeadCount[];
  total: number;
  loading?: boolean;
};

export function ThinLeadMixSection({
  title,
  entityLabel,
  emptyLabel,
  keyPrefix,
  barTone = "#495057",
  mix,
  total,
  loading = false,
}: ThinLeadMixProps) {
  const navigateToLeads = useNavigateToLeads();
  const slices = useMemo(
    () => buildSlices(mix, total, keyPrefix),
    [mix, total, keyPrefix],
  );
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const more = useViewMore(slices);

  const sum = useMemo(
    () => slices.reduce((acc, slice) => acc + slice.count, 0) || total,
    [slices, total],
  );

  const openSlice = (slice: Slice) => {
    navigateToLeads({ teamId: slice.id || "none" });
  };

  return (
    <section className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-[rgba(33,37,41,0.05)] px-3.5 py-3 @[28rem]:px-5">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-medium tracking-[-0.03em] text-[#212529] @[28rem]:text-[17px]">
            {title}
          </h2>
        </div>
        <p className="shrink-0 text-[11px] tabular-nums text-[#868e96] @[28rem]:text-[12px]">
          {loading ? "" : `${slices.length} · ${formatCount(sum)}`}
        </p>
      </div>

      {slices.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 text-center">
          <p className="text-[13px] text-[#6c757d]">
            {loading ? `Loading ${emptyLabel}…` : `No ${emptyLabel} yet.`}
          </p>
        </div>
      ) : (
        <div className={dashboardCardListClass(more.expanded)}>
          <div
            className="sticky top-0 z-10 hidden grid-cols-[36px_minmax(100px,1.2fr)_minmax(80px,1.4fr)_72px_48px] gap-2 border-b border-[rgba(33,37,41,0.05)] bg-[#f8f9fa] px-3.5 py-2 text-[10px] font-medium tracking-[0.06em] text-[#adb5bd] uppercase @[30rem]:grid @[30rem]:px-5 @[36rem]:grid-cols-[40px_minmax(120px,1.2fr)_minmax(100px,1.6fr)_80px_52px] @[36rem]:gap-3"
            aria-hidden
          >
            <span>#</span>
            <span>{entityLabel}</span>
            <span>Share</span>
            <span className="text-right">Leads</span>
            <span className="text-right">%</span>
          </div>

          <ul className="divide-y divide-[rgba(33,37,41,0.04)]" role="list">
            {more.visible.map((slice, index) => {
              const active = activeKey === slice.key;
              return (
                <li key={slice.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveKey(slice.key)}
                    onMouseLeave={() => setActiveKey(null)}
                    onFocus={() => setActiveKey(slice.key)}
                    onBlur={() => setActiveKey(null)}
                    onClick={() => openSlice(slice)}
                    title={`Open leads for ${slice.label}`}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2.5 gap-y-1.5 px-3.5 py-2 text-left transition-colors duration-100 @[30rem]:grid-cols-[36px_minmax(100px,1.2fr)_minmax(80px,1.4fr)_72px_48px] @[30rem]:gap-2 @[30rem]:px-5 @[36rem]:grid-cols-[40px_minmax(120px,1.2fr)_minmax(100px,1.6fr)_80px_52px] @[36rem]:gap-3 ${
                      active ? "bg-[#f8f9fa]" : "bg-white hover:bg-[#fafbfc]"
                    }`}
                  >
                    <span className="hidden text-[11px] tabular-nums text-[#adb5bd] @[30rem]:block">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="col-span-3 min-w-0 truncate text-[13px] font-medium text-[#212529] @[30rem]:col-span-1">
                      <span className="mr-2 text-[11px] tabular-nums text-[#adb5bd] @[30rem]:hidden">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {slice.label}
                    </span>

                    <span className="col-span-3 block min-w-0 @[30rem]:col-span-1">
                      <span className="block h-1 w-full overflow-hidden rounded-full bg-[rgba(33,37,41,0.06)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${barWidth(slice.pct)}%`,
                            backgroundColor: barTone,
                          }}
                        />
                      </span>
                    </span>

                    <span className="text-right text-[12px] font-medium tabular-nums text-[#212529]">
                      {formatCount(slice.count)}
                    </span>
                    <span className="text-right text-[11px] tabular-nums text-[#868e96]">
                      {formatPct(slice.pct)}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <ViewMoreFooter
        total={more.total}
        expanded={more.expanded}
        onExpand={more.expand}
        onCollapse={more.collapse}
        noun="teams"
      />
    </section>
  );
}
