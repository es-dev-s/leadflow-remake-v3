"use client";

import {
  assignLeads,
  fetchAssignableUsers,
  type AssignableUser,
  type AssignLeadsResult,
} from "@/lib/api";
import { useActionPhase } from "@/hooks/use-action-phase";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type TeamGroup = {
  key: string;
  teamId: string | null;
  teamName: string;
  leads: AssignableUser[];
  members: AssignableUser[];
};

type PanelPos = {
  left: number;
  bottom: number;
  width: number;
  height: number;
};

type Props = {
  open: boolean;
  /** Dock shell — popup centers symmetrically above this. */
  dockEl: HTMLElement | null;
  /** Assign button — ignored for outside-click close / toggle. */
  triggerEl?: HTMLElement | null;
  leadIds: string[];
  /** When true, hide team-lead assignees (still browse by team → members). */
  membersOnly?: boolean;
  onClose: () => void;
  onAssigned: (result: AssignLeadsResult) => void;
};

const VIEW_PAD = 14;
const GAP = 12;
const PREFERRED_HEIGHT = 520;
const MIN_HEIGHT = 380;
const MIN_WIDTH = 320;
const MAX_WIDTH = 420;

function teamKey(user: AssignableUser) {
  return user.teamId?.trim() || `__none__:${user.teamName?.trim() || "none"}`;
}

function buildTeamGroups(
  leads: AssignableUser[],
  members: AssignableUser[],
): TeamGroup[] {
  const map = new Map<string, TeamGroup>();

  function ensure(user: AssignableUser): TeamGroup {
    const key = teamKey(user);
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        teamId: user.teamId,
        teamName: user.teamName?.trim() || "No team",
        leads: [],
        members: [],
      };
      map.set(key, group);
    }
    return group;
  }

  for (const lead of leads) ensure(lead).leads.push(lead);
  for (const member of members) ensure(member).members.push(member);

  return [...map.values()].sort((a, b) => {
    if (a.teamName === "No team" && b.teamName !== "No team") return 1;
    if (b.teamName === "No team" && a.teamName !== "No team") return -1;
    return a.teamName.localeCompare(b.teamName);
  });
}

function computePanelPos(dock: HTMLElement): PanelPos {
  const rect = dock.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Match dock width when possible so the stack feels symmetrical.
  const width = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, Math.min(rect.width + 24, vw - VIEW_PAD * 2)),
  );

  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.min(Math.max(VIEW_PAD, left), vw - VIEW_PAD - width);

  const spaceAbove = Math.max(0, rect.top - VIEW_PAD - GAP);
  const height = Math.max(
    MIN_HEIGHT,
    Math.min(PREFERRED_HEIGHT, spaceAbove, Math.floor(vh * 0.72)),
  );
  const bottom = Math.max(VIEW_PAD, vh - rect.top + GAP);

  return { left, bottom, width, height };
}

