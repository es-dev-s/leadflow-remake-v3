"use client";

import { useMemo, useState } from "react";
import { useCountTween } from "@/hooks/use-count-tween";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import type { NamedCount } from "@/lib/api";
import { qualificationDeepLink } from "@/lib/leads-href";

type Slice = {
  key: string;
  label: string;
  shortLabel: string;
  count: number;
  tone: string;
};

/** Minimal accents only — flat white cards, no gradient fills. */
const STATUS_STYLE: Record<
  string,
  { label: string; shortLabel: string; tone: string }
> = {
  IRRELEVANT: {
    label: "Irrelevant",
    shortLabel: "Irrelevant",
    tone: "#868e96",
  },
  QUALIFIED: {
    label: "Qualified",
    shortLabel: "Qualified",
    tone: "#ff7a1a",
  },
  QUALIFIED_CALL: {
    label: "Qualified - Call",
    shortLabel: "Call",
    tone: "#e86812",
  },
  QUALIFIED_CHAT: {
    label: "Qualified - Chat",
    shortLabel: "Chat",
    tone: "#f59e0b",
  },
  PAID: {
    label: "Paid",
    shortLabel: "Paid",
    tone: "#0ca678",
  },
  ORGANIC: {
    label: "Organic",
    shortLabel: "Organic",
    tone: "#4c6ef5",
  },
  NOT_QUALIFIED: {
    label: "Not Qualified",
    shortLabel: "Not qual.",
    tone: "#212529",
  },
};

const FALLBACK_TONES = ["#868e96", "#495057", "#adb5bd"];

