"use client";

import { ChevronDown, ExternalLink, LoaderCircle } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import {
  fetchReport,
  type ReportBucketRow,
  type ReportLanguageTrend,
  type ReportReasonRow,
  type ReportResponse,
  type ReportServiceDemand,
  type ReportTotals,
  type ReportTrendRow,
} from "@/lib/api";
import {
  addedBucketDeepLink,
  type LeadsDeepLink,
} from "@/lib/leads-href";

const REPORT_LINES = ["CDR", "CCL", "PTE", "ACS"] as const;
type ReportLine = (typeof REPORT_LINES)[number];

const LINE_META: Record<
  ReportLine,
  { title: string; subtitle: string }
> = {
  CDR: {
    title: "CDR",
    subtitle: "Competency Demonstration Report · lead quality & demand",
  },
  CCL: {
    title: "NAATI CCL",
    subtitle: "Language & package demand · lead quality & geography",
  },
  PTE: {
    title: "PTE Hub",
    subtitle: "Course packages · exam readiness · lead quality",
  },
  ACS: {
    title: "ACS RPL",
    subtitle: "RPL services · ad quality · geography & conversion",
  },
};

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatRevenue(value: number | undefined | null) {
  if (value == null || value === 0) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

function pct(part: number, whole: number) {
  if (!whole) return "—";
  const v = (part / whole) * 100;
  if (v > 0 && v < 0.1) return "<0.1%";
  return `${v.toFixed(1)}%`;
}

function demandQuery(name: string) {
  return name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/[+/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

function geoValue(name: string) {
  const v = name.trim();
  if (!v || /^unknown$/i.test(v) || /^none$/i.test(v)) return "none";
  return v;
}

function ShareBar({
  part,
  whole,
  tone = "brand",
}: {
  part: number;
  whole: number;
  tone?: "brand" | "green" | "red" | "muted";
}) {
  const share = whole > 0 ? Math.min(100, (part / whole) * 100) : 0;
  const fill =
    tone === "green"
      ? "bg-[#40c057]"
      : tone === "red"
        ? "bg-[#fa5252]"
        : tone === "muted"
          ? "bg-[#adb5bd]"
          : "bg-[linear-gradient(90deg,#f59e0b,#e86812)]";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f1f3f5]">
      <div
        className={`h-full rounded-full ${fill}`}
        style={{ width: `${Math.max(share, part > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium tracking-[-0.02em] text-[#212529]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] text-[#868e96]">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-[rgba(33,37,41,0.1)] bg-white px-4 py-10">
      <p className="text-[12px] text-[#adb5bd]">{label}</p>
    </div>
  );
}

function ClickHint() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[#adb5bd]">
      <ExternalLink size={11} strokeWidth={1.75} />
      Click any row to open matching leads
    </span>
  );
}

/* ---------- KPI strip ---------- */

function KpiStrip({
  totals,
  onOpen,
}: {
  totals: ReportTotals;
  onOpen: (link: Partial<LeadsDeepLink>) => void;
}) {
  const cards = [
    {
      label: "Total leads",
      value: totals.leads,
      hint: "All enquiries",
      link: {},
      tone: "text-[#212529]",
    },
    {
      label: "Qualified",
      value: totals.qualified,
      hint: pct(totals.qualified, totals.leads),
      link: { filter: "qualified" },
      tone: "text-[#2b8a3e]",
    },
    {
      label: "Irrelevant",
      value: totals.irrelevant,
      hint: pct(totals.irrelevant, totals.leads),
      link: { filter: "irrelevant" },
      tone: "text-[#c92a2a]",
    },
    {
      label: "Closed won",
      value: totals.closedWon,
      hint: formatRevenue(totals.revenue),
      link: { filter: "converted" },
      tone: "text-[#e86812]",
    },
    {
      label: "Closed lost",
      value: totals.closedLost,
      hint: pct(totals.closedLost, totals.leads),
      link: { filter: "lost" },
      tone: "text-[#495057]",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          onClick={() => onOpen(card.link)}
          className="group rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white px-3.5 py-3 text-left transition-colors hover:border-[rgba(232,104,18,0.28)] hover:bg-[#fffaf5]"
        >
          <p className="text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
            {card.label}
          </p>
          <p
            className={`mt-1 text-[22px] font-medium tracking-[-0.03em] tabular-nums ${card.tone}`}
          >
            {formatCount(card.value)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#868e96]">{card.hint}</p>
        </button>
      ))}
    </div>
  );
}

/* ---------- Monthly trend chart ---------- */

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

function MonthlyTrendChart({
  rows,
  onOpenMonth,
}: {
  rows: ReportTrendRow[];
  onOpenMonth: (key: string) => void;
}) {
  const gradId = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const height = 220;
  const pad = { top: 18, right: 12, bottom: 32, left: 36 };

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

  if (rows.length === 0) {
    return <EmptyPanel label="No monthly trend data yet" />;
  }

  const plotW = Math.max(width - pad.left - pad.right, 1);
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const points = rows.map((row, index) => {
    const x =
      rows.length <= 1
        ? pad.left + plotW / 2
        : pad.left + (index / (rows.length - 1)) * plotW;
    return {
      ...row,
      x,
      yTotal: pad.top + plotH - (row.total / max) * plotH,
      yQual: pad.top + plotH - (row.qualified / max) * plotH,
    };
  });
  const totalPath = buildPath(points.map((p) => ({ x: p.x, y: p.yTotal })));
  const qualPath = buildPath(points.map((p) => ({ x: p.x, y: p.yQual })));
  const areaPath =
    points.length === 0
      ? ""
      : `${totalPath} L ${points[points.length - 1]!.x} ${pad.top + plotH} L ${points[0]!.x} ${pad.top + plotH} Z`;
  const activeRow = points.find((p) => p.key === active) ?? null;
  const labelEvery = points.length > 12 ? 3 : points.length > 8 ? 2 : 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(33,37,41,0.05)] px-4 py-2.5">
        <div className="flex items-center gap-4 text-[11px] text-[#868e96]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-[#e86812]" />
            Total enquiries
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-[#40c057]" />
            Qualified
          </span>
        </div>
        {activeRow ? (
          <p className="text-[12px] text-[#495057]">
            <span className="font-medium text-[#212529]">{activeRow.label}</span>
            {" · "}
            {formatCount(activeRow.total)} total
            {" · "}
            {formatCount(activeRow.qualified)} qualified
            {" · "}
            {formatCount(activeRow.closedWon)} won
          </p>
        ) : (
          <ClickHint />
        )}
      </div>
      <div ref={wrapRef} className="w-full px-1 pt-1 pb-2">
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block h-[220px] w-full"
            role="img"
            aria-label="Monthly enquiry trend"
          >
            <defs>
              <linearGradient id={`area-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((t) => {
              const y = pad.top + plotH - t * plotH;
              const val = Math.round(max * t);
              return (
                <g key={t}>
                  <line
                    x1={pad.left}
                    x2={pad.left + plotW}
                    y1={y}
                    y2={y}
                    stroke="rgba(33,37,41,0.06)"
                  />
                  <text
                    x={pad.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-[#adb5bd]"
                    fontSize="10"
                  >
                    {formatCount(val)}
                  </text>
                </g>
              );
            })}
            <path d={areaPath} fill={`url(#area-${gradId})`} />
            <path
              d={totalPath}
              fill="none"
              stroke="#e86812"
              strokeWidth="2.25"
              strokeLinecap="round"
            />
            <path
              d={qualPath}
              fill="none"
              stroke="#40c057"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="4 3"
            />
            {points.map((p, i) => (
              <g key={p.key}>
                <rect
                  x={p.x - plotW / points.length / 2}
                  y={pad.top}
                  width={Math.max(plotW / points.length, 8)}
                  height={plotH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setActive(p.key)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => onOpenMonth(p.key)}
                />
                {active === p.key ? (
                  <circle cx={p.x} cy={p.yTotal} r="4" fill="#e86812" />
                ) : null}
                {i % labelEvery === 0 || i === points.length - 1 ? (
                  <text
                    x={p.x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-[#adb5bd]"
                    fontSize="10"
                  >
                    {p.label.split(" ")[0]}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
        ) : (
          <div className="h-[220px]" />
        )}
      </div>
    </div>
  );
}

/* ---------- Source / geo tables ---------- */

function sourceLabel(name: string) {
  return name === "none" || name === "No source recorded"
    ? "No source recorded"
    : name;
}

function sourceFilterValue(name: string) {
  return name === "No source recorded" || name === "none" ? "none" : name;
}

function SourceList({
  rows,
  tone,
  loading,
  emptyLabel,
  onOpen,
}: {
  rows: ReportBucketRow[];
  tone: "qualified" | "irrelevant";
  loading: boolean;
  emptyLabel: string;
  onOpen: (row: ReportBucketRow) => void;
}) {
  const primary = (row: ReportBucketRow) =>
    tone === "qualified" ? row.qualified : row.irrelevant;
  const max = Math.max(1, ...rows.map(primary));
  const total = rows.reduce((s, r) => s + primary(r), 0);
  const headerTone =
    tone === "qualified"
      ? "text-[#2b8a3e] bg-[#ebfbee] border-[rgba(47,158,68,0.18)]"
      : "text-[#c92a2a] bg-[#fff5f5] border-[rgba(201,42,42,0.16)]";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-[#fafbfc]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(33,37,41,0.05)] bg-white px-4 py-3">
        <div>
          <p className="text-[13px] font-medium text-[#212529]">
            {tone === "qualified" ? "Qualified sources" : "Irrelevant sources"}
          </p>
          <p className="mt-0.5 text-[11px] text-[#868e96]">Ad account / source</p>
        </div>
        <span
          className={`inline-flex h-7 items-center rounded-lg border px-2.5 text-[12px] font-medium tabular-nums ${headerTone}`}
        >
          {loading ? "…" : formatCount(total)}
        </span>
      </div>
      <div className="lf-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-2.5">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-[#adb5bd]">
            <LoaderCircle size={14} className="animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-2 py-12 text-center text-[12px] text-[#adb5bd]">
            {emptyLabel}
          </p>
        ) : (
          rows.map((row) => {
            const value = primary(row);
            return (
              <button
                key={row.name}
                type="button"
                onClick={() => onOpen(row)}
                className="w-full rounded-xl border border-transparent bg-white px-3 py-2.5 text-left transition-colors hover:border-[rgba(232,104,18,0.22)] hover:bg-[#fffaf5]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="truncate text-[13px] font-medium text-[#212529]"
                    title={sourceLabel(row.name)}
                  >
                    {sourceLabel(row.name)}
                  </p>
                  <span
                    className={`shrink-0 text-[13px] font-medium tabular-nums ${
                      tone === "qualified" ? "text-[#2b8a3e]" : "text-[#c92a2a]"
                    }`}
                  >
                    {formatCount(value)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ShareBar
                    part={value}
                    whole={max}
                    tone={tone === "qualified" ? "green" : "red"}
                  />
                </div>
                <div className="mt-1.5 flex gap-3 text-[11px] text-[#868e96]">
                  <span>{formatCount(row.total)} total</span>
                  <span>{pct(value, row.total)} of source</span>
                  {row.closedWon > 0 ? (
                    <span>{formatCount(row.closedWon)} won</span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function GeoTable({
  rows,
  metric,
  emptyLabel,
  onOpen,
}: {
  rows: ReportBucketRow[];
  metric: "qualified" | "irrelevant" | "exclude";
  emptyLabel: string;
  onOpen: (row: ReportBucketRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-[12px] text-[#adb5bd]">
        {emptyLabel}
      </p>
    );
  }
  const valueOf = (row: ReportBucketRow) =>
    metric === "qualified"
      ? row.qualified
      : metric === "irrelevant"
        ? row.irrelevant
        : row.total;
  const max = Math.max(1, ...rows.map(valueOf));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[rgba(33,37,41,0.05)]">
            <th className="px-3 py-2 text-left text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
              Location
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
              {metric === "exclude" ? "Enquiries" : metric === "qualified" ? "Qualified" : "Irrelevant"}
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
              Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const value = valueOf(row);
            const rate =
              metric === "exclude"
                ? pct(row.qualified, row.total)
                : pct(value, row.total);
            return (
              <tr
                key={row.name}
                className="cursor-pointer border-b border-[rgba(33,37,41,0.04)] last:border-b-0 hover:bg-[#fffaf5]"
                onClick={() => onOpen(row)}
              >
                <td className="px-3 py-2.5">
                  <p className="text-[12.5px] text-[#212529]">{row.name}</p>
                  <div className="mt-1.5 max-w-[200px]">
                    <ShareBar
                      part={value}
                      whole={max}
                      tone={
                        metric === "qualified"
                          ? "green"
                          : metric === "irrelevant"
                            ? "red"
                            : "muted"
                      }
                    />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#495057]">
                  {formatCount(value)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#868e96]">
                  {rate}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GeoPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="border-b border-[rgba(33,37,41,0.05)] px-3 py-2">
        <p className="text-[12px] font-medium text-[#495057]">{title}</p>
      </div>
      {children}
    </div>
  );
}

/* ---------- Demand / reason tables ---------- */

function DemandTable({
  rows,
  itemLabel,
  emphasize,
  showRevenue,
  onOpen,
}: {
  rows: ReportServiceDemand[];
  itemLabel: string;
  emphasize: "enquiries" | "conversion";
  showRevenue?: boolean;
  onOpen: (row: ReportServiceDemand) => void;
}) {
  const maxEnq = Math.max(1, ...rows.map((r) => r.enquiries));
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[rgba(33,37,41,0.05)]">
              <th className="px-4 py-2 text-left text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                {itemLabel}
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                Enquiries
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                Qualified
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                Won
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                Conv.
              </th>
              {showRevenue ? (
                <th className="px-4 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                  Revenue
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rate = row.enquiries ? row.closedWon / row.enquiries : 0;
              const barPart =
                emphasize === "enquiries"
                  ? row.enquiries
                  : Math.round(rate * 1000);
              const barWhole = emphasize === "enquiries" ? maxEnq : 1000;
              return (
                <tr
                  key={row.name}
                  className="cursor-pointer border-b border-[rgba(33,37,41,0.04)] last:border-b-0 hover:bg-[#fffaf5]"
                  onClick={() => onOpen(row)}
                >
                  <td className="px-4 py-2.5">
                    <p className="text-[12.5px] text-[#212529]">{row.name}</p>
                    <div className="mt-1.5 max-w-[220px]">
                      <ShareBar part={barPart} whole={barWhole} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#495057]">
                    {formatCount(row.enquiries)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#2b8a3e]">
                    {formatCount(row.qualified)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#495057]">
                    {formatCount(row.closedWon)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#495057]">
                    {pct(row.closedWon, row.enquiries)}
                  </td>
                  {showRevenue ? (
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#495057]">
                      {formatRevenue(row.revenue)}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DemandBlock({
  title,
  subtitle,
  rows,
  itemLabel,
  emptyHint,
  emptyItems,
  showRevenue,
  questions,
  onOpen,
}: {
  title: string;
  subtitle?: string;
  rows: ReportServiceDemand[];
  itemLabel: string;
  emptyHint: string;
  emptyItems?: string[];
  showRevenue?: boolean;
  questions: { highest: string; conversion: string; rare: string; revenue?: string };
  onOpen: (row: ReportServiceDemand) => void;
}) {
  const hasAny = rows.some((r) => r.enquiries > 0);
  const byEnq = useMemo(
    () => [...rows].filter((r) => r.enquiries > 0).sort((a, b) => b.enquiries - a.enquiries),
    [rows],
  );
  const byConv = useMemo(
    () =>
      [...rows]
        .filter((r) => r.enquiries > 0)
        .sort((a, b) => {
          const ar = a.enquiries ? a.closedWon / a.enquiries : 0;
          const br = b.enquiries ? b.closedWon / b.enquiries : 0;
          return br - ar || b.enquiries - a.enquiries;
        }),
    [rows],
  );
  const rare = useMemo(
    () =>
      [...rows]
        .filter((r) => r.enquiries > 0 && r.closedWon / r.enquiries < 0.05)
        .sort((a, b) => b.enquiries - a.enquiries),
    [rows],
  );
  const byRevenue = useMemo(
    () =>
      [...rows]
        .filter((r) => (r.revenue ?? 0) > 0)
        .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)),
    [rows],
  );

  return (
    <Section title={title} subtitle={subtitle} action={<ClickHint />}>
      {!hasAny ? (
        <div className="rounded-2xl border border-dashed border-[rgba(33,37,41,0.1)] bg-white px-4 py-8">
          <p className="text-center text-[12px] text-[#adb5bd]">{emptyHint}</p>
          {emptyItems?.length ? (
            <ul className="mx-auto mt-3 max-w-md space-y-1 text-[12px] text-[#868e96]">
              {emptyItems.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              {questions.highest}
            </p>
            <DemandTable
              rows={byEnq}
              itemLabel={itemLabel}
              emphasize="enquiries"
              showRevenue={showRevenue}
              onOpen={onOpen}
            />
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              {questions.conversion}
            </p>
            <DemandTable
              rows={byConv}
              itemLabel={itemLabel}
              emphasize="conversion"
              showRevenue={showRevenue}
              onOpen={onOpen}
            />
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              {questions.rare}
            </p>
            {rare.length === 0 ? (
              <EmptyPanel label="No low-converting items in this sample" />
            ) : (
              <DemandTable
                rows={rare}
                itemLabel={itemLabel}
                emphasize="conversion"
                showRevenue={showRevenue}
                onOpen={onOpen}
              />
            )}
          </div>
          {showRevenue && questions.revenue ? (
            <div>
              <p className="mb-2 text-[12px] font-medium text-[#495057]">
                {questions.revenue}
              </p>
              {byRevenue.length === 0 ? (
                <EmptyPanel label="No attributed revenue yet" />
              ) : (
                <DemandTable
                  rows={byRevenue}
                  itemLabel={itemLabel}
                  emphasize="enquiries"
                  showRevenue
                  onOpen={onOpen}
                />
              )}
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function ReasonTable({
  rows,
  showZero,
  emptyLabel,
  onOpen,
}: {
  rows: ReportReasonRow[];
  showZero?: boolean;
  emptyLabel: string;
  onOpen?: (row: ReportReasonRow) => void;
}) {
  const visible = showZero ? rows : rows.filter((r) => r.count > 0);
  if (visible.length === 0) return <EmptyPanel label={emptyLabel} />;
  const max = Math.max(1, ...visible.map((r) => r.count));
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[rgba(33,37,41,0.05)]">
            <th className="px-4 py-2 text-left text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
              Pattern / reason
            </th>
            <th className="px-4 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
              Count
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr
              key={row.reason}
              className={`border-b border-[rgba(33,37,41,0.04)] last:border-b-0 ${
                onOpen && row.count > 0
                  ? "cursor-pointer hover:bg-[#fffaf5]"
                  : ""
              }`}
              onClick={() => {
                if (onOpen && row.count > 0) onOpen(row);
              }}
            >
              <td className="px-4 py-2.5">
                <p className="text-[12.5px] text-[#212529]">{row.reason}</p>
                <div className="mt-1.5 max-w-[260px]">
                  <ShareBar part={row.count} whole={max} />
                </div>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-[#495057]">
                {formatCount(row.count)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LanguageTrendTable({
  rows,
  onOpen,
}: {
  rows: ReportLanguageTrend[];
  onOpen: (name: string) => void;
}) {
  if (rows.length === 0) {
    return <EmptyPanel label="Not enough language timeline data yet" />;
  }
  const max = Math.max(1, ...rows.map((r) => r.recent));
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[rgba(33,37,41,0.05)]">
            <th className="px-4 py-2 text-left text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
              Language
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
              Recent 9m
            </th>
            <th className="px-3 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
              Prior 9m
            </th>
            <th className="px-4 py-2 text-right text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
              Growth
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.name}
              className="cursor-pointer border-b border-[rgba(33,37,41,0.04)] last:border-b-0 hover:bg-[#fffaf5]"
              onClick={() => onOpen(row.name)}
            >
              <td className="px-4 py-2.5">
                <p className="text-[12.5px] text-[#212529]">{row.name}</p>
                <div className="mt-1.5 max-w-[200px]">
                  <ShareBar part={row.recent} whole={max} />
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[#495057]">
                {formatCount(row.recent)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[#868e96]">
                {formatCount(row.prior)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-[#2b8a3e]">
                {row.prior === 0 && row.recent > 0
                  ? "New"
                  : row.growthPct == null
                    ? "—"
                    : `${row.growthPct > 0 ? "+" : ""}${row.growthPct.toFixed(0)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Shared report body ---------- */

function ReportBody({
  line,
  report,
  loading,
  error,
}: {
  line: ReportLine;
  report: ReportResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const navigate = useNavigateToLeads();
  const meta = LINE_META[line];

  const open = (extra: Partial<LeadsDeepLink> = {}) => {
    navigate({ serviceLine: line, ...extra });
  };

  const qualifiedSources = useMemo(() => {
    if (!report) return [];
    return [...report.sources]
      .filter((row) => row.qualified > 0)
      .sort((a, b) => b.qualified - a.qualified || b.total - a.total);
  }, [report]);

  const irrelevantSources = useMemo(() => {
    if (!report) return [];
    return [...report.sources]
      .filter((row) => row.irrelevant > 0)
      .sort((a, b) => b.irrelevant - a.irrelevant || b.total - a.total);
  }, [report]);

  const campaignSources = useMemo(() => {
    if (!report || line !== "ACS") return [];
    return [...report.sources]
      .filter((row) => row.total >= 20 && row.qualified > 0)
      .sort((a, b) => {
        const ar = a.total ? a.qualified / a.total : 0;
        const br = b.total ? b.qualified / b.total : 0;
        return br - ar || b.qualified - a.qualified;
      })
      .slice(0, 15);
  }, [report, line]);

  if (error) {
    return (
      <p className="rounded-xl border border-[rgba(201,42,42,0.16)] bg-[#fff5f5] px-4 py-8 text-center text-[12px] text-[#c92a2a]">
        {error}
      </p>
    );
  }

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[12px] text-[#adb5bd]">
        <LoaderCircle size={14} className="animate-spin" />
        Loading {meta.title} report…
      </div>
    );
  }

  if (!report) return null;

  const languages = (report.languageDemand ?? []).filter((r) => r.enquiries > 0);
  const packages = report.serviceDemand ?? [];
  const promo = report.promoDemand ?? [];
  const languageTrend = report.languageTrend ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white px-4 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium tracking-[0.1em] text-[#e86812] uppercase">
              {meta.title} report
            </p>
            <p className="mt-0.5 text-[13px] text-[#868e96]">{meta.subtitle}</p>
          </div>
          <ClickHint />
        </div>
        <p className="mb-3 rounded-xl bg-[#f8f9fa] px-3 py-2 text-[11px] leading-relaxed text-[#868e96]">
          <span className="font-medium text-[#495057]">Data confidence: </span>
          KPIs, sources, geography, monthly trend, and irrelevant/lost reasons
          are exact CRM counts for this service line. Service / language /
          package demand and pattern checklists are inferred from free-text
          notes — use them as directional signals only, not for ad budget
          decisions.
        </p>
        <KpiStrip totals={report.totals} onOpen={open} />
      </div>

      <Section
        title="Enquiry trend"
        subtitle="Last 18 months · Kathmandu calendar · click a month to open leads"
      >
        <MonthlyTrendChart
          rows={report.monthlyTrend ?? []}
          onOpenMonth={(key) => {
            const range = addedBucketDeepLink(key);
            if (range) open(range);
          }}
        />
      </Section>

      <Section
        title="Lead quality by source"
        subtitle="Ad accounts ranked by qualified vs irrelevant enquiries"
        action={<ClickHint />}
      >
        <div className="grid h-[min(48vh,520px)] grid-cols-1 gap-3 lg:grid-cols-2">
          <SourceList
            rows={qualifiedSources}
            tone="qualified"
            loading={loading}
            emptyLabel="No qualified sources"
            onOpen={(row) =>
              open({ source: sourceFilterValue(row.name), filter: "qualified" })
            }
          />
          <SourceList
            rows={irrelevantSources}
            tone="irrelevant"
            loading={loading}
            emptyLabel="No irrelevant sources"
            onOpen={(row) =>
              open({
                source: sourceFilterValue(row.name),
                filter: "irrelevant",
              })
            }
          />
        </div>
        {line === "ACS" ? (
          <div className="mt-3">
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              Campaigns with consistent qualified enquiries
            </p>
            <p className="mb-2 text-[11px] text-[#868e96]">
              Sources with ≥20 enquiries · ranked by qualified rate
            </p>
            <div className="h-[min(32vh,340px)]">
              <SourceList
                rows={campaignSources}
                tone="qualified"
                loading={loading}
                emptyLabel="No campaign-quality sources yet"
                onOpen={(row) =>
                  open({
                    source: sourceFilterValue(row.name),
                    filter: "qualified",
                  })
                }
              />
            </div>
          </div>
        ) : null}
      </Section>

      <Section
        title="Geographic insights"
        subtitle="Cities and countries · click a row to open those leads"
        action={<ClickHint />}
      >
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              Highest qualified enquiries
            </p>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <GeoPanel title="Countries">
                <GeoTable
                  rows={report.qualifiedCountries}
                  metric="qualified"
                  emptyLabel="No qualified countries"
                  onOpen={(row) =>
                    open({
                      country: geoValue(row.name),
                      filter: "qualified",
                    })
                  }
                />
              </GeoPanel>
              <GeoPanel title="Cities">
                <GeoTable
                  rows={report.qualifiedCities}
                  metric="qualified"
                  emptyLabel="No named cities with qualified leads"
                  onOpen={(row) =>
                    open({
                      city: geoValue(row.name),
                      filter: "qualified",
                    })
                  }
                />
              </GeoPanel>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              Highest irrelevant / low-quality enquiries
            </p>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <GeoPanel title="Countries">
                <GeoTable
                  rows={report.irrelevantCountries}
                  metric="irrelevant"
                  emptyLabel="No irrelevant countries"
                  onOpen={(row) =>
                    open({
                      country: geoValue(row.name),
                      filter: "irrelevant",
                    })
                  }
                />
              </GeoPanel>
              <GeoPanel title="Cities">
                <GeoTable
                  rows={report.irrelevantCities}
                  metric="irrelevant"
                  emptyLabel="No named cities with irrelevant leads"
                  onOpen={(row) =>
                    open({
                      city: geoValue(row.name),
                      filter: "irrelevant",
                    })
                  }
                />
              </GeoPanel>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              Locations to review for campaign exclusion
            </p>
            <p className="mb-2 text-[11px] text-[#868e96]">
              High volume with under 0.5% qualified rate
            </p>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <GeoPanel title="Countries">
                <GeoTable
                  rows={report.exclusionCandidates}
                  metric="exclude"
                  emptyLabel="No country exclusion candidates"
                  onOpen={(row) => open({ country: geoValue(row.name) })}
                />
              </GeoPanel>
              <GeoPanel title="Cities">
                <GeoTable
                  rows={report.exclusionCities ?? []}
                  metric="exclude"
                  emptyLabel="No city exclusion candidates"
                  onOpen={(row) => open({ city: geoValue(row.name) })}
                />
              </GeoPanel>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Audience demographics"
        subtitle="Age, education, occupation and visa fields are not captured yet"
      >
        <EmptyPanel label="No demographic data captured yet" />
      </Section>

      {(line === "CDR" || line === "ACS") && (
        <Section
          title="Professional experience"
          subtitle="Experience level and eligibility status are not captured yet"
        >
          <EmptyPanel label="No professional experience data captured yet" />
        </Section>
      )}

      {line === "CCL" ? (
        <>
          <DemandBlock
            title="Language demand"
            subtitle="Directional only · inferred from notes · click searches similar text, not a structured field"
            rows={languages}
            itemLabel="Language"
            emptyHint="Language interest is not systematically captured yet"
            questions={{
              highest: "Highest enquiry volume by language",
              conversion: "Highest conversion rate by language",
              rare: "Languages with enquiries but rare conversion",
            }}
            onOpen={(row) => open({ q: demandQuery(row.name) })}
          />
          <Section
            title="Rising language demand"
            subtitle="Recent 9 months vs prior 9 months"
            action={<ClickHint />}
          >
            <LanguageTrendTable
              rows={languageTrend}
              onOpen={(name) => open({ q: name })}
            />
          </Section>
          <DemandBlock
            title="Course & package demand"
            subtitle="Directional only · inferred from notes · not for budget allocation"
            rows={packages}
            itemLabel="Package"
            emptyHint="Package interest is not systematically captured yet"
            emptyItems={[
              "NAATI CCL Course Package",
              "Free NAATI Mock Test",
              "NAATI CCL Vocabulary",
              "Premium Package",
              "Unlimited Package",
            ]}
            questions={{
              highest: "Highest enquiry volume by package",
              conversion: "Highest subscription / conversion",
              rare: "Interest with lower enrolments",
            }}
            onOpen={(row) => open({ q: demandQuery(row.name) })}
          />
        </>
      ) : null}

      {line === "PTE" ? (
        <>
          <Section
            title="Exam readiness & buyer intent"
            subtitle="Exam reason, booking, timing and target score are not captured yet"
          >
            <EmptyPanel label="Exam readiness fields are not captured yet" />
          </Section>
          <DemandBlock
            title="Course & package demand"
            subtitle="Directional only · package names are rarely tagged in notes"
            rows={packages}
            itemLabel="Package"
            emptyHint="PTE package interest is not systematically captured yet"
            emptyItems={[
              "Comprehensive Package ($399)",
              "Premium Package ($249)",
              "Essential Package ($149)",
              "Coaching Intensive Package ($599)",
              "Mock Test Bundles",
            ]}
            showRevenue
            questions={{
              highest: "Highest enquiry volume by package",
              conversion: "Highest conversion rate",
              rare: "Enquiries with low enrolment",
              revenue: "Highest attributed revenue",
            }}
            onOpen={(row) => open({ q: demandQuery(row.name) })}
          />
          <DemandBlock
            title="Promotional offers"
            subtitle="Discount / promo mentions in notes"
            rows={promo}
            itemLabel="Offer signal"
            emptyHint="Promo / discount interest is not systematically captured yet"
            questions={{
              highest: "Discount & promo enquiry signals",
              conversion: "Offers linked to closed-won",
              rare: "Offer mentions with rare conversion",
            }}
            onOpen={(row) => open({ q: demandQuery(row.name) })}
          />
        </>
      ) : null}

      {(line === "CDR" || line === "ACS") && (
        <DemandBlock
          title="Service demand"
          subtitle="Directional only · inferred from notes · click searches similar text"
          rows={packages}
          itemLabel="Service"
          emptyHint="Service interest is not systematically captured yet"
          emptyItems={
            line === "CDR"
              ? [
                  "Career Episodes Report Writing",
                  "Complete CDR Report Writing",
                  "Summary Statement Report Writing",
                  "CPD",
                  "Engineering CV / Resume Writing",
                ]
              : [
                  "Complete RPL Report Writing",
                  "Employment Reference Letter",
                  "Project Report Writing",
                  "KAO Writing",
                  "RPL Plagiarism Check",
                ]
          }
          showRevenue={line === "ACS"}
          questions={{
            highest: "Highest enquiry volume by service",
            conversion: "Highest conversion rate by service",
            rare: "Enquiries with rare conversion",
            revenue: line === "ACS" ? "Highest attributed revenue" : undefined,
          }}
          onOpen={(row) => open({ q: demandQuery(row.name) })}
        />
      )}

      {(line === "CCL" || line === "PTE") && (
        <Section
          title={line === "CCL" ? "Test readiness & buyer intent" : "Buyer intent extras"}
          subtitle="Structured intent fields are not captured yet"
        >
          <EmptyPanel label="Intent / readiness fields are not captured yet" />
        </Section>
      )}

      {(line === "CDR" || line === "ACS") && (
        <Section
          title="Buyer intent"
          subtitle="Primary reason and timing are not captured yet"
        >
          <EmptyPanel label="Buyer intent fields are not captured yet" />
        </Section>
      )}

      <Section
        title="Sales signals"
        subtitle="Irrelevant patterns and closed-lost objections from CRM notes"
        action={<ClickHint />}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              Irrelevant enquiry reasons
            </p>
            <ReasonTable
              rows={report.irrelevantReasons ?? []}
              emptyLabel="No irrelevant reasons recorded"
              onOpen={(row) =>
                open({ filter: "irrelevant", reason: row.reason })
              }
            />
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              Recurring irrelevant patterns
            </p>
            <ReasonTable
              rows={report.irrelevantPatterns ?? []}
              showZero
              emptyLabel="No pattern signal yet"
            />
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              Closed-lost objections
            </p>
            <ReasonTable
              rows={report.lostReasons ?? []}
              emptyLabel="No closed-lost objections recorded"
              onOpen={(row) => open({ filter: "lost", q: row.reason })}
            />
          </div>
          <div>
            <p className="mb-2 text-[12px] font-medium text-[#495057]">
              Lost-opportunity factors
            </p>
            <ReasonTable
              rows={report.lostOpportunityFactors ?? []}
              showZero
              emptyLabel="No lost-opportunity factors recorded"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ---------- Shell ---------- */

export function ReportContent() {
  const selectId = useId();
  const [line, setLine] = useState<ReportLine>("CDR");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setReport(null);
    void fetchReport({
      serviceLine: line,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setReport(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load report");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [line]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(33,37,41,0.05)] px-5 py-3.5">
        <div>
          <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529]">
            Reports
          </h2>
          <p className="mt-0.5 text-[11px] text-[#adb5bd]">
            Marketing insights · click through to filtered leads
          </p>
        </div>
        <div className="relative">
          <label htmlFor={selectId} className="sr-only">
            Service line
          </label>
          <select
            id={selectId}
            value={line}
            onChange={(e) => setLine(e.target.value as ReportLine)}
            className="h-9 appearance-none rounded-lg border border-[rgba(33,37,41,0.1)] bg-[#f8f9fa] py-0 pr-9 pl-3 text-[13px] font-medium text-[#212529] outline-none transition-colors hover:border-[rgba(33,37,41,0.16)] focus:border-[rgba(232,104,18,0.4)] focus:bg-white focus:ring-2 focus:ring-[rgba(232,104,18,0.12)]"
          >
            {REPORT_LINES.map((option) => (
              <option key={option} value={option}>
                {LINE_META[option].title}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#868e96]"
            aria-hidden
          />
        </div>
      </div>

      <div className="lf-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fafbfc] p-3 sm:p-4">
        <ReportBody
          line={line}
          report={report}
          loading={loading}
          error={error}
        />
      </div>
    </section>
  );
}
