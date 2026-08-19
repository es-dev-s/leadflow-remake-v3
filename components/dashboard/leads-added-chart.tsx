"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import {
  fetchLeadsAddedSeries,
  type AddedSeriesResponse,
  type TimeBucketCount,
} from "@/lib/api";
import { addedBucketDeepLink } from "@/lib/leads-href";
import {
  dashboardFiltersToScope,
  useDashboardFilterStore,
} from "@/store/dashboard-filter-store";

type Granularity = "day" | "month";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatAvg(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function buildPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${p.x} ${p.y}`;
  }
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const cx = (prev.x + curr.x) / 2;
    d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function ChartCanvas({
  items,
  activeKey,
  onActive,
  onOpen,
}: {
  items: TimeBucketCount[];
  activeKey: string | null;
  onActive: (key: string | null) => void;
  onOpen: (key: string) => void;
}) {
  const gradId = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const height = 248;
  // Tight side insets so the plot uses nearly the full section width.
  const pad = { top: 20, right: 8, bottom: 34, left: 36 };
  const plotW = Math.max(width - pad.left - pad.right, 1);
  const plotH = height - pad.top - pad.bottom;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(1, ...items.map((item) => item.count));
  const points = items.map((item, index) => {
    const x =
      items.length <= 1
        ? pad.left + plotW / 2
        : pad.left + (index / (items.length - 1)) * plotW;
    const y = pad.top + plotH - (item.count / max) * plotH;
    return { ...item, x, y };
  });

  const linePath = buildPath(points);
  const areaPath =
    points.length === 0
      ? ""
      : `${linePath} L ${points[points.length - 1]!.x} ${pad.top + plotH} L ${points[0]!.x} ${pad.top + plotH} Z`;

  const yTicks = Array.from(
    new Set([0, 0.5, 1].map((t) => Math.round(max * t))),
  );
  const labelEvery = items.length > 24 ? 6 : items.length > 14 ? 3 : 2;
  const slot = plotW / Math.max(items.length, 1);

  return (
    <div ref={wrapRef} className="w-full min-w-0">
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="block h-[248px] w-full"
          role="img"
          aria-label="Leads added over time"
        >
          <defs>
            <linearGradient id={`fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.28" />
              <stop offset="55%" stopColor="#e86812" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`stroke-${gradId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="55%" stopColor="#e86812" />
              <stop offset="100%" stopColor="#ff7a1a" />
            </linearGradient>
          </defs>

          {yTicks.map((tick, index) => {
            const y = pad.top + plotH - (tick / max) * plotH;
            return (
              <g key={`y-${index}-${tick}`}>
                <line
                  x1={pad.left}
                  x2={pad.left + plotW}
                  y1={y}
                  y2={y}
                  stroke="rgba(33,37,41,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#adb5bd]"
                  style={{ fontSize: 10, fontWeight: 500 }}
                >
                  {formatCount(tick)}
                </text>
              </g>
            );
          })}

          {areaPath ? (
            <path d={areaPath} fill={`url(#fill-${gradId})`} />
          ) : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke={`url(#stroke-${gradId})`}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {points.map((point, index) => {
            const active = activeKey === point.key;
            const showLabel =
              index % labelEvery === 0 || index === points.length - 1;
            return (
              <g key={point.key}>
                <rect
                  x={point.x - Math.max(slot / 2, 6)}
                  y={pad.top}
                  width={Math.max(slot, 12)}
                  height={plotH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => onActive(point.key)}
                  onMouseLeave={() => onActive(null)}
                  onFocus={() => onActive(point.key)}
                  onBlur={() => onActive(null)}
                  onClick={() => onOpen(point.key)}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 4.5 : point.count > 0 ? 2.75 : 0}
                  fill={active ? "#e86812" : "#ffffff"}
                  stroke="#e86812"
                  strokeWidth={active ? 2 : 1.5}
                  className="pointer-events-none"
                  vectorEffect="non-scaling-stroke"
                />
                {showLabel ? (
                  <text
                    x={point.x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-[#adb5bd]"
                    style={{ fontSize: 10, fontWeight: 500 }}
                  >
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="h-[248px] w-full" />
      )}
    </div>
  );
}

export function LeadsAddedChart() {
  const navigateToLeads = useNavigateToLeads();
  const filters = useDashboardFilterStore((s) => s.filters);
  const scope = dashboardFiltersToScope(filters);
  const scopeKey = JSON.stringify(scope);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [data, setData] = useState<AddedSeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const openBucket = (key: string) => {
    const link = addedBucketDeepLink(key);
    if (link) navigateToLeads(link);
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchLeadsAddedSeries({
      granularity,
      ...scope,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load chart");
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [granularity, scopeKey]);

  const items = useMemo(
    () => (Array.isArray(data?.items) ? data.items : []),
    [data],
  );
  const active = useMemo(
    () => items.find((item) => item.key === activeKey) ?? null,
    [items, activeKey],
  );

  const rangeLabel = granularity === "day" ? "Last 30 days" : "Last 12 months";
  const avgLabel = granularity === "day" ? "Avg / day" : "Avg / month";

  return (
    <section className="@container w-full overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex flex-col gap-4 border-b border-[rgba(33,37,41,0.05)] px-3.5 py-3.5 @[40rem]:flex-row @[40rem]:items-end @[40rem]:justify-between @[40rem]:px-5">
        <div className="min-w-0">
          <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529] @[28rem]:text-[17px]">
            Leads added
          </h2>
          <p className="mt-0.5 text-[12px] text-[#868e96]">
            {rangeLabel} · click a point to open those leads
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 @[32rem]:w-auto @[32rem]:flex-row @[32rem]:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-[#f8f9fa] px-2.5 py-1 text-[11px] tabular-nums text-[#212529]">
              <span className="text-[#868e96]">Total</span>
              <span className="font-medium">
                {loading ? "—" : formatCount(data?.total ?? 0)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(233,136,18,0.28)] bg-[#fff7ef] px-2.5 py-1 text-[11px] tabular-nums text-[#9a3f00]">
              <span className="opacity-80">Peak</span>
              <span className="font-medium">
                {loading ? "—" : formatCount(data?.peak ?? 0)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-white px-2.5 py-1 text-[11px] tabular-nums text-[#212529]">
              <span className="text-[#868e96]">{avgLabel}</span>
              <span className="font-medium">
                {loading ? "—" : formatAvg(data?.average ?? 0)}
              </span>
            </span>
          </div>

          <div
            className="inline-flex rounded-xl border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] p-1"
            role="tablist"
            aria-label="Leads added granularity"
          >
            {(
              [
                { id: "day", label: "Day" },
                { id: "month", label: "Month" },
              ] as const
            ).map((option) => {
              const activeTab = granularity === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab}
                  onClick={() => setGranularity(option.id)}
                  className={`lf-pressable inline-flex h-8 items-center rounded-lg px-3 text-[12px] font-medium transition-colors ${
                    activeTab
                      ? "bg-[#212529] text-white"
                      : "text-[#6c757d] hover:text-[#212529]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative w-full min-w-0 px-3 pb-3 pt-1 @[40rem]:px-5">
        {active ? (
          <div className="pointer-events-none absolute top-3 right-5 z-10 rounded-lg border border-[rgba(233,136,18,0.28)] bg-[#fff7ef] px-2.5 py-1.5 text-[11px] tabular-nums text-[#9a3f00] shadow-sm">
            <span className="opacity-80">{active.label}</span>
            <span className="ml-2 font-medium">
              {formatCount(active.count)} leads
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="flex h-[248px] items-center justify-center px-4 text-center">
            <p className="text-[13px] text-[#868e96]">{error}</p>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="flex h-[248px] items-center justify-center">
            <div className="h-full w-full animate-pulse rounded-xl bg-[linear-gradient(180deg,#fff7ef_0%,#ffffff_70%)]" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-[248px] items-center justify-center px-4 text-center">
            <p className="text-[13px] text-[#6c757d]">No leads added in this range.</p>
          </div>
        ) : (
          <div
            className={`w-full min-w-0 transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}
          >
            <ChartCanvas
              items={items}
              activeKey={activeKey}
              onActive={setActiveKey}
              onOpen={openBucket}
            />
          </div>
        )}
      </div>
    </section>
  );
}