function humanize(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSlices(mix: NamedCount[]): Slice[] {
  return mix
    .filter((item) => item.count > 0)
    .map((item, index) => {
      const style = STATUS_STYLE[item.name];
      const label = style?.label ?? humanize(item.name);
      return {
        key: item.name,
        label,
        shortLabel: style?.shortLabel ?? label,
        count: item.count,
        tone: style?.tone ?? FALLBACK_TONES[index % FALLBACK_TONES.length]!,
      };
    });
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatPct(pct: number) {
  return pct < 1 ? pct.toFixed(2) : pct.toFixed(1);
}

type Props = {
  mix: NamedCount[];
  total: number;
  loading?: boolean;
};

function MixTile({
  slice,
  pct,
  active,
  featured = false,
  onActivate,
  onClear,
  onOpen,
}: {
  slice: Slice;
  pct: number;
  active: boolean;
  featured?: boolean;
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
      title={`Open ${slice.label} leads`}
      className={`relative flex h-full min-h-0 w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border bg-white text-left transition-[border-color] duration-150 ease-out ${
        active
          ? "border-[rgba(33,37,41,0.18)]"
          : "border-[rgba(33,37,41,0.06)] hover:border-[rgba(33,37,41,0.12)]"
      } ${featured ? "p-3.5 @[28rem]:p-5" : "p-3 @[28rem]:p-4"}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.tone }}
            />
            <p className="truncate text-[11px] font-medium text-[#6c757d] @[28rem]:text-[12px]">
              <span className="@[32rem]:hidden">{slice.shortLabel}</span>
              <span className="hidden @[32rem]:inline">{slice.label}</span>
            </p>
          </div>
          <p
            className={`mt-2 leading-none font-medium tracking-[-0.05em] tabular-nums text-[#212529] ${
              featured
                ? "text-[26px] @[28rem]:text-[34px]"
                : "text-[20px] @[28rem]:text-[24px]"
            }`}
          >
            {formatCount(slice.count)}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-[#868e96] @[28rem]:text-[12px]">
          {formatPct(pct)}%
        </span>
      </div>

      <div className="mt-3 @[28rem]:mt-4">
        <div className="h-px w-full bg-[rgba(33,37,41,0.08)]">
          <div
            className="h-px"
            style={{
              width: `${Math.max(pct, featured ? 6 : 1.5)}%`,
              backgroundColor: slice.tone,
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] text-[#868e96] @[28rem]:text-[11px]">
            Portfolio share
          </span>
          <span className="shrink-0 text-[10px] font-medium tabular-nums text-[#495057] @[28rem]:text-[11px]">
            {pct.toFixed(2)}%
          </span>
        </div>
      </div>
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
    <div className="w-full min-w-0 rounded-2xl border border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] px-3.5 py-2.5 @[32rem]:bg-white @[32rem]:px-4 @[32rem]:py-3">
      <p className="truncate text-[10px] font-medium tracking-[0.06em] text-[#868e96] uppercase @[28rem]:text-[11px]">
        {label}
      </p>
      <p className="mt-1 text-[24px] leading-none font-medium tracking-[-0.05em] tabular-nums text-[#212529] @[28rem]:mt-1.5 @[28rem]:text-[28px]">
        {formatCount(shown)}
      </p>
      <p className="mt-1 truncate text-[11px] text-[#6c757d] @[28rem]:mt-1.5 @[28rem]:text-[12px]">
        {detail}
      </p>
    </div>
  );
}

export function QualificationMixChart({ mix, total, loading = false }: Props) {
  const navigateToLeads = useNavigateToLeads();
  const slices = useMemo(() => buildSlices(mix), [mix]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const openStatus = (key: string) => {
    navigateToLeads(qualificationDeepLink(key));
  };
  const sum = useMemo(
    () => slices.reduce((acc, slice) => acc + slice.count, 0) || total,
    [slices, total],
  );
  const active = useMemo(
    () => slices.find((slice) => slice.key === activeKey) ?? null,
    [slices, activeKey],
  );

  const ordered = useMemo(() => {
    const sorted = [...slices].sort((a, b) => b.count - a.count);
    return {
      featured: sorted[0] ?? null,
      rest: sorted.slice(1),
    };
  }, [slices]);

  const ribbon = useMemo(() => {
    const floor = 8;
    const raw = slices.map((slice) => ({
      ...slice,
      pct: (slice.count / Math.max(sum, 1)) * 100,
    }));
    const boosted = raw.map((slice) => ({
      ...slice,
      weight: Math.max(slice.pct, floor),
    }));
    const weightSum = boosted.reduce((acc, slice) => acc + slice.weight, 0) || 1;
    return boosted.map((slice) => ({
      ...slice,
      flex: slice.weight / weightSum,
    }));
  }, [slices, sum]);

  const portfolioValue = active?.count ?? (total || sum);
  const portfolioLabel = active?.label ?? "Portfolio";
  const portfolioDetail = loading
    ? "Loading…"
    : active
      ? `${((active.count / Math.max(sum, 1)) * 100).toFixed(2)}% share`
      : "All qualification states";

  const restCount = ordered.rest.length;
  const tileCount = slices.length;

  return (
    <section className="@container w-full rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex flex-col gap-3 p-3.5 @[28rem]:gap-4 @[28rem]:p-5">
        {/* Header — stacks until the panel is wide enough */}
        <div className="grid w-full grid-cols-1 items-end gap-3 @[34rem]:grid-cols-[minmax(0,1fr)_minmax(140px,180px)]">
          <div className="min-w-0">
            <h2 className="text-[17px] leading-tight font-medium tracking-[-0.035em] text-[#212529] @[28rem]:text-[20px]">
              Qualification mix
            </h2>
          </div>

          <PortfolioMetric
            label={portfolioLabel}
            value={portfolioValue}
            detail={portfolioDetail}
          />
        </div>

        {/* Spectrum ribbon — container-aware */}
        <div className="w-full rounded-2xl border border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] p-1">
          {/* Narrow panel: stacked compact rows */}
          <div
            className="flex flex-col gap-1 @[26rem]:hidden"
            role="list"
            aria-label="Qualification share by percentage"
          >
            {ribbon.map((slice) => {
              const focused = activeKey === slice.key;
              return (
                <button
                  key={`stack-${slice.key}`}
                  type="button"
                  role="listitem"
                  title={`${slice.label}: ${formatCount(slice.count)} (${formatPct(slice.pct)}%)`}
                  onMouseEnter={() => setActiveKey(slice.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(slice.key)}
                  onBlur={() => setActiveKey(null)}
                  onClick={() => openStatus(slice.key)}
                  className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 ${
                    focused ? "bg-white" : "bg-transparent hover:bg-white/80"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.tone }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#6c757d]">
                    {slice.shortLabel}
                  </span>
                  <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-[rgba(33,37,41,0.08)]">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(slice.pct, 3))}%`,
                        backgroundColor: slice.tone,
                      }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right text-[12px] font-medium tabular-nums text-[#212529]">
                    {formatPct(slice.pct)}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Wider panel: proportional ribbon */}
          <div
            className="hidden w-full items-stretch gap-1 @[26rem]:flex"
            role="list"
            aria-label="Qualification share by percentage"
          >
            {ribbon.map((slice) => {
              const focused = activeKey === slice.key;
              return (
                <button
                  key={slice.key}
                  type="button"
                  role="listitem"
                  title={`${slice.label}: ${formatCount(slice.count)} (${formatPct(slice.pct)}%)`}
                  onMouseEnter={() => setActiveKey(slice.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(slice.key)}
                  onBlur={() => setActiveKey(null)}
                  onClick={() => openStatus(slice.key)}
                  className={`relative flex min-h-[56px] min-w-0 flex-col justify-between overflow-hidden rounded-xl px-1.5 py-2 text-left transition-[border-color,background-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(33,37,41,0.16)] @[34rem]:min-h-[68px] @[34rem]:px-2.5 ${
                    focused
                      ? "border border-[rgba(33,37,41,0.14)] bg-white"
                      : "border border-transparent bg-white/70 hover:bg-white"
                  }`}
                  style={{ flex: `${slice.flex} 1 0%`, maxWidth: "100%" }}
                >
                  <span
                    aria-hidden
                    className="mb-1.5 h-1 w-4 shrink-0 rounded-full @[34rem]:w-6"
                    style={{ backgroundColor: slice.tone }}
                  />
                  <div className="min-w-0 overflow-hidden">
                    <p className="truncate text-[10px] font-medium text-[#6c757d] @[34rem]:text-[12px]">
                      <span className="@[40rem]:hidden">{slice.shortLabel}</span>
                      <span className="hidden @[40rem]:inline">{slice.label}</span>
                    </p>
                    <div className="mt-1 flex min-w-0 items-baseline gap-1">
                      <span className="truncate text-[14px] leading-none font-medium tracking-[-0.03em] tabular-nums text-[#212529] @[34rem]:text-[17px]">
                        {formatPct(slice.pct)}%
                      </span>
                      <span className="hidden truncate text-[10px] tabular-nums text-[#868e96] @[44rem]:inline">
                        {formatCount(slice.count)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tiles + legend — grows with content; page scroll owns the wheel */}
        <div className="flex flex-col gap-3 @[28rem]:gap-4">
          {ordered.featured ? (
            <div
              className={[
                "grid content-start gap-2.5 @[36rem]:gap-3",
                tileCount === 1
                  ? "grid-cols-1"
                  : tileCount === 2
                    ? "grid-cols-1 @[28rem]:grid-cols-2"
                    : "grid-cols-1 @[36rem]:grid-cols-2",
              ].join(" ")}
            >
              <div
                className={[
                  "min-h-[112px] @[28rem]:min-h-[128px]",
                  tileCount >= 3
                    ? "@[36rem]:row-span-2 @[36rem]:min-h-[100%]"
                    : "",
                  tileCount === 1 ? "min-h-[140px] @[28rem]:min-h-[160px]" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MixTile
                  slice={ordered.featured}
                  pct={(ordered.featured.count / Math.max(sum, 1)) * 100}
                  active={activeKey === ordered.featured.key}
                  featured={tileCount !== 2}
                  onActivate={() => setActiveKey(ordered.featured!.key)}
                  onClear={() => setActiveKey(null)}
                  onOpen={() => openStatus(ordered.featured!.key)}
                />
              </div>

              {ordered.rest.map((slice) => (
                <div
                  key={slice.key}
                  className={[
                    "min-h-[96px] @[28rem]:min-h-[110px]",
                    tileCount === 2 ? "min-h-[112px] @[28rem]:min-h-[128px]" : "",
                    tileCount >= 3 && restCount === 1
                      ? "@[36rem]:min-h-[100%]"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <MixTile
                    slice={slice}
                    pct={(slice.count / Math.max(sum, 1)) * 100}
                    active={activeKey === slice.key}
                    featured={tileCount === 2}
                    onActivate={() => setActiveKey(slice.key)}
                    onClear={() => setActiveKey(null)}
                    onOpen={() => openStatus(slice.key)}
                  />
                </div>
              ))}
            </div>
          ) : !loading ? (
            <p className="rounded-2xl border border-dashed border-[rgba(33,37,41,0.12)] bg-[#f8f9fa] px-4 py-10 text-center text-[13px] text-[#6c757d]">
              No qualification data yet.
            </p>
          ) : (
            <div className="grid min-h-[160px] grid-cols-1 gap-2.5 @[36rem]:grid-cols-2">
              <div className="min-h-[120px] rounded-2xl bg-[#f8f9fa] @[36rem]:row-span-2" />
              <div className="min-h-[96px] rounded-2xl bg-[#f8f9fa]" />
              <div className="min-h-[96px] rounded-2xl bg-[#f8f9fa]" />
            </div>
          )}

          {slices.length > 0 ? (
            <div
              className={[
                "grid w-full gap-1 border-t border-[rgba(33,37,41,0.05)] pt-2.5",
                tileCount <= 2
                  ? "grid-cols-1 @[24rem]:grid-cols-2"
                  : tileCount === 3
                    ? "grid-cols-1 @[24rem]:grid-cols-3"
                    : "grid-cols-1 @[24rem]:grid-cols-2 @[36rem]:grid-cols-3 @[44rem]:grid-cols-5",
              ].join(" ")}
            >
              {slices.map((slice) => {
                const pct = (slice.count / Math.max(sum, 1)) * 100;
                const isActive = activeKey === slice.key;
                return (
                  <button
                    key={`legend-${slice.key}`}
                    type="button"
                    onMouseEnter={() => setActiveKey(slice.key)}
                    onMouseLeave={() => setActiveKey(null)}
                    onClick={() => openStatus(slice.key)}
                    className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ${
                      isActive ? "bg-[#f8f9fa]" : "hover:bg-[#f8f9fa]"
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.tone }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-[#6c757d] @[28rem]:text-[12px]">
                      <span className="@[40rem]:hidden">{slice.shortLabel}</span>
                      <span className="hidden @[40rem]:inline">{slice.label}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-[#212529] @[28rem]:text-[12px]">
                      {formatPct(pct)}%
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