export function AssignLeadsPopover({
  open,
  dockEl,
  triggerEl = null,
  leadIds,
  membersOnly = false,
  onClose,
  onAssigned,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const [activeTeamKey, setActiveTeamKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<AssignableUser[]>([]);
  const [members, setMembers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const {
    phase: assignPhase,
    start: startAssign,
    succeed: succeedAssign,
    fail: failAssign,
    reset: resetAssign,
    isBusy: submitting,
  } = useActionPhase(900);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);

  openRef.current = open;

  const updatePos = useCallback(() => {
    if (!dockEl) return;
    setPos(computePanelPos(dockEl));
  }, [dockEl]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setPos(null);
      return;
    }
    setActiveTeamKey(null);
    setQuery("");
    setLeads([]);
    setMembers([]);
    setError(null);
    resetAssign();
    setAssigningId(null);
    setEntered(false);
    const id = window.requestAnimationFrame(() => {
      updatePos();
      window.requestAnimationFrame(() => setEntered(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, membersOnly, resetAssign, updatePos]);

  useLayoutEffect(() => {
    if (!open || !dockEl) return;
    updatePos();
  }, [open, dockEl, activeTeamKey, loading, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePos();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void Promise.all([
      membersOnly
        ? Promise.resolve([] as AssignableUser[])
        : fetchAssignableUsers("team-leads", controller.signal),
      fetchAssignableUsers("members", controller.signal),
    ])
      .then(([leadRows, memberRows]) => {
        if (controller.signal.aborted) return;
        setLeads(leadRows);
        setMembers(memberRows);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load people",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, membersOnly]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeTeamKey) {
        setActiveTeamKey(null);
        setQuery("");
        setError(null);
        return;
      }
      onClose();
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerEl?.contains(target)) return;
      if (dockEl?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, activeTeamKey, triggerEl, dockEl]);

  const teams = useMemo(
    () => buildTeamGroups(leads, members),
    [leads, members],
  );

  useEffect(() => {
    if (!open || loading || activeTeamKey) return;
    if (teams.length === 1) setActiveTeamKey(teams[0].key);
  }, [open, loading, teams, activeTeamKey]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((team) => {
      const hay = [
        team.teamName,
        ...team.leads.map((u) => `${u.name} ${u.email} ${u.roleLabel}`),
        ...team.members.map((u) => `${u.name} ${u.email}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [teams, query]);

  const activeTeam = useMemo(
    () => teams.find((t) => t.key === activeTeamKey) ?? null,
    [teams, activeTeamKey],
  );

  const filteredDetailPeople = useMemo(() => {
    if (!activeTeam) {
      return { leads: [] as AssignableUser[], members: [] as AssignableUser[] };
    }
    const q = query.trim().toLowerCase();
    const match = (user: AssignableUser) =>
      !q ||
      [user.name, user.email, user.roleLabel]
        .join(" ")
        .toLowerCase()
        .includes(q);
    return {
      leads: membersOnly ? [] : activeTeam.leads.filter(match),
      members: activeTeam.members.filter(match),
    };
  }, [activeTeam, query, membersOnly]);

  if (!mounted || !open || !dockEl || !pos) return null;

  const inTeam = Boolean(activeTeam);
  const showTeamBack = inTeam && teams.length > 1;

  async function handleAssign(
    user: AssignableUser,
    kind: "team-lead" | "member",
  ) {
    if (submitting || leadIds.length === 0) return;
    startAssign();
    setAssigningId(user.id);
    setError(null);
    try {
      const result = await assignLeads({
        leadIds,
        assigneeId: user.id,
        kind,
      });
      if (!openRef.current) return;
      onAssigned(result);
      await succeedAssign("Assigned");
      if (!openRef.current) return;
      onClose();
    } catch (err: unknown) {
      if (!openRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to assign");
      failAssign();
      setAssigningId(null);
    }
  }

  function openTeam(key: string) {
    setQuery("");
    setError(null);
    setActiveTeamKey(key);
  }

  function backToTeams() {
    setQuery("");
    setError(null);
    setActiveTeamKey(null);
  }

  const detailEmpty =
    filteredDetailPeople.leads.length === 0 &&
    filteredDetailPeople.members.length === 0;

  const leadCountLabel =
    leadIds.length === 1 ? "1 lead" : `${leadIds.length} leads`;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Assign leads"
      data-assign-popover="true"
      style={{
        position: "fixed",
        left: pos.left,
        bottom: pos.bottom,
        width: pos.width,
        height: pos.height,
        zIndex: 70,
      }}
      className={[
        "flex flex-col overflow-hidden rounded-[22px] border border-white/60 bg-[rgba(255,255,255,0.92)] shadow-[0_24px_64px_rgba(15,17,20,0.18),0_2px_0_rgba(255,255,255,0.65)_inset] backdrop-blur-2xl transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        entered
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-2 scale-[0.98] opacity-0",
      ].join(" ")}
    >
      <div className="flex shrink-0 items-start gap-1 px-3 pt-3.5 pb-2">
        {showTeamBack ? (
          <button
            type="button"
            onClick={backToTeams}
            className="lf-pressable mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(33,37,41,0.05)] text-[#495057] hover:bg-[rgba(33,37,41,0.09)]"
            aria-label="Back to teams"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 px-1 pt-0.5">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[#1a1d21]">
            {inTeam ? activeTeam?.teamName : "Assign to"}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[#868e96]">
            {inTeam
              ? [
                  !membersOnly && activeTeam?.leads.length
                    ? `${activeTeam.leads.length} lead${activeTeam.leads.length === 1 ? "" : "s"}`
                    : null,
                  activeTeam
                    ? `${activeTeam.members.length} member${activeTeam.members.length === 1 ? "" : "s"}`
                    : null,
                  leadCountLabel,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : `Choose a team for ${leadCountLabel}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="lf-pressable mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(33,37,41,0.05)] text-[#868e96] hover:bg-[rgba(33,37,41,0.09)] hover:text-[#495057]"
          aria-label="Close"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>

      <div className="shrink-0 px-3 pb-2.5">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#adb5bd]"
          />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={inTeam ? "Search people" : "Search teams"}
            className="h-10 w-full rounded-[12px] border-0 bg-[rgba(33,37,41,0.05)] pr-3 pl-9 text-[13px] text-[#1a1d21] outline-none placeholder:text-[#adb5bd] focus:bg-[rgba(33,37,41,0.07)] focus:ring-2 focus:ring-[rgba(232,104,18,0.18)]"
          />
        </div>
      </div>

      <div className="lf-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {loading ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-[13px] text-[#adb5bd]">
            <LoaderCircle size={18} className="animate-spin text-[#ced4da]" />
            Loading
          </div>
        ) : !inTeam ? (
          filteredTeams.length === 0 ? (
            <div className="flex h-full min-h-[220px] items-center justify-center px-3 text-center text-[13px] text-[#adb5bd]">
              {error ? error : "No teams found"}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filteredTeams.map((team) => {
                const leadNames = team.leads
                  .map((l) => l.name)
                  .slice(0, 2)
                  .join(", ");
                const moreLeads =
                  team.leads.length > 2 ? ` +${team.leads.length - 2}` : "";
                const meta = [
                  leadNames
                    ? `${leadNames}${moreLeads}`
                    : membersOnly
                      ? null
                      : "No team lead",
                  `${team.members.length} member${team.members.length === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <button
                    key={team.key}
                    type="button"
                    onClick={() => openTeam(team.key)}
                    className="lf-pressable group flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-[rgba(33,37,41,0.045)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(232,104,18,0.1)] text-[12px] font-semibold text-[#9a3f00]">
                      {team.teamName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-[#1a1d21]">
                        {team.teamName}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-[#868e96]">
                        {meta}
                      </span>
                    </span>
                    <ChevronRight
                      size={15}
                      strokeWidth={1.75}
                      className="shrink-0 text-[#ced4da] transition-transform group-hover:translate-x-0.5 group-hover:text-[#adb5bd]"
                    />
                  </button>
                );
              })}
            </div>
          )
        ) : detailEmpty ? (
          <div className="flex h-full min-h-[220px] items-center justify-center px-3 text-center text-[13px] text-[#adb5bd]">
            {error ? error : "No matches"}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredDetailPeople.leads.length > 0 ? (
              <>
                <p className="px-3 pt-1.5 pb-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#adb5bd] uppercase">
                  Team leads
                </p>
                {filteredDetailPeople.leads.map((user) => (
                  <PersonRow
                    key={user.id}
                    user={user}
                    subtitle={user.roleLabel}
                    assigningId={assigningId}
                    assignPhase={assignPhase}
                    submitting={submitting}
                    onAssign={() => void handleAssign(user, "team-lead")}
                  />
                ))}
              </>
            ) : null}
            {filteredDetailPeople.members.length > 0 ? (
              <>
                <p
                  className={[
                    "px-3 pb-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#adb5bd] uppercase",
                    filteredDetailPeople.leads.length > 0
                      ? "mt-2 pt-2"
                      : "pt-1.5",
                  ].join(" ")}
                >
                  Members
                </p>
                {filteredDetailPeople.members.map((user) => (
                  <PersonRow
                    key={user.id}
                    user={user}
                    subtitle="Sales executive"
                    assigningId={assigningId}
                    assignPhase={assignPhase}
                    submitting={submitting}
                    onAssign={() => void handleAssign(user, "member")}
                  />
                ))}
              </>
            ) : null}
          </div>
        )}
      </div>

      {error && !loading ? (
        <p className="shrink-0 border-t border-[rgba(33,37,41,0.06)] px-4 py-2.5 text-[12px] text-[#c92a2a]">
          {error}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}

function PersonRow({
  user,
  subtitle,
  assigningId,
  assignPhase,
  submitting,
  onAssign,
}: {
  user: AssignableUser;
  subtitle: string;
  assigningId: string | null;
  assignPhase: string;
  submitting: boolean;
  onAssign: () => void;
}) {
  const rowBusy = assigningId === user.id;
  const rowSuccess = rowBusy && assignPhase === "success";
  const rowPending = rowBusy && assignPhase === "pending";
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <button
      type="button"
      disabled={submitting}
      onClick={onAssign}
      className={[
        "lf-pressable flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors disabled:opacity-50",
        rowSuccess
          ? "bg-[#ebfbee]"
          : "hover:bg-[rgba(33,37,41,0.045)]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          rowSuccess
            ? "bg-[#d3f9d8] text-[#2b8a3e]"
            : "bg-[rgba(33,37,41,0.06)] text-[#495057]",
        ].join(" ")}
      >
        {rowSuccess ? <Check size={14} strokeWidth={2.25} /> : initials || "?"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-[#1a1d21]">
          {user.name}
        </span>
        {!rowPending ? (
          <span className="mt-0.5 block truncate text-[12px] text-[#868e96]">
            {rowSuccess ? "Assigned" : subtitle}
          </span>
        ) : (
          <span className="mt-0.5 block truncate text-[12px] text-[#adb5bd]">
            Assigning…
          </span>
        )}
      </span>
      {rowPending ? (
        <LoaderCircle
          size={15}
          className="shrink-0 animate-spin text-[#adb5bd]"
        />
      ) : null}
    </button>
  );
}
