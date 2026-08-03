"use client";

import {
  ArrowRightLeft,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { CreateUserModal } from "@/components/dashboard/create-user-modal";
import { EditUserModal } from "@/components/dashboard/edit-user-modal";
import { TransferSeModal } from "@/components/dashboard/transfer-se-modal";
import {
  ApiError,
  deleteUserRequest,
  fetchUsers,
  setUserActiveRequest,
  type PublicUser,
} from "@/lib/api";
import {
  canActOnUserRole,
  isAnalystTeamLead,
  isMainTeamLead,
  Role,
  userManagementTabs,
} from "@/lib/roles";
import { useActionPhase } from "@/hooks/use-action-phase";
import { subscribeRealtime } from "@/lib/realtime";
import { formatDate } from "@/lib/datetime";
import { canManageUsers, useAuthStore } from "@/store/auth-store";

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function roleTone(role: string) {
  switch (role) {
    case "SUPERADMIN":
      return "border-[rgba(233,136,18,0.28)] bg-[#fff7ef] text-[#9a3f00]";
    case "ANALYST_TEAM_LEAD":
    case "MAIN_TEAM_LEAD":
      return "border-[rgba(33,37,41,0.1)] bg-[#f1f3f5] text-[#212529]";
    case "LEAD_ANALYST":
      return "border-[rgba(47,158,68,0.22)] bg-[#ebfbee] text-[#2b8a3e]";
    case "SALES_EXECUTIVE":
      return "border-[rgba(33,37,41,0.08)] bg-white text-[#495057]";
    default:
      return "border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] text-[#6c757d]";
  }
}

export function UsersContent() {
  const currentUser = useAuthStore((s) => s.user);
  const canManage = canManageUsers(currentUser);
  const tabs = useMemo(
    () => userManagementTabs(currentUser?.role),
    [currentUser?.role],
  );
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(() => tabs[0]?.id ?? "all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [transferring, setTransferring] = useState<PublicUser | null>(null);
  const [deleting, setDeleting] = useState<PublicUser | null>(null);
  const {
    phase: deletePhase,
    start: startDelete,
    succeed: succeedDelete,
    fail: failDelete,
    reset: resetDelete,
    isBusy: deleteLoading,
  } = useActionPhase();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  /** One-time issued passwords (create/reset) — never read from the database. */
  const [issuedPasswords, setIssuedPasswords] = useState<
    Record<string, string>
  >({});
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<
    Record<string, true>
  >({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const deleteEpochRef = useRef(0);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function toggleUserActive(user: PublicUser) {
    if (togglingActiveId || currentUser?.id === user.id) return;
    const next = !(user.isActive !== false);
    setTogglingActiveId(user.id);
    setActionError(null);
    try {
      const updated = await setUserActiveRequest(user.id, next);
      setUsers((prev) =>
        prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
      );
      setActionNotice(
        next
          ? `${updated.name} is active again`
          : `${updated.name} is inactive and cannot log in`,
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update account status",
      );
    } finally {
      setTogglingActiveId(null);
    }
  }

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((tab) => tab.id === roleFilter)) {
      setRoleFilter(tabs[0].id);
    }
  }, [tabs, roleFilter]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetchUsers(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setUsers(Array.isArray(data.users) ? data.users : []);
        setTotal(data.total ?? 0);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load users");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Realtime: keep the roster in sync when users are created/updated/deleted
  // elsewhere. Coalesced so bursts trigger a single refetch.
  useEffect(() => {
    let timer = 0;
    let pending = false;
    let controller: AbortController | null = null;
    const reload = () => {
      pending = false;
      controller?.abort();
      const next = new AbortController();
      controller = next;
      void fetchUsers(next.signal)
        .then((data) => {
          if (next.signal.aborted) return;
          setUsers(Array.isArray(data.users) ? data.users : []);
          setTotal(data.total ?? 0);
        })
        .catch(() => {
          /* transient; next event or manual action reconciles */
        });
    };
    const unsubscribe = subscribeRealtime((evt) => {
      if (!evt.type.startsWith("user.")) return;
      pending = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!pending) return;
        if (typeof document !== "undefined" && document.hidden) return;
        reload();
      }, 400);
    });
    const onVisible = () => {
      if (pending && !document.hidden) reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      controller?.abort();
      unsubscribe();
    };
  }, []);

  const roles = useMemo(() => {
    const map = new Map<string, { value: string; label: string; count: number }>();
    for (const user of users) {
      const existing = map.get(user.role);
      if (existing) existing.count += 1;
      else {
        map.set(user.role, {
          value: user.role,
          label: user.roleLabel || user.role,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [users]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length };
    for (const role of roles) counts[role.value] = role.count;
    return counts;
  }, [roles, users.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!q) return true;
      const haystack = [
        user.name,
        user.email,
        user.roleLabel,
        user.teamName ?? "",
        user.analystTeamName ?? "",
        user.managerName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, query, roleFilter]);

  const preferredCreateRole =
    roleFilter !== "all" ? roleFilter : undefined;

  const pageSubtitle = isAnalystTeamLead(currentUser?.role)
    ? "Manage Lead Analysts, Main Team Leads, and Sales Executives"
    : isMainTeamLead(currentUser?.role)
      ? currentUser?.teamName
        ? `Create, edit, transfer, and remove sales executives on ${currentUser.teamName}`
        : "Create, edit, transfer, and remove sales executives on your team"
      : canManage
        ? "Create, edit, reset passwords, and remove accounts"
        : null;

  const canTransferSe = (user: PublicUser) =>
    canManage &&
    user.role === Role.SalesExecutive &&
    Boolean(user.teamId) &&
    canActOnUserRole(currentUser?.role, user.role);

  const activeCount = useMemo(
    () => users.filter((user) => user.isActiveSession).length,
    [users],
  );

  function rememberPassword(userId: string, password: string) {
    setIssuedPasswords((prev) => ({ ...prev, [userId]: password }));
    setRevealedPasswordIds((prev) => ({ ...prev, [userId]: true }));
  }

  async function copyPassword(userId: string, password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(userId);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setActionError("Could not copy password to clipboard");
    }
  }

  async function confirmDelete() {
    if (!deleting || deleteLoading) return;
    const target = deleting;
    const epoch = ++deleteEpochRef.current;
    startDelete();
    setActionError(null);
    try {
      await deleteUserRequest(target.id);
      if (epoch !== deleteEpochRef.current) return;
      setUsers((prev) => prev.filter((row) => row.id !== target.id));
      setTotal((prev) => Math.max(0, prev - 1));
      setIssuedPasswords((prev) => {
        if (!prev[target.id]) return prev;
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
      setRevealedPasswordIds((prev) => {
        if (!prev[target.id]) return prev;
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
      await succeedDelete("Deleted");
      if (epoch !== deleteEpochRef.current) return;
      setDeleting(null);
    } catch (err: unknown) {
      if (epoch !== deleteEpochRef.current) return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete user";
      setActionError(message);
      failDelete();
      setDeleting(null);
    }
  }

  return (
    <section className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[rgba(33,37,41,0.05)] px-3.5 py-3 @[40rem]:px-5">
        <div className="flex flex-col gap-3 @[56rem]:flex-row @[56rem]:items-end @[56rem]:justify-between">
          <div className="min-w-0">
            <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529] @[28rem]:text-[17px]">
              Team users
            </h2>
            {pageSubtitle ? (
              <p className="mt-0.5 text-[12px] text-[#868e96]">
                {pageSubtitle}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!loading ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-[#f8f9fa] px-2.5 py-1 text-[11px] tabular-nums text-[#212529]">
                  <span className="text-[#868e96]">Total</span>
                  <span className="font-medium">
                    {formatCount(total || users.length)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(47,158,68,0.22)] bg-[#ebfbee] px-2.5 py-1 text-[11px] tabular-nums text-[#2b8a3e]">
                  <span className="opacity-80">Active</span>
                  <span className="font-medium">{formatCount(activeCount)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-white px-2.5 py-1 text-[11px] tabular-nums text-[#212529]">
                  <span className="text-[#868e96]">Showing</span>
                  <span className="font-medium">
                    {formatCount(filtered.length)}
                  </span>
                </span>
              </>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="lf-pressable inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#212529] px-3 text-[12px] font-medium text-white hover:opacity-90"
              >
                <Plus size={14} strokeWidth={1.5} />
                Create user
              </button>
            ) : null}
          </div>
        </div>

        {tabs.length > 0 ? (
          <div
            role="tablist"
            aria-label="User roles"
            className="flex flex-wrap gap-1 rounded-xl border border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] p-1"
          >
            {tabs.map((tab) => {
              const active = roleFilter === tab.id;
              const count = tabCounts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRoleFilter(tab.id)}
                  className={[
                    "lf-pressable inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-colors",
                    active
                      ? "bg-white text-[#212529] shadow-[0_1px_2px_rgba(33,37,41,0.06)]"
                      : "text-[#6c757d] hover:text-[#212529]",
                  ].join(" ")}
                >
                  {tab.label}
                  <span
                    className={[
                      "tabular-nums text-[10px]",
                      active ? "text-[#868e96]" : "text-[#adb5bd]",
                    ].join(" ")}
                  >
                    {formatCount(count)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#adb5bd]"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, team, manager…"
              className="h-10 w-full rounded-xl border border-[rgba(33,37,41,0.1)] bg-white pr-9 pl-9 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow] placeholder:text-[#adb5bd] focus:border-[rgba(232,104,18,0.45)] focus:shadow-[0_0_0_3px_rgba(232,104,18,0.12)]"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-0.5 text-[#adb5bd] transition-colors hover:bg-[#f8f9fa] hover:text-[#495057]"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        </div>

        {actionNotice ? (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(47,158,68,0.22)] bg-[#ebfbee] px-3 py-2">
            <p className="text-[12px] text-[#2b8a3e]">{actionNotice}</p>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="lf-pressable shrink-0 text-[11px] font-medium text-[#868e96] hover:text-[#495057]"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {actionError ? (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(201,42,42,0.18)] bg-[#fff5f5] px-3 py-2">
            <p className="text-[12px] text-[#c92a2a]">{actionError}</p>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="lf-pressable shrink-0 text-[11px] font-medium text-[#868e96] hover:text-[#495057]"
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
          <p className="text-[13px] text-[#6c757d]">Couldn’t load users: {error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
          <p className="text-[13px] text-[#6c757d]">
            {loading ? "Loading users…" : "No users match this filter."}
          </p>
        </div>
      ) : (
        <div className="lf-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain">
          <table className="w-full min-w-[860px] border-collapse text-left md:min-w-[1100px]">
            <thead className="sticky top-0 z-10 bg-[#f8f9fa]">
              <tr className="border-b border-[rgba(33,37,41,0.05)] text-[10px] font-medium tracking-[0.06em] text-[#adb5bd] uppercase">
                <th className="w-10 px-3.5 py-2.5 font-medium @[28rem]:px-5">#</th>
                <th className="px-2 py-2.5 font-medium">User</th>
                <th className="px-2 py-2.5 font-medium">Role</th>
                <th className="px-2 py-2.5 font-medium">Team</th>
                <th className="px-2 py-2.5 font-medium">Session</th>
                {canManage ? (
                  <th className="px-2 py-2.5 font-medium">Account</th>
                ) : null}
                <th className="px-2 py-2.5 font-medium">Password</th>
                <th className="px-2 py-2.5 text-right font-medium">Joined</th>
                {canManage ? (
                  <th className="px-3.5 py-2.5 text-right font-medium @[28rem]:px-5">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, index) => {
                const issued = issuedPasswords[user.id];
                const revealed = Boolean(revealedPasswordIds[user.id]);
                const isSelf = currentUser?.id === user.id;
                const accountActive = user.isActive !== false;
                const canAct =
                  canManage &&
                  canActOnUserRole(currentUser?.role, user.role);
                const toggling = togglingActiveId === user.id;
                return (
                  <tr
                    key={user.id}
                    className={[
                      "border-b border-[rgba(33,37,41,0.04)] last:border-b-0 hover:bg-[#fafbfc]",
                      accountActive ? "bg-white" : "bg-[#fafafa]",
                    ].join(" ")}
                  >
                    <td className="px-3.5 py-2.5 text-[11px] tabular-nums text-[#adb5bd] @[28rem]:px-5">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] text-[10px] font-medium text-[#495057]">
                          {initials(user.name)}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={[
                              "truncate text-[13px] font-medium",
                              accountActive
                                ? "text-[#212529]"
                                : "text-[#868e96]",
                            ].join(" ")}
                          >
                            {user.name}
                            {isSelf ? (
                              <span className="ml-1.5 text-[10px] font-medium text-[#868e96]">
                                you
                              </span>
                            ) : null}
                            {!accountActive ? (
                              <span className="ml-1.5 text-[10px] font-medium text-[#adb5bd]">
                                inactive
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[12px] text-[#868e96]">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${roleTone(user.role)}`}
                      >
                        {user.roleLabel}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <p className="truncate text-[13px] text-[#212529]">
                        {user.teamName || "—"}
                      </p>
                      {user.analystTeamName ? (
                        <p className="truncate text-[11px] text-[#868e96]">
                          {user.analystTeamName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[12px]">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.isActiveSession ? "bg-[#2f9e44]" : "bg-[#ced4da]"
                          }`}
                        />
                        <span
                          className={
                            user.isActiveSession
                              ? "font-medium text-[#2b8a3e]"
                              : "text-[#868e96]"
                          }
                        >
                          {user.isActiveSession ? "Online" : "Offline"}
                        </span>
                      </span>
                    </td>
                    {canManage ? (
                      <td className="px-2 py-2.5">
                        {canAct ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={accountActive}
                            aria-label={
                              accountActive
                                ? `Deactivate ${user.name}`
                                : `Activate ${user.name}`
                            }
                            disabled={isSelf || toggling}
                            title={
                              isSelf
                                ? "You cannot deactivate your own account"
                                : accountActive
                                  ? "Active — click to set inactive (cannot log in)"
                                  : "Inactive — click to reactivate"
                            }
                            onClick={() => void toggleUserActive(user)}
                            className={[
                              "lf-pressable group inline-flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                              accountActive
                                ? "bg-[#ebfbee] hover:bg-[#d3f9d8]"
                                : "bg-[#f1f3f5] hover:bg-[#e9ecef]",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                                accountActive ? "bg-[#2f9e44]" : "bg-[#ced4da]",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "absolute h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                                  accountActive
                                    ? "translate-x-[18px]"
                                    : "translate-x-0.5",
                                ].join(" ")}
                              />
                            </span>
                            <span
                              className={[
                                "text-[11px] font-medium",
                                accountActive
                                  ? "text-[#2b8a3e]"
                                  : "text-[#868e96]",
                              ].join(" ")}
                            >
                              {toggling
                                ? "…"
                                : accountActive
                                  ? "Active"
                                  : "Inactive"}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#adb5bd]">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-2 py-2.5">
                      {issued ? (
                        <div className="flex min-w-[160px] flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <code className="max-w-[140px] truncate rounded-md border border-[rgba(233,136,18,0.28)] bg-[#fff7ef] px-1.5 py-0.5 font-mono text-[11px] text-[#9a3f00]">
                              {revealed ? issued : "••••••••••••"}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedPasswordIds((prev) => {
                                  const next = { ...prev };
                                  if (next[user.id]) delete next[user.id];
                                  else next[user.id] = true;
                                  return next;
                                })
                              }
                              className="lf-pressable rounded-md p-1 text-[#adb5bd] hover:bg-[#f8f9fa] hover:text-[#495057]"
                              aria-label={
                                revealed ? "Hide password" : "Show password"
                              }
                            >
                              {revealed ? (
                                <EyeOff size={13} strokeWidth={1.75} />
                              ) : (
                                <Eye size={13} strokeWidth={1.75} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyPassword(user.id, issued)}
                              className="lf-pressable rounded-md p-1 text-[#adb5bd] hover:bg-[#f8f9fa] hover:text-[#495057]"
                              aria-label="Copy password"
                            >
                              <Copy size={13} strokeWidth={1.75} />
                            </button>
                          </div>
                          <span className="text-[10px] text-[#868e96]">
                            {copiedId === user.id
                              ? "Copied"
                              : "Issued once — copy now"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.hasPassword ? (
                            <span className="rounded-md border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] px-1.5 py-0.5 text-[10px] font-medium text-[#495057]">
                              Set
                            </span>
                          ) : (
                            <span className="rounded-md border border-[rgba(233,136,18,0.28)] bg-[#fff7ef] px-1.5 py-0.5 text-[10px] font-medium text-[#9a3f00]">
                              Not set
                            </span>
                          )}
                          {user.mustResetPassword ? (
                            <span className="rounded-md border border-[rgba(233,136,18,0.28)] bg-[#fff7ef] px-1.5 py-0.5 text-[10px] font-medium text-[#9a3f00]">
                              Reset required
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right text-[12px] tabular-nums text-[#868e96]">
                      {formatDate(user.createdAt)}
                    </td>
                    {canManage ? (
                      <td className="px-3.5 py-2.5 @[28rem]:px-5">
                        {canAct ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActionError(null);
                                setEditing(user);
                              }}
                              className="lf-pressable inline-flex h-8 items-center gap-1 rounded-lg border border-[rgba(33,37,41,0.08)] bg-white px-2.5 text-[11px] font-medium text-[#495057] hover:bg-[#f8f9fa]"
                            >
                              <Pencil size={12} strokeWidth={1.75} />
                              Edit
                            </button>
                            {canTransferSe(user) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setTransferring(user);
                                }}
                                className="lf-pressable inline-flex h-8 items-center gap-1 rounded-lg border border-[rgba(33,37,41,0.08)] bg-white px-2.5 text-[11px] font-medium text-[#495057] hover:bg-[#f8f9fa]"
                              >
                                <ArrowRightLeft size={12} strokeWidth={1.75} />
                                Transfer
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? "You cannot delete your own account"
                                  : "Delete user"
                              }
                              onClick={() => {
                                setActionError(null);
                                setDeleting(user);
                              }}
                              className="lf-pressable inline-flex h-8 items-center gap-1 rounded-lg border border-[rgba(201,42,42,0.16)] bg-white px-2.5 text-[11px] font-medium text-[#c92a2a] hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 size={12} strokeWidth={1.75} />
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="block text-right text-[11px] text-[#adb5bd]">
                            —
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal
        open={createOpen}
        preferredRole={preferredCreateRole}
        onClose={() => setCreateOpen(false)}
        onCreated={(user, temporaryPassword) => {
          setQuery("");
          setRoleFilter(
            tabs.some((tab) => tab.id === user.role) ? user.role : tabs[0]?.id ?? "all",
          );
          setUsers((prev) => {
            const next = prev.filter((row) => row.id !== user.id);
            next.unshift(user);
            return next;
          });
          setTotal((prev) => prev + 1);
          rememberPassword(user.id, temporaryPassword);
        }}
      />

      <EditUserModal
        open={Boolean(editing)}
        user={editing}
        onClose={() => setEditing(null)}
        onUpdated={(user, temporaryPassword) => {
          setUsers((prev) =>
            prev.map((row) => (row.id === user.id ? user : row)),
          );
          if (temporaryPassword) {
            rememberPassword(user.id, temporaryPassword);
          }
          if (currentUser?.id === user.id) {
            useAuthStore.getState().setUser(user);
          }
        }}
      />

      <TransferSeModal
        open={Boolean(transferring)}
        user={transferring}
        onClose={() => setTransferring(null)}
        onTransferred={(user, leadsMoved, toTeamName) => {
          if (isMainTeamLead(currentUser?.role)) {
            setUsers((prev) => prev.filter((row) => row.id !== user.id));
            setTotal((prev) => Math.max(0, prev - 1));
          } else {
            setUsers((prev) =>
              prev.map((row) => (row.id === user.id ? user : row)),
            );
          }
          setActionError(null);
          setActionNotice(
            `${user.name} moved to ${toTeamName}` +
              (leadsMoved > 0
                ? ` · ${leadsMoved.toLocaleString("en-US")} lead${leadsMoved === 1 ? "" : "s"} updated`
                : ""),
          );
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete user?"
        description={
          deleting ? (
            <>
              <span className="font-bold text-[#c2410c]">{deleting.name}</span>
              {` (${deleting.email}) will be removed. Their leads stay in the CRM and are reassigned to you. This cannot be undone.`}
            </>
          ) : null
        }
        confirmLabel="Delete user"
        pendingLabel="Deleting…"
        successLabel="Deleted"
        tone="danger"
        phase={deletePhase}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleting(null);
            resetDelete();
          }
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </section>
  );
}
