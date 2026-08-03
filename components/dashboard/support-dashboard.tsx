"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  fetchSupportOverview,
  type SupportEvent,
  type SupportOverview,
  type SupportStatusBucket,
} from "@/lib/telemetry-api";

function formatCount(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function formatMinutes(n: number | undefined) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "0m";
  if (n < 60) return `${Math.round(n)}m`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Kathmandu",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusTone(status: string) {
  switch (status) {
    case "ok":
      return {
        label: "Live",
        dot: "bg-[#2f9e44]",
        chip: "bg-[#ebfbee] text-[#2b8a3e]",
      };
    case "degraded":
      return {
        label: "Degraded",
        dot: "bg-[#e67700]",
        chip: "bg-[#fff4e6] text-[#d9480f]",
      };
    default:
      return {
        label: "Offline",
        dot: "bg-[#e03131]",
        chip: "bg-[#fff5f5] text-[#c92a2a]",
      };
  }
}

function kindLabel(kind: string) {
  switch (kind) {
    case "http_status":
      return "HTTP";
    case "connection_break":
      return "Connection";
    case "health_change":
      return "Health";
    case "server_start":
      return "Start";
    case "server_stop":
      return "Stop";
    case "server_panic":
      return "Panic";
    case "client_error":
      return "Client";
    default:
      return kind;
  }
}

const STATUS_COLORS: Record<number, string> = {
  400: "#868e96",
  401: "#748ffc",
  403: "#9775fa",
  404: "#e8590c",
  429: "#f08c00",
  500: "#e03131",
  502: "#c92a2a",
  503: "#a61e4d",
};

function colorForStatus(code: number) {
  return STATUS_COLORS[code] ?? (code >= 500 ? "#e03131" : "#495057");
}

