"use client";

import { LayoutGrid, List } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  dashboardCardListClass,
  ViewMoreFooter,
} from "@/components/dashboard/view-more-footer";
import { useCountTween } from "@/hooks/use-count-tween";
import { useViewMore } from "@/hooks/use-view-more";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import type { TeamLeadCount } from "@/lib/api";

type Slice = {
  key: string;
  id: string;
  label: string;
  count: number;
  tone: string;
  pct: number;
};

type ViewMode = "grid" | "list";

/** Subtle orange blend: larger teams read slightly darker, all stay in-brand. */
const ORANGE_SHADE_LIGHT = { r: 255, g: 205, b: 160 }; // #ffcda0
const ORANGE_SHADE_DARK = { r: 232, g: 104, b: 18 }; // #e86812

/** When one team dominates, cap its bar width so tail teams stay hoverable. */
const DOMINANT_BAR_CAP_PCT = 28;
const TAIL_SEGMENT_MIN_PX = 12;

function sizeBasedOrangeShade(
  pct: number,
  minPct: number,
  maxPct: number,
): string {
  const minV = Math.sqrt(Math.max(minPct, 0.001));
  const maxV = Math.sqrt(Math.max(maxPct, 0.001));
  const span = maxV - minV;
  const t = span <= 0 ? 1 : (Math.sqrt(Math.max(pct, 0.001)) - minV) / span;
  const r = Math.round(
    ORANGE_SHADE_LIGHT.r + (ORANGE_SHADE_DARK.r - ORANGE_SHADE_LIGHT.r) * t,
  );
  const g = Math.round(
    ORANGE_SHADE_LIGHT.g + (ORANGE_SHADE_DARK.g - ORANGE_SHADE_LIGHT.g) * t,
  );
  const b = Math.round(
    ORANGE_SHADE_LIGHT.b + (ORANGE_SHADE_DARK.b - ORANGE_SHADE_LIGHT.b) * t,
  );
  return `rgb(${r}, ${g}, ${b})`;
}

function buildSlices(mix: TeamLeadCount[] | null | undefined, total: number): Slice[] {
  const rows = Array.isArray(mix) ? mix.filter((item) => item && item.count > 0) : [];
  const sum = rows.reduce((acc, item) => acc + item.count, 0) || Math.max(total, 1);

  const slices = rows.map((item, index) => {
    const label = (item.name ?? "").trim() || "Unassigned";
    const id = (item.id ?? "").trim() || "none";
    const key = item.id ? `team:${item.id}` : `team:unassigned:${label}:${index}`;
    return {
      key,
      id,
      label,
      count: item.count,
      tone: "",
      pct: (item.count / sum) * 100,
    };
  });

  if (slices.length === 0) return slices;

  const pcts = slices.map((slice) => slice.pct);
  const minPct = Math.min(...pcts);
  const maxPct = Math.max(...pcts);

  return slices.map((slice) => ({
    ...slice,
    tone: sizeBasedOrangeShade(slice.pct, minPct, maxPct),
  }));
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatPct(pct: number) {
  return pct < 1 ? pct.toFixed(2) : pct.toFixed(1);
}

type BarSegment = {
  slice: Slice;
  displayPct: number;
  isTail: boolean;
};

function buildBarSegments(slices: Slice[]): BarSegment[] {
  if (slices.length === 0) return [];
  if (slices.length === 1) {
    return [{ slice: slices[0]!, displayPct: 100, isTail: false }];
  }

  const maxPct = Math.max(...slices.map((slice) => slice.pct));
  const dominantIdx = slices.findIndex((slice) => slice.pct === maxPct);
  const skewed = maxPct >= 35 && slices.length > 2;

  if (!skewed) {
    const weights = slices.map((slice) => Math.max(slice.pct, 4));
    const total = weights.reduce((acc, weight) => acc + weight, 0) || 1;
    return slices.map((slice, index) => ({
      slice,
      displayPct: (weights[index]! / total) * 100,
      isTail: false,
    }));
  }

  const tailCount = slices.length - 1;
  const tailShare = (100 - DOMINANT_BAR_CAP_PCT) / tailCount;

  return slices.map((slice, index) => ({
    slice,
    displayPct: index === dominantIdx ? DOMINANT_BAR_CAP_PCT : tailShare,
    isTail: index !== dominantIdx,
  }));
}

function resolveSliceAtPosition(
  segments: BarSegment[],
  offsetX: number,
  barWidth: number,
): Slice | null {
  if (barWidth <= 0 || segments.length === 0) return null;

  const zones = segments.map((segment, index) => {
    const sliceWidth = (segment.displayPct / 100) * barWidth;
    const start = segments
      .slice(0, index)
      .reduce((acc, item) => acc + (item.displayPct / 100) * barWidth, 0);

    return {
      slice: segment.slice,
      center: start + sliceWidth / 2,
      hitWidth: Math.max(
        sliceWidth,
        segment.isTail ? TAIL_SEGMENT_MIN_PX : 8,
      ),
    };
  });

  const matches = zones.filter(
    ({ center, hitWidth }) =>
      offsetX >= center - hitWidth / 2 && offsetX <= center + hitWidth / 2,
  );

  if (matches.length === 1) return matches[0]!.slice;
  if (matches.length > 1) {
    return matches.reduce((best, row) =>
      Math.abs(offsetX - row.center) < Math.abs(offsetX - best.center)
        ? row
        : best,
    ).slice;
  }

  return zones.reduce((best, row) =>
    Math.abs(offsetX - row.center) < Math.abs(offsetX - best.center) ? row : best,
  ).slice;
}

function barWidth(pct: number) {
  return Math.min(100, Math.max(pct, pct > 0 ? 3 : 0));
}

type Props = {
  mix: TeamLeadCount[];
  total: number;
  loading?: boolean;
};

function ShareBar({
  pct,
  tone,
  tall = false,
}: {
  pct: number;
  tone: string;
  tall?: boolean;
}) {
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-[rgba(33,37,41,0.06)] ${
        tall ? "h-2.5" : "h-1.5"
      }`}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${barWidth(pct)}%`,
          backgroundColor: tone,
        }}
      />
    </div>
  );
}

