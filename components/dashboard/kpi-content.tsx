"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchKPI,
  fetchTeams,
  fetchUsers,
  updateKpiTargets,
  type KpiItem,
  type PublicUser,
  type TeamBrief,
} from "@/lib/api";
import { buildLeadsHref } from "@/lib/leads-href";
import {
  canEditKpiTargets,
  canViewLeadData,
  isMainTeamLead,
  Role,
} from "@/lib/roles";
import { subscribeRealtime } from "@/lib/realtime";
import { useAuthStore } from "@/store/auth-store";

type ScopeKind = "overall" | "team" | "se" | "la" | "mtl" | "atl";

type DraftFields = {
  targetValue: string;
  benchmarkValue: string;
  teamWeight: string;
  supervisorWeight: string;
};

const SCOPE_OPTIONS: Array<{ id: ScopeKind; label: string }> = [
  { id: "overall", label: "Overall" },
  { id: "team", label: "Teams" },
  { id: "se", label: "SEs" },
  { id: "la", label: "LAs" },
  { id: "mtl", label: "MTLs" },
  { id: "atl", label: "TLs" },
];

function formatCount(value: number | undefined | null) {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

function formatRate(rate: number | undefined | null) {
  if (rate == null) return "—";
  return `${rate.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: rate % 1 === 0 ? 0 : 1,
  })}%`;
}

function formatDurationMinutes(value: number) {
  const wholeMins = Math.max(0, value);
  const h = Math.floor(wholeMins / 60);
  const m = Math.round((wholeMins % 60) * 10) / 10;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatActual(item: KpiItem) {
  if (!item.available) return "—";
  if (item.unit === "minutes" && item.value != null) {
    return formatDurationMinutes(item.value);
  }
  if ((item.unit === "score" || item.id === "quality_score") && item.value != null) {
    return item.value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  if (item.rate != null) return formatRate(item.rate);
  if (item.value != null) {
    return item.value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return "—";
}

function formatTarget(value: number | null | undefined, unit?: string) {
  if (value == null) return "—";
  if (unit === "percent") return formatRate(value);
  if (unit === "minutes") return formatDurationMinutes(value);
  if (unit === "hours") return `${value}h`;
  if (unit === "score") return String(value);
  return value.toLocaleString("en-US");
}

function kpiActualNumber(item: KpiItem): number | null {
  if (!item.available) return null;
  if (typeof item.rate === "number") return item.rate;
  if (typeof item.value === "number") return item.value;
  return null;
}

/** Achievement vs target (100 = on target). Caps at 200 for display safety. */
function achievementPct(item: KpiItem): number | null {
  const actual = kpiActualNumber(item);
  const target = item.targetValue;
  if (actual == null || target == null || !Number.isFinite(actual) || !Number.isFinite(target)) {
    return null;
  }
  if (item.direction === "lower_better") {
    if (actual <= 0) return 100;
    if (target <= 0) return actual <= 0 ? 100 : 0;
    return Math.min(200, Math.round((target / actual) * 1000) / 10);
  }
  if (target <= 0) return actual >= 0 ? 100 : 0;
  return Math.min(200, Math.round((actual / target) * 1000) / 10);
}

function numToDraft(v: number | null | undefined) {
  return v == null ? "" : String(v);
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function InlineNumber({
  editing,
  value,
  display,
  onChange,
  suffix,
  ariaLabel,
}: {
  editing: boolean;
  value: string;
  display: string;
  onChange: (next: string) => void;
  suffix?: string;
  ariaLabel: string;
}) {
  if (!editing) {
    return (
      <span className="tabular-nums text-[#212529]">
        {display}
        {suffix && display !== "—" ? (
          <span className="ml-0.5 text-[#adb5bd]">{suffix}</span>
        ) : null}
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        step="any"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-[4.5rem] rounded-md border border-[rgba(33,37,41,0.12)] bg-white px-2 text-[12px] tabular-nums text-[#212529] outline-none focus:border-[rgba(232,104,18,0.45)]"
      />
      {suffix ? <span className="text-[11px] text-[#adb5bd]">{suffix}</span> : null}
    </div>
  );
}

function StatusCell({ met }: { met: boolean | null | undefined }) {
  if (met == null) {
    return <span className="text-[12px] text-[#adb5bd]">—</span>;
  }
  return (
    <span
      className={[
        "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-[0.04em] uppercase",
        met ? "bg-[#ebfbee] text-[#2b8a3e]" : "bg-[#fff5f5] text-[#c92a2a]",
      ].join(" ")}
    >
      {met ? "Met" : "Miss"}
    </span>
  );
}

/** Visual band for achievement % — green ≥100, amber ≥80, red below. */
function scoreTone(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) {
    return {
      chip: "border-[rgba(33,37,41,0.08)] bg-[#f1f3f5] text-[#868e96]",
      value: "text-[#868e96]",
      label: "text-[#adb5bd]",
    };
  }
  if (score >= 100) {
    return {
      chip: "border-[rgba(47,158,68,0.28)] bg-[#ebfbee] text-[#2b8a3e]",
      value: "text-[#2b8a3e]",
      label: "text-[#40c057]",
    };
  }
  if (score >= 80) {
    return {
      chip: "border-[rgba(232,104,18,0.28)] bg-[#fff4e6] text-[#e8590c]",
      value: "text-[#e8590c]",
      label: "text-[#fd7e14]",
    };
  }
  return {
    chip: "border-[rgba(201,42,42,0.22)] bg-[#fff5f5] text-[#c92a2a]",
    value: "text-[#c92a2a]",
    label: "text-[#fa5252]",
  };
}

function ScorePill({
  score,
  size = "md",
}: {
  score: number | null;
  size?: "sm" | "md";
}) {
  const tone = scoreTone(score);
  if (score == null) {
    return <span className="text-[12px] text-[#adb5bd]">—</span>;
  }
  return (
    <span
      className={[
        "inline-flex items-center justify-end rounded-md border font-semibold tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[12px]" : "min-w-[3.25rem] px-2 py-1 text-[13px]",
        tone.chip,
      ].join(" ")}
    >
      {score}%
    </span>
  );
}

function WeightedScoreChip({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const tone = scoreTone(score);
  return (
    <span
      className={[
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] tabular-nums",
        tone.chip,
      ].join(" ")}
    >
      <span className={["font-semibold", tone.label].join(" ")}>{label}</span>
      <span className={["text-[13px] font-bold", tone.value].join(" ")}>
        {score == null ? "—" : `${score}%`}
      </span>
    </span>
  );
}

export function KpiContent() {
  const role = useAuthStore((s) => s.user?.role);
  const authUser = useAuthStore((s) => s.user);
  const canEdit = canEditKpiTargets(role);
  const teamLocked = isMainTeamLead(role);

  const [scope, setScope] = useState<ScopeKind>("overall");
  const [entityId, setEntityId] = useState("");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [teams, setTeams] = useState<TeamBrief[]>([]);
  const [items, setItems] = useState<KpiItem[]>([]);
  const [notAppropriateCount, setNotAppropriateCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftFields>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewLeadData(role)) return;
    const controller = new AbortController();
    void Promise.all([
      fetchUsers(controller.signal).catch(() => ({ users: [] as PublicUser[] })),
      fetchTeams(controller.signal).catch(() => [] as TeamBrief[]),
    ]).then(([userRes, teamRows]) => {
      if (controller.signal.aborted) return;
      setUsers(userRes.users ?? []);
      setTeams(teamRows ?? []);
    });
    return () => controller.abort();
  }, [role]);

  useEffect(() => {
    setEntityId("");
  }, [scope]);

  const entityOptions = useMemo(() => {
    if (scope === "team") {
      return teams.map((t) => ({ id: t.id, label: t.name }));
    }
    const roleOf =
      scope === "se"
        ? Role.SalesExecutive
        : scope === "la"
          ? Role.LeadAnalyst
          : scope === "mtl"
            ? Role.MainTeamLead
            : scope === "atl"
              ? Role.AnalystTeamLead
              : null;
    if (!roleOf) return [];
    return users
      .filter((u) => u.role === roleOf)
      .map((u) => ({
        id: u.id,
        label: u.teamName ? `${u.name} · ${u.teamName}` : u.name,
        teamId: u.teamId,
      }));
  }, [scope, teams, users]);

  const selectedEntity = useMemo(
    () => entityOptions.find((o) => o.id === entityId) ?? null,
    [entityOptions, entityId],
  );

  const kpiQuery = useMemo(() => {
    const q: {
      teamId?: string;
      analystId?: string;
      salesExecId?: string;
      managerId?: string;
    } = {};
    if (scope === "overall" || !entityId) return q;
    if (scope === "team") q.teamId = entityId;
    if (scope === "se") q.salesExecId = entityId;
    if (scope === "la") q.analystId = entityId;
    if (scope === "mtl") {
      const mtl = users.find((u) => u.id === entityId);
      if (mtl?.teamId) q.teamId = mtl.teamId;
    }
    if (scope === "atl") q.managerId = entityId;
    return q;
  }, [scope, entityId, users]);

  const kpiQueryKey = [
    kpiQuery.teamId ?? "",
    kpiQuery.analystId ?? "",
    kpiQuery.salesExecId ?? "",
    kpiQuery.managerId ?? "",
  ].join("\0");

  const needsEntity = scope !== "overall";
  const mtlMissingTeam =
    scope === "mtl" &&
    Boolean(entityId) &&
    !users.find((u) => u.id === entityId)?.teamId;
  const scopeReady =
    !needsEntity || (Boolean(entityId) && !mtlMissingTeam);

  useEffect(() => {
    if (!canViewLeadData(role)) {
      setLoading(false);
      setItems([]);
      setNotAppropriateCount(0);
      setError(null);
      return;
    }
    if (!scopeReady) {
      setLoading(false);
      setItems([]);
      setNotAppropriateCount(0);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void fetchKPI({ ...kpiQuery, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const next = data.items ?? [];
        setItems(next);
        setNotAppropriateCount(
          typeof data.notAppropriateCount === "number"
            ? data.notAppropriateCount
            : 0,
        );
        setError(null);
        if (!editing) {
          const map: Record<string, DraftFields> = {};
          for (const item of next) {
            map[item.id] = {
              targetValue: numToDraft(item.targetValue),
              benchmarkValue: numToDraft(item.benchmarkValue),
              teamWeight: numToDraft(item.teamWeight),
              supervisorWeight: numToDraft(item.supervisorWeight),
            };
          }
          setDrafts(map);
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load KPI");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editing draft must not refetch mid-edit
  }, [role, scopeReady, kpiQueryKey, reloadKey]);

  useEffect(() => {
    let timer = 0;
    const unsubscribe = subscribeRealtime((evt) => {
      if (!evt.type.startsWith("lead.")) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setReloadKey((k) => k + 1), 400);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const weighted = useMemo(() => {
    let teamNum = 0;
    let teamDen = 0;
    let supNum = 0;
    let supDen = 0;
    for (const item of items) {
      const ach = achievementPct(item);
      if (ach == null) continue;
      const tw = item.teamWeight;
      const sw = item.supervisorWeight;
      if (typeof tw === "number" && tw > 0) {
        teamNum += ach * tw;
        teamDen += tw;
      }
      if (typeof sw === "number" && sw > 0) {
        supNum += ach * sw;
        supDen += sw;
      }
    }
    return {
      team: teamDen > 0 ? Math.round((teamNum / teamDen) * 10) / 10 : null,
      supervisor: supDen > 0 ? Math.round((supNum / supDen) * 10) / 10 : null,
    };
  }, [items]);

  const scopeTitle = useMemo(() => {
    if (scope === "overall") {
      return teamLocked && authUser?.teamName
        ? authUser.teamName
        : "Overall";
    }
    if (!selectedEntity) return "Select…";
    return selectedEntity.label;
  }, [scope, selectedEntity, teamLocked, authUser?.teamName]);

  const notAppropriateHref = useMemo(
    () =>
      buildLeadsHref({
        filter: "not-appropriate",
        ...kpiQuery,
      }),
    [kpiQuery],
  );

  function startEdit() {
    const map: Record<string, DraftFields> = {};
    for (const item of items) {
      map[item.id] = {
        targetValue: numToDraft(item.targetValue),
        benchmarkValue: numToDraft(item.benchmarkValue),
        teamWeight: numToDraft(item.teamWeight),
        supervisorWeight: numToDraft(item.supervisorWeight),
      };
    }
    setDrafts(map);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }

  async function saveEdit() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = items.map((item) => {
        const d = drafts[item.id] ?? {
          targetValue: "",
          benchmarkValue: "",
          teamWeight: "",
          supervisorWeight: "",
        };
        const tw = parseOptionalNumber(d.teamWeight);
        const sw = parseOptionalNumber(d.supervisorWeight);
        if (tw != null && (tw < 0 || tw > 100)) {
          throw new Error(`${item.label}: team weight must be 0–100`);
        }
        if (sw != null && (sw < 0 || sw > 100)) {
          throw new Error(`${item.label}: supervisor weight must be 0–100`);
        }
        return {
          key: item.id,
          targetValue: parseOptionalNumber(d.targetValue),
          benchmarkValue: parseOptionalNumber(d.benchmarkValue),
          teamWeight: tw,
          supervisorWeight: sw,
        };
      });
      await updateKpiTargets(payload);
      setEditing(false);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save targets");
    } finally {
      setSaving(false);
    }
  }

  if (!canViewLeadData(role)) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-[13px] text-[#868e96]">
          KPI metrics are not available for this role.
        </p>
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[rgba(33,37,41,0.05)] px-4 py-3 sm:px-5">
        <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="shrink-0 text-[15px] font-medium tracking-[-0.03em] text-[#212529]">
            KPI
          </h2>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <div className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] p-0.5">
              {SCOPE_OPTIONS.map((option) => {
                const disabled =
                  teamLocked && option.id !== "overall" && option.id !== "se";
                const active = scope === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setScope(option.id)}
                    className={[
                      "lf-pressable h-8 rounded-md px-2.5 text-[12px] font-medium whitespace-nowrap",
                      active
                        ? "bg-white text-[#212529] shadow-[0_1px_2px_rgba(15,17,20,0.06)]"
                        : "text-[#6c757d] hover:text-[#212529]",
                      disabled ? "cursor-not-allowed opacity-35" : "",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <select
              value={needsEntity ? entityId : ""}
              disabled={!needsEntity}
              onChange={(e) => setEntityId(e.target.value)}
              aria-label={scope === "team" ? "Select team" : "Select person"}
              className={[
                "h-9 w-[min(100%,240px)] shrink-0 rounded-lg border px-3 text-[12px] outline-none",
                needsEntity
                  ? "border-[rgba(33,37,41,0.1)] bg-white text-[#212529] focus:border-[rgba(232,104,18,0.45)]"
                  : "cursor-default border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] text-[#adb5bd]",
              ].join(" ")}
            >
              <option value="">
                {!needsEntity
                  ? scopeTitle
                  : scope === "team"
                    ? "Select team…"
                    : "Select person…"}
              </option>
              {needsEntity
                ? entityOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))
                : null}
            </select>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <WeightedScoreChip label="Team" score={weighted.team} />
              <WeightedScoreChip
                label="Supervisor"
                score={weighted.supervisor}
              />
            </div>

            <Link
              href={notAppropriateHref}
              className="lf-pressable inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(201,42,42,0.16)] bg-[#fff5f5] px-2.5 text-[12px] tabular-nums text-[#c92a2a] hover:border-[rgba(201,42,42,0.28)]"
            >
              <span className={"text-[#e03131]"}>
                {formatCount(notAppropriateCount)}
              </span>
              <span className="text-[11px] text-[#c92a2a]">N/A</span>
            </Link>

            {canEdit ? (
              editing ? (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={cancelEdit}
                    className="lf-pressable inline-flex h-9 items-center rounded-lg border border-[rgba(33,37,41,0.1)] bg-white px-3 text-[12px] font-medium text-[#868e96] hover:bg-[#f8f9fa]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveEdit()}
                    className="lf-pressable inline-flex h-9 items-center rounded-lg bg-[#212529] px-3 text-[12px] font-medium text-white hover:bg-[#343a40] disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startEdit}
                  className="lf-pressable inline-flex h-9 items-center rounded-lg border border-[rgba(33,37,41,0.1)] bg-white px-3 text-[12px] font-medium text-[#343a40] hover:bg-[#f8f9fa]"
                >
                  Edit
                </button>
              )
            ) : null}
          </div>
        </div>
        {saveError ? (
          <p className="text-[12px] text-[#c92a2a]">{saveError}</p>
        ) : null}
      </div>

      <div className="lf-scroll min-h-0 flex-1 overflow-auto overscroll-contain">
        {error ? (
          <p className="px-5 py-8 text-[13px] text-[#c92a2a]">{error}</p>
        ) : !scopeReady ? (
          <p className="px-5 py-16 text-center text-[13px] text-[#868e96]">
            {mtlMissingTeam
              ? "Selected MTL is not linked to a team."
              : `Choose a ${scope === "team" ? "team" : "person"} to view scores.`}
          </p>
        ) : (
          <div className="min-h-full w-full">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#f8f9fa]">
                <tr className="border-b border-[rgba(33,37,41,0.06)] text-[10px] font-medium tracking-[0.06em] text-[#adb5bd] uppercase">
                  <th className="px-4 py-2.5 font-medium sm:px-5">KPI</th>
                  <th className="px-3 py-2.5 font-medium">Formula</th>
                  <th className="px-3 py-2.5 text-right font-medium">Actual</th>
                  <th className="px-3 py-2.5 text-right font-medium">Calc</th>
                  <th className="px-3 py-2.5 text-right font-medium">Target</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Benchmark
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">Team wt</th>
                  <th className="px-3 py-2.5 text-right font-medium">Sup wt</th>
                  <th className="px-3 py-2.5 text-right font-medium">Score</th>
                  <th className="px-4 py-2.5 text-right font-medium sm:px-5">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0
                  ? Array.from({ length: 7 }).map((_, i) => (
                      <tr
                        key={i}
                        className="border-b border-[rgba(33,37,41,0.04)]"
                      >
                        <td colSpan={10} className="px-5 py-3.5">
                          <div className="h-5 animate-pulse rounded bg-[#f1f3f5]" />
                        </td>
                      </tr>
                    ))
                  : items.map((item) => {
                      const draft = drafts[item.id] ?? {
                        targetValue: "",
                        benchmarkValue: "",
                        teamWeight: "",
                        supervisorWeight: "",
                      };
                      const ach = achievementPct(item);
                      const calc =
                        item.numerator != null && item.denominator != null
                          ? `${formatCount(item.numerator)} / ${formatCount(item.denominator)}`
                          : item.denominator != null
                            ? `— / ${formatCount(item.denominator)}`
                            : "—";
                      return (
                        <tr
                          key={item.id}
                          className={[
                            "border-b border-[rgba(33,37,41,0.04)] last:border-b-0",
                            item.available ? "bg-white" : "bg-[#fcfcfd]",
                          ].join(" ")}
                        >
                          <td className="px-4 py-3 align-middle sm:px-5">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-[13px] font-medium text-[#212529]">
                                {item.label}
                              </p>
                              <span
                                className={[
                                  "shrink-0 rounded px-1.5 py-px text-[9px] font-medium tracking-[0.04em] uppercase",
                                  item.available
                                    ? "bg-[#ebfbee] text-[#2b8a3e]"
                                    : "bg-[#fff4e6] text-[#9a3f00]",
                                ].join(" ")}
                              >
                                {item.available ? "Live" : "Pending"}
                              </span>
                            </div>
                          </td>
                          <td className="max-w-[240px] px-3 py-3 align-middle">
                            <p
                              className="truncate text-[12px] text-[#868e96]"
                              title={item.formula || undefined}
                            >
                              {item.formula || "—"}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right align-middle text-[13px] font-medium tabular-nums text-[#212529]">
                            {formatActual(item)}
                          </td>
                          <td className="px-3 py-3 text-right align-middle text-[12px] tabular-nums text-[#495057]">
                            {calc}
                          </td>
                          <td className="px-3 py-3 text-right align-middle text-[12px]">
                            <InlineNumber
                              editing={editing}
                              value={draft.targetValue}
                              display={formatTarget(
                                item.targetValue,
                                item.unit,
                              )}
                              onChange={(v) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...draft, targetValue: v },
                                }))
                              }
                              ariaLabel={`${item.label} target`}
                            />
                          </td>
                          <td className="px-3 py-3 text-right align-middle text-[12px]">
                            <InlineNumber
                              editing={editing}
                              value={draft.benchmarkValue}
                              display={formatTarget(
                                item.benchmarkValue,
                                item.unit,
                              )}
                              onChange={(v) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...draft, benchmarkValue: v },
                                }))
                              }
                              ariaLabel={`${item.label} benchmark`}
                            />
                          </td>
                          <td className="px-3 py-3 text-right align-middle text-[12px]">
                            <InlineNumber
                              editing={editing}
                              value={draft.teamWeight}
                              display={
                                item.teamWeight == null
                                  ? "—"
                                  : String(item.teamWeight)
                              }
                              suffix="%"
                              onChange={(v) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: { ...draft, teamWeight: v },
                                }))
                              }
                              ariaLabel={`${item.label} team weight`}
                            />
                          </td>
                          <td className="px-3 py-3 text-right align-middle text-[12px]">
                            <InlineNumber
                              editing={editing}
                              value={draft.supervisorWeight}
                              display={
                                item.supervisorWeight == null
                                  ? "—"
                                  : String(item.supervisorWeight)
                              }
                              suffix="%"
                              onChange={(v) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    supervisorWeight: v,
                                  },
                                }))
                              }
                              ariaLabel={`${item.label} supervisor weight`}
                            />
                          </td>
                          <td className="px-3 py-3 text-right align-middle">
                            <ScorePill score={ach} />
                          </td>
                          <td className="px-4 py-3 text-right align-middle sm:px-5">
                            <StatusCell met={item.metTarget} />
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