function StatusSeriesChart({ series }: { series: SupportStatusBucket[] }) {
  const gradId = useId().replace(/:/g, "");
  const hours = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    for (const row of series) {
      const key = new Date(row.hour).toISOString();
      if (!map.has(key)) map.set(key, new Map());
      map.get(key)!.set(row.statusCode, row.count);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, counts]) => ({ hour, counts }));
  }, [series]);

  const codes = useMemo(() => {
    const set = new Set<number>();
    for (const row of series) set.add(row.statusCode);
    return [...set].sort((a, b) => a - b);
  }, [series]);

  const width = 720;
  const height = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxY = Math.max(
    1,
    ...hours.map((h) => [...h.counts.values()].reduce((a, b) => a + b, 0)),
  );

  if (hours.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[13px] text-[#868e96]">
        No HTTP errors in the last 24 hours
      </div>
    );
  }

  const barW = Math.max(6, plotW / hours.length - 4);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
      <defs>
        <linearGradient id={`sg-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#212529" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#212529" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => {
        const y = pad.top + plotH * (1 - t);
        return (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke="rgba(33,37,41,0.06)"
            />
            <text
              x={pad.left - 8}
              y={y + 3}
              textAnchor="end"
              className="fill-[#adb5bd]"
              style={{ fontSize: 10 }}
            >
              {Math.round(maxY * t)}
            </text>
          </g>
        );
      })}
      {hours.map((h, i) => {
        const x =
          pad.left + (i + 0.5) * (plotW / hours.length) - barW / 2;
        let y = pad.top + plotH;
        const stack = codes.map((code) => ({
          code,
          count: h.counts.get(code) ?? 0,
        }));
        return (
          <g key={h.hour}>
            {stack.map((seg) => {
              if (seg.count <= 0) return null;
              const segH = (seg.count / maxY) * plotH;
              y -= segH;
              return (
                <rect
                  key={seg.code}
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(segH, 1)}
                  rx={2}
                  fill={colorForStatus(seg.code)}
                  opacity={0.9}
                >
                  <title>{`${new Date(h.hour).toLocaleString("en-US", { timeZone: "Asia/Kathmandu" })} · ${seg.code}: ${seg.count}`}</title>
                </rect>
              );
            })}
            {i % Math.ceil(hours.length / 6) === 0 ? (
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                className="fill-[#adb5bd]"
                style={{ fontSize: 10 }}
              >
                {new Date(h.hour).toLocaleTimeString("en-US", {
                  timeZone: "Asia/Kathmandu",
                  hour: "numeric",
                })}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function ConnectionChart({
  series,
}: {
  series: SupportOverview["connectionSeries24h"];
}) {
  const hours = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of series) {
      if (row.kind !== "connection_break") continue;
      const key = new Date(row.hour).toISOString();
      map.set(key, (map.get(key) ?? 0) + row.count);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count }));
  }, [series]);

  const width = 720;
  const height = 180;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxY = Math.max(1, ...hours.map((h) => h.count));

  if (hours.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-[13px] text-[#868e96]">
        No connection breaks recorded
      </div>
    );
  }

  const points = hours.map((h, i) => {
    const x = pad.left + (i / Math.max(hours.length - 1, 1)) * plotW;
    const y = pad.top + plotH * (1 - h.count / maxY);
    return { x, y, ...h };
  });

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const cx = (prev.x + curr.x) / 2;
    d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  const area = `${d} L ${points[points.length - 1]!.x} ${pad.top + plotH} L ${points[0]!.x} ${pad.top + plotH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full">
      <path d={area} fill="rgba(232,104,18,0.08)" />
      <path d={d} fill="none" stroke="#e86812" strokeWidth={2} />
      {points.map((p) => (
        <circle key={p.hour} cx={p.x} cy={p.y} r={3} fill="#e86812">
          <title>{`${new Date(p.hour).toLocaleString("en-US", { timeZone: "Asia/Kathmandu" })} · ${p.count}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Kpi({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white px-4 py-3.5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(33,37,41,0.12)] to-transparent"
      />
      <p className="text-[11px] font-medium tracking-[0.06em] text-[#868e96] uppercase">
        {label}
      </p>
      <p
        className="mt-2 text-[28px] leading-none font-medium tracking-[-0.04em] tabular-nums text-[#212529]"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-[11px] text-[#adb5bd]">{detail}</p>
      ) : null}
    </div>
  );
}

function EventRow({ event }: { event: SupportEvent }) {
  const sev =
    event.severity === "error"
      ? "text-[#c92a2a] bg-[#fff5f5]"
      : event.severity === "warn"
        ? "text-[#d9480f] bg-[#fff4e6]"
        : "text-[#495057] bg-[#f8f9fa]";
  return (
    <tr className="border-t border-[rgba(33,37,41,0.05)]">
      <td className="whitespace-nowrap px-4 py-2.5 text-[12px] tabular-nums text-[#868e96]">
        {formatTime(event.occurredAt)}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] uppercase ${sev}`}
        >
          {kindLabel(event.kind)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-[12px] tabular-nums text-[#212529]">
        {event.statusCode ?? "—"}
      </td>
      <td className="max-w-[180px] truncate px-4 py-2.5 text-[12px] text-[#495057]">
        {event.path || "—"}
      </td>
      <td className="max-w-[140px] truncate px-4 py-2.5 text-[12px] text-[#868e96]">
        {event.userEmail || event.userId || "—"}
      </td>
      <td className="max-w-[240px] truncate px-4 py-2.5 text-[12px] text-[#495057]">
        {event.message || "—"}
      </td>
    </tr>
  );
}

export function SupportDashboard() {
  const [data, setData] = useState<SupportOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 12_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSupportOverview(controller.signal)
      .then((overview) => {
        if (controller.signal.aborted) return;
        setData(overview);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load support analytics",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [tick]);

  const tone = statusTone(data?.platformStatus ?? "offline");
  const totals = data?.statusTotals24h ?? [];

  return (
    <div className="lf-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pb-4">
      <section className="relative overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-[linear-gradient(135deg,#ffffff_0%,#f8f9fa_55%,#fff7ef_100%)] px-5 py-5 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(232,104,18,0.16),transparent_65%)]"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#9a3f00] uppercase">
              Developer Support
            </p>
            <h2 className="mt-1 text-[22px] font-medium tracking-[-0.04em] text-[#212529] sm:text-[26px]">
              Platform reliability
            </h2>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[#868e96]">
              Live presence, HTTP fault mix, downtime, and connection health —
              so you can diagnose reports without asking the user what broke.
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium ${tone.chip}`}
          >
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            Platform {tone.label}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-[rgba(201,42,42,0.18)] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#c92a2a]">
          {error}
          <span className="mt-1 block text-[12px] text-[#868e96]">
            Ensure the telemetry service is running (see TELEMETRY_URL / TELEMETRY_PORT).
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi
          label="Active users"
          value={loading && !data ? "…" : formatCount(data?.activeUsers)}
          detail="Heartbeat presence"
        />
        <Kpi
          label="Concurrent"
          value={loading && !data ? "…" : formatCount(data?.concurrentUsers)}
          detail="Live sessions"
        />
        <Kpi
          label="Open downtime"
          value={loading && !data ? "…" : formatMinutes(data?.openDowntimeMinutes)}
          detail="Current outage window"
          accent={
            (data?.openDowntimeMinutes ?? 0) > 0 ? "#c92a2a" : undefined
          }
        />
        <Kpi
          label="HTTP errors"
          value={loading && !data ? "…" : formatCount(data?.httpErrors24h)}
          detail="Last 24 hours"
        />
        <Kpi
          label="Connection breaks"
          value={
            loading && !data ? "…" : formatCount(data?.connectionBreaks24h)
          }
          detail="Client ↔ platform"
        />
        <Kpi
          label="CRM restarts"
          value={loading && !data ? "…" : formatCount(data?.serverRestarts24h)}
          detail="Starts in 24h"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[rgba(33,37,41,0.05)] px-5 py-3.5">
            <div>
              <h3 className="text-[14px] font-medium tracking-[-0.02em] text-[#212529]">
                HTTP status faults
              </h3>
              <p className="text-[12px] text-[#868e96]">
                4xx / 5xx volume by hour
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {totals.slice(0, 6).map((t) => (
                <span
                  key={t.statusCode}
                  className="inline-flex items-center gap-1 rounded-md bg-[#f8f9fa] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#495057]"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: colorForStatus(t.statusCode) }}
                  />
                  {t.statusCode}
                  <span className="text-[#adb5bd]">{formatCount(t.count)}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="px-3 py-2 sm:px-4">
            <StatusSeriesChart series={data?.statusSeries24h ?? []} />
          </div>
        </section>

        <section className="rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
          <div className="border-b border-[rgba(33,37,41,0.05)] px-5 py-3.5">
            <h3 className="text-[14px] font-medium tracking-[-0.02em] text-[#212529]">
              Connection breaks
            </h3>
            <p className="text-[12px] text-[#868e96]">
              Network / realtime disconnects
            </p>
          </div>
          <div className="px-3 py-2 sm:px-4">
            <ConnectionChart series={data?.connectionSeries24h ?? []} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
        <section className="rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
          <div className="border-b border-[rgba(33,37,41,0.05)] px-5 py-3.5">
            <h3 className="text-[14px] font-medium tracking-[-0.02em] text-[#212529]">
              Downtime log
            </h3>
            <p className="text-[12px] text-[#868e96]">
              Unreachable / degraded windows
            </p>
          </div>
          <div className="lf-scroll max-h-[280px] overflow-y-auto">
            {(data?.incidents ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-[#868e96]">
                No downtime incidents recorded
              </p>
            ) : (
              <ul className="divide-y divide-[rgba(33,37,41,0.05)]">
                {(data?.incidents ?? []).map((inc) => (
                  <li
                    key={inc.id}
                    className="flex items-start justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#212529]">
                        {inc.reason}
                        {inc.open ? (
                          <span className="ml-2 rounded-md bg-[#fff5f5] px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[#c92a2a] uppercase">
                            Open
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#868e96]">
                        {formatTime(inc.startedAt)}
                        {inc.endedAt ? ` → ${formatTime(inc.endedAt)}` : " → now"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
          <div className="border-b border-[rgba(33,37,41,0.05)] px-5 py-3.5">
            <h3 className="text-[14px] font-medium tracking-[-0.02em] text-[#212529]">
              Incident feed
            </h3>
            <p className="text-[12px] text-[#868e96]">
              Recent platform & client events
            </p>
          </div>
          <div className="lf-scroll max-h-[280px] overflow-auto">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[10px] font-semibold tracking-[0.06em] text-[#adb5bd] uppercase">
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2 font-semibold">Kind</th>
                  <th className="px-4 py-2 font-semibold">Code</th>
                  <th className="px-4 py-2 font-semibold">Path</th>
                  <th className="px-4 py-2 font-semibold">User</th>
                  <th className="px-4 py-2 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentEvents ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-[13px] text-[#868e96]"
                    >
                      Waiting for telemetry events…
                    </td>
                  </tr>
                ) : (
                  (data?.recentEvents ?? []).map((ev) => (
                    <EventRow key={ev.id} event={ev} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
