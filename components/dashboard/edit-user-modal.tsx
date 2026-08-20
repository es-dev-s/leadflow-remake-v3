"use client";

import { ActionButton } from "@/components/dashboard/action-button";
import {
  ApiError,
  fetchRoles,
  fetchTeams,
  updateUserRequest,
  type PublicUser,
  type RoleOption,
  type TeamBrief,
} from "@/lib/api";
import { generateTemporaryPassword } from "@/lib/generate-password";
import {
  actorAssignsSalesTeam,
  creatableRoleOptions,
  isLeadAnalyst,
  isMainTeamLead,
  roleDisplayLabel,
  roleNeedsSalesTeam,
  Role,
} from "@/lib/roles";
import { useActionPhase } from "@/hooks/use-action-phase";
import { useAuthStore } from "@/store/auth-store";
import { Eye, EyeOff, RefreshCw, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  user: PublicUser | null;
  onClose: () => void;
  onUpdated: (user: PublicUser, temporaryPassword?: string) => void;
};

const inputClass =
  "h-11 w-full rounded-xl border border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] px-3.5 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow] placeholder:text-[#adb5bd] focus:border-[rgba(232,104,18,0.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(232,104,18,0.1)]";

export function EditUserModal({ open, user, onClose, onUpdated }: Props) {
  const actor = useAuthStore((s) => s.user);
  const actorRole = actor?.role;
  const actorRoleLabel = roleDisplayLabel(actor?.role, actor?.roleLabel);
  const [mounted, setMounted] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>(() =>
    creatableRoleOptions(actorRole),
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("LEAD_ANALYST");
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teams, setTeams] = useState<TeamBrief[]>([]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const {
    phase: submitPhase,
    start: startSubmit,
    succeed: succeedSubmit,
    fail: failSubmit,
    reset: resetSubmit,
    isBusy: submitting,
  } = useActionPhase();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const openRef = useRef(open);
  const userIdRef = useRef<string | null>(null);
  openRef.current = open;
  userIdRef.current = user?.id ?? null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !user) return;
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setTeamName(user.analystTeamName?.trim() || user.teamName?.trim() || "");
    setTeamId(user.teamId?.trim() || "");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setFieldErrors({});
    resetSubmit();
    const scoped = creatableRoleOptions(actorRole);
    // Keep current role visible even if somehow outside scope (read-only edge).
    const withCurrent =
      scoped.some((r) => r.value === user.role) || !user.roleLabel
        ? scoped
        : [
            ...scoped,
            { value: user.role, label: user.roleLabel || user.role },
          ];
    setRoles(withCurrent);
    const controller = new AbortController();
    void fetchRoles(controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        if (!rows.length) return;
        const merged =
          rows.some((r) => r.value === user.role)
            ? rows
            : [
                ...rows,
                { value: user.role, label: user.roleLabel || user.role },
              ];
        setRoles(merged);
      })
      .catch(() => {
        /* keep scoped defaults */
      });
    void fetchTeams(controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setTeams(rows);
      })
      .catch(() => {
        /* picker stays empty; submit validation covers this */
      });
    return () => controller.abort();
  }, [open, user, actorRole]);

  if (!mounted || !open || !user) return null;

  const showAnalystTeam =
    role === Role.AnalystTeamLead || isLeadAnalyst(role);
  const showSalesTeam =
    actorAssignsSalesTeam(actorRole) && roleNeedsSalesTeam(role);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !user) return;
    const targetId = user.id;
    startSubmit();
    setError(null);
    setFieldErrors({});
    try {
      const payload: Parameters<typeof updateUserRequest>[1] = {
        name: name.trim(),
        email: email.trim(),
        role,
        password: password.trim() ? password : null,
      };
      if (showAnalystTeam) {
        payload.teamName = teamName.trim();
      }
      if (showSalesTeam) {
        payload.teamId = teamId.trim();
      }
      const result = await updateUserRequest(targetId, payload);
      if (!openRef.current || userIdRef.current !== targetId) return;
      onUpdated(result.user, result.temporaryPassword);
      await succeedSubmit("Saved");
      if (!openRef.current || userIdRef.current !== targetId) return;
      onClose();
    } catch (err: unknown) {
      if (!openRef.current || userIdRef.current !== targetId) return;
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError(err instanceof Error ? err.message : "Failed to update user");
      }
      failSubmit();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-[rgba(15,17,20,0.32)]"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <div className="relative max-h-[min(92dvh,720px)] w-full max-w-[480px] overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.08)] bg-white shadow-[0_28px_80px_rgba(15,17,20,0.2)]">
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(33,37,41,0.06)] px-5 py-4">
          <div>
            <p className="text-[10px] font-medium tracking-[0.12em] text-[#9a3f00] uppercase">
              {actorRoleLabel}
            </p>
            <h2 className="mt-1 text-[16px] font-medium tracking-[-0.02em] text-[#212529]">
              Edit user
            </h2>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="lf-pressable flex h-8 w-8 items-center justify-center rounded-lg text-[#ced4da] hover:bg-[#f8f9fa] hover:text-[#6c757d]"
            aria-label="Close"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="lf-scroll max-h-[calc(min(92dvh,720px)-72px)] space-y-3.5 overflow-y-auto px-5 py-4"
        >
          <div>
            <label className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
              Full name
            </label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
            {fieldErrors.name ? (
              <p className="mt-1 text-[11px] text-[#c92a2a]">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
              Email
            </label>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {fieldErrors.email ? (
              <p className="mt-1 text-[11px] text-[#c92a2a]">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
                Password
              </label>
              <span className="text-[11px] text-[#adb5bd]">
                {user.hasPassword ? "Currently set" : "Not set"}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${inputClass} pr-10`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  disabled={submitting || !password}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-[#adb5bd] hover:text-[#495057] disabled:opacity-40"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={14} strokeWidth={1.75} />
                  ) : (
                    <Eye size={14} strokeWidth={1.75} />
                  )}
                </button>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  const next = generateTemporaryPassword();
                  setPassword(next);
                  setShowPassword(true);
                }}
                className="lf-pressable inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[rgba(33,37,41,0.1)] bg-white px-3 text-[12px] font-medium text-[#495057] hover:bg-[#f8f9fa]"
                title="Generate password"
              >
                <RefreshCw size={13} strokeWidth={1.75} />
                Generate
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#868e96]">
              Stored passwords are hashed and cannot be retrieved. Set a new one
              here to issue credentials you can copy once.
            </p>
            {fieldErrors.password ? (
              <p className="mt-1 text-[11px] text-[#c92a2a]">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <div>
            <p
              id="edit-user-role-label"
              className="mb-2 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase"
            >
              Role
            </p>
            <div
              role="radiogroup"
              aria-labelledby="edit-user-role-label"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {(roles.length ? roles : creatableRoleOptions(actorRole)).map((option) => {
                const selected = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={submitting}
                    onClick={() => setRole(option.value)}
                    className={[
                      "lf-pressable min-h-[42px] rounded-xl border px-3 py-2.5 text-left text-[12.5px] leading-snug font-medium transition-[border-color,background-color,color,box-shadow]",
                      selected
                        ? "border-[rgba(232,104,18,0.45)] bg-[#fff7ef] text-[#9a3f00] shadow-[inset_0_0_0_1px_rgba(232,104,18,0.12)]"
                        : "border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] text-[#495057] hover:border-[rgba(33,37,41,0.16)] hover:bg-white hover:text-[#212529]",
                      submitting ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {fieldErrors.role ? (
              <p className="mt-1 text-[11px] text-[#c92a2a]">{fieldErrors.role}</p>
            ) : null}
          </div>

          {showAnalystTeam ? (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
                Team name
              </label>
              <input
                className={inputClass}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required={role === Role.AnalystTeamLead}
                minLength={2}
                maxLength={120}
                disabled={submitting}
                placeholder={
                  role === Role.AnalystTeamLead
                    ? "e.g. Qualification Pod A"
                    : "Optional analyst team"
                }
                autoComplete="organization"
              />
              {fieldErrors.teamName ? (
                <p className="mt-1 text-[11px] text-[#c92a2a]">
                  {fieldErrors.teamName}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-[#adb5bd]">
                  {role === Role.AnalystTeamLead
                    ? "This Analyst Team Lead is the lead of this team"
                    : "Assign this Lead Analyst to an analyst team"}
                </p>
              )}
            </div>
          ) : null}

          {showSalesTeam ? (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
                Team
              </label>
              <select
                className={inputClass}
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="">Select a team</option>
                {user.teamId &&
                !teams.some((team) => team.id === user.teamId) ? (
                  <option value={user.teamId}>
                    {user.teamName || "Current team"}
                  </option>
                ) : null}
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {fieldErrors.teamId ? (
                <p className="mt-1 text-[11px] text-[#c92a2a]">
                  {fieldErrors.teamId}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-[#adb5bd]">
                  Assign or reassign this sales executive. Changing team also
                  moves their assigned leads.
                </p>
              )}
            </div>
          ) : isMainTeamLead(actorRole) && roleNeedsSalesTeam(role) ? (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
                Team
              </label>
              <p className="rounded-xl border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] px-3.5 py-2.5 text-[13px] text-[#495057]">
                {user.teamName || "Your team"}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-[rgba(201,42,42,0.18)] bg-[#fff5f5] px-3 py-2 text-[12px] text-[#c92a2a]">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1 pb-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="lf-pressable h-10 rounded-xl px-4 text-[13px] font-medium text-[#495057] hover:bg-[#f8f9fa]"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              phase={submitPhase}
              idleLabel="Save changes"
              pendingLabel="Saving…"
              successLabel="Saved"
              className="h-10 rounded-xl px-4 text-[13px]"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