function TeamCard({
  slice,
  active,
  onActivate,
  onClear,
  onOpen,
}: {
  slice: Slice;
  active: boolean;
  onActivate: () => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onMouseLeave={onClear}
      onFocus={onActivate}
      onBlur={onClear}
      onClick={onOpen}
      title={`Open leads for ${slice.label}`}
      className={`flex h-full min-h-0 w-full flex-col justify-between rounded-2xl border bg-white p-3 text-left transition-[border-color] duration-150 ${
        active
          ? "border-[rgba(255,122,26,0.4)]"
          : "border-[rgba(33,37,41,0.08)] hover:border-[rgba(33,37,41,0.14)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: slice.tone }}
            />
            <p className="truncate text-[13px] font-medium text-[#495057]">
              {slice.label}
            </p>
          </div>
          <p className="mt-2 text-[22px] leading-none font-medium tracking-[-0.05em] tabular-nums text-[#212529]">
            {formatCount(slice.count)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#fff4eb] px-2 py-0.5 text-[12px] font-medium tabular-nums text-[#9a3f00]">
          {formatPct(slice.pct)}%
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <ShareBar pct={slice.pct} tone={slice.tone} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[#868e96]">Team share</span>
          <span className="text-[11px] font-medium tabular-nums text-[#495057]">
            {slice.pct.toFixed(2)}%
          </span>
        </div>
      </div>
    </button>
  );
}

function TeamListRow({
  slice,
  rank,
  active,
  onActivate,
  onClear,
  onOpen,
}: {
  slice: Slice;
  rank: number;
  active: boolean;
  onActivate: () => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onMouseLeave={onClear}
      onFocus={onActivate}
      onBlur={onClear}
      onClick={onOpen}
      title={`Open leads for ${slice.label}`}
      className={`flex w-full flex-col gap-2 border-b border-[rgba(33,37,41,0.06)] px-4 py-2 text-left transition-colors duration-150 last:border-b-0 sm:grid sm:grid-cols-[44px_minmax(140px,1.1fr)_minmax(160px,1.6fr)_100px_72px] sm:items-center sm:gap-4 ${
        active ? "bg-[#fff7f0]" : "bg-white hover:bg-[#f8f9fa]"
      }`}
    >
      <div className="flex items-center justify-between gap-3 sm:contents">
        <span className="text-[12px] font-medium tabular-nums text-[#adb5bd]">
          {String(rank).padStart(2, "0")}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: slice.tone }}
          />
          <span className="truncate text-[13px] font-medium text-[#212529]">
            {slice.label}
          </span>
        </span>
        <div className="flex items-center gap-3 sm:hidden">
          <span className="text-[13px] font-medium tabular-nums text-[#212529]">
            {formatCount(slice.count)}
          </span>
          <span className="text-[12px] font-medium tabular-nums text-[#9a3f00]">
            {formatPct(slice.pct)}%
          </span>
        </div>
      </div>

      <div className="min-w-0 sm:px-1">
        <ShareBar pct={slice.pct} tone={slice.tone} tall />
      </div>

      <span className="hidden text-right text-[13px] font-medium tabular-nums text-[#212529] sm:block">
        {formatCount(slice.count)}
      </span>
      <span className="hidden text-right text-[12px] font-medium tabular-nums text-[#6c757d] sm:block">
        {formatPct(slice.pct)}%
      </span>
    </button>
  );
}

function PortfolioMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  const shown = useCountTween(value, { steps: 10 });

  return (
    <div className="w-full rounded-2xl border border-[rgba(33,37,41,0.08)] bg-white px-4 py-3 sm:w-[210px] sm:shrink-0">
      <p className="truncate text-[11px] font-medium tracking-[0.06em] text-[#868e96] uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-[28px] leading-none font-medium tracking-[-0.05em] tabular-nums text-[#212529]">
        {formatCount(shown)}
      </p>
      <p className="mt-1.5 truncate text-[12px] text-[#6c757d]">{detail}</p>
    </div>
  );
}

export function TeamMixChart({ mix, total, loading = false }: Props) {
  const navigateToLeads = useNavigateToLeads();
  const barRef = useRef<HTMLDivElement>(null);
  const slices = useMemo(() => buildSlices(mix, total), [mix, total]);
  const barSegments = useMemo(() => buildBarSegments(slices), [slices]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("grid");
  const previewLimit = view === "grid" ? 4 : 10;
  const more = useViewMore(slices, previewLimit);

  const openTeam = useCallback(
    (slice: Slice) => {
      navigateToLeads({ teamId: slice.id || "none" });
    },
    [navigateToLeads],
  );

  const pickSliceFromBarPointer = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return resolveSliceAtPosition(barSegments, clientX - rect.left, rect.width);
    },
    [barSegments],
  );

  const onBarPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slice = pickSliceFromBarPointer(event.clientX);
      setActiveKey(slice?.key ?? null);
    },
    [pickSliceFromBarPointer],
  );

  const onBarPointerLeave = useCallback(() => {
    setActiveKey(null);
  }, []);

  const onBarClick = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const slice = pickSliceFromBarPointer(event.clientX);
      if (slice) openTeam(slice);
    },
    [pickSliceFromBarPointer, openTeam],
  );

  const sum = useMemo(
    () => slices.reduce((acc, slice) => acc + slice.count, 0) || total,
    [slices, total],
  );

  const active = useMemo(
    () => slices.find((slice) => slice.key === activeKey) ?? null,
    [slices, activeKey],
  );

  const portfolioValue = active?.count ?? (total || sum);
  const portfolioLabel = active?.label ?? "All teams";
  const portfolioDetail = loading
    ? "Loading…"
    : active
      ? `${((active.count / Math.max(sum, 1)) * 100).toFixed(2)}% share`
      : `${slices.length} teams`;

  return (
    <section className="@container relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[rgba(255,122,26,0.18)] bg-[#fffaf6]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-[rgba(255,122,26,0.08)] blur-3xl"
      />

      <div className="relative flex h-full min-h-0 flex-col gap-3 p-4 sm:p-5">
        <div className="flex w-full shrink-0 flex-col gap-3 @[36rem]:flex-row @[36rem]:items-end @[36rem]:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] leading-tight font-medium tracking-[-0.035em] text-[#212529] sm:text-[20px]">
              Leads by teams
            </h2>
          </div>

          <div className="flex w-full flex-col gap-3 @[28rem]:w-auto @[28rem]:flex-row @[28rem]:items-end">
            <div
              className="inline-flex rounded-xl border border-[rgba(33,37,41,0.08)] bg-white p-1"
              role="tablist"
              aria-label="Team view mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "grid"}
                onClick={() => setView("grid")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-colors ${
                  view === "grid"
                    ? "bg-[#212529] text-white"
                    : "text-[#6c757d] hover:text-[#212529]"
                }`}
              >
                <LayoutGrid size={14} strokeWidth={1.75} />
                Grid
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "list"}
                onClick={() => setView("list")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-colors ${
                  view === "list"
                    ? "bg-[#212529] text-white"
                    : "text-[#6c757d] hover:text-[#212529]"
                }`}
              >
                <List size={14} strokeWidth={1.75} />
                List
              </button>
            </div>

            <PortfolioMetric
              label={portfolioLabel}
              value={portfolioValue}
              detail={portfolioDetail}
            />
          </div>
        </div>

        {/* Spectrum track — dominant team capped; tail teams get equal thick segments */}
        <div className="shrink-0 rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white p-3">
          <div
            ref={barRef}
            className="relative h-3.5 w-full cursor-pointer overflow-hidden rounded-full bg-[rgba(33,37,41,0.05)]"
            role="img"
            aria-label="Team lead share bar"
            onPointerMove={onBarPointerMove}
            onPointerLeave={onBarPointerLeave}
            onClick={onBarClick}
          >
            <div className="pointer-events-none flex h-full w-full gap-px">
              {barSegments.map(({ slice, displayPct }) => {
                const focused = !activeKey || activeKey === slice.key;
                return (
                  <div
                    key={`bar-${slice.key}`}
                    title={`${slice.label}: ${formatCount(slice.count)} (${formatPct(slice.pct)}%)`}
                    className="h-full shrink-0 transition-opacity duration-150 first:rounded-l-full last:rounded-r-full"
                    style={{
                      flex: `${displayPct} 0 0`,
                      backgroundColor: slice.tone,
                      opacity: focused ? 1 : 0.35,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {slices.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-[rgba(33,37,41,0.12)] bg-white px-4 py-8 text-center">
            <div>
              <p className="text-[14px] font-medium text-[#212529]">
                {loading ? "Loading…" : "No team data yet"}
              </p>
            </div>
          </div>
        ) : view === "grid" ? (
          <div className={dashboardCardListClass(more.expanded)}>
            <div
              className={`grid w-full grid-cols-1 gap-3 @[28rem]:grid-cols-2 ${
                more.expanded ? "" : "h-full min-h-0 @[28rem]:auto-rows-fr"
              }`}
            >
              {more.visible.map((slice) => (
                <TeamCard
                  key={slice.key}
                  slice={slice}
                  active={activeKey === slice.key}
                  onActivate={() => setActiveKey(slice.key)}
                  onClear={() => setActiveKey(null)}
                  onOpen={() => openTeam(slice)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.08)] bg-white">
            <div className="hidden shrink-0 border-b border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] px-4 py-2.5 @[34rem]:grid @[34rem]:grid-cols-[40px_minmax(100px,1.1fr)_minmax(100px,1.4fr)_88px_56px] @[34rem]:gap-3">
              <span className="text-[11px] font-medium tracking-[0.04em] text-[#adb5bd] uppercase">
                #
              </span>
              <span className="text-[11px] font-medium tracking-[0.04em] text-[#adb5bd] uppercase">
                Team
              </span>
              <span className="text-[11px] font-medium tracking-[0.04em] text-[#adb5bd] uppercase">
                Share chart
              </span>
              <span className="text-right text-[11px] font-medium tracking-[0.04em] text-[#adb5bd] uppercase">
                Leads
              </span>
              <span className="text-right text-[11px] font-medium tracking-[0.04em] text-[#adb5bd] uppercase">
                %
              </span>
            </div>
            <div className={dashboardCardListClass(more.expanded)}>
              {more.visible.map((slice, index) => (
                <TeamListRow
                  key={slice.key}
                  slice={slice}
                  rank={index + 1}
                  active={activeKey === slice.key}
                  onActivate={() => setActiveKey(slice.key)}
                  onClear={() => setActiveKey(null)}
                  onOpen={() => openTeam(slice)}
                />
              ))}
            </div>
          </div>
        )}
        <ViewMoreFooter
          total={more.total}
          preview={previewLimit}
          expanded={more.expanded}
          onExpand={more.expand}
          onCollapse={more.collapse}
          noun="teams"
        />
      </div>
    </section>
  );
}
