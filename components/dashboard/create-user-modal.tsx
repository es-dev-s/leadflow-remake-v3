"use client";

import { ActionButton } from "@/components/dashboard/action-button";
import {
  ApiError,
  createUserRequest,
  fetchRoles,
  type PublicUser,
  type RoleOption,
} from "@/lib/api";
import { generateTemporaryPassword } from "@/lib/generate-password";
import {
  creatableRoleOptions,
  defaultCreateRole,
  roleDisplayLabel,
  Role,
} from "@/lib/roles";
import { useActionPhase } from "@/hooks/use-action-phase";
import { useAuthStore } from "@/store/auth-store";
import { Eye, EyeOff, RefreshCw, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (user: PublicUser, temporaryPassword: string) => void;
  /** Prefill role when opening from a tab. */
  preferredRole?: string;
};

const inputClass =
  "h-11 w-full rounded-xl border border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] px-3.5 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow] placeholder:text-[#adb5bd] focus:border-[rgba(232,104,18,0.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(232,104,18,0.1)]";

export function CreateUserModal({
  open,
  onClose,
  onCreated,
  preferredRole,
}: Props) {
  const actor = useAuthStore((s) => s.user);
  const actorRole = actor?.role;
  const actorRoleLabel = roleDisplayLabel(actor?.role, actor?.roleLabel);
  const fallbackRoles = creatableRoleOptions(actorRole);
  const [mounted, setMounted] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>(fallbackRoles);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(defaultCreateRole(actorRole));
  const [teamName, setTeamName] = useState("");
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
  openRef.current = open;

  const needsTeam = role === Role.MainTeamLead;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const initialRole =
      preferredRole &&
      creatableRoleOptions(actorRole).some((r) => r.value === preferredRole)
        ? preferredRole
        : defaultCreateRole(actorRole);
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRole(initialRole);
    setTeamName("");
    setError(null);
    setFieldErrors({});
    resetSubmit();
    setRoles(creatableRoleOptions(actorRole));
    const controller = new AbortController();
    void fetchRoles(controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        if (rows.length) {
          setRoles(rows);
          if (!rows.some((r) => r.value === initialRole)) {
            setRole(rows[0].value);
          }
        }
      })
      .catch(() => {
        /* keep scoped defaults */
      });
    return () => controller.abort();
  }, [open, actorRole, preferredRole]);

  if (!mounted || !open) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    startSubmit();
    setError(null);
    setFieldErrors({});
    try {
      const result = await createUserRequest({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        teamName: needsTeam ? teamName.trim() : undefined,
      });
      if (!openRef.current) return;
      onCreated(
        result.user,
        result.temporaryPassword || password,
      );
      await succeedSubmit("Created");
      if (!openRef.current) return;
      onClose();
    } catch (err: unknown) {
      if (!openRef.current) return;
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError(err instanceof Error ? err.message : "Failed to create user");
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
              Create user
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
              placeholder="Jane Doe"
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
              placeholder="jane@company.com"
            />
            {fieldErrors.email ? (
              <p className="mt-1 text-[11px] text-[#c92a2a]">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
              Password
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${inputClass} pr-10`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min 8 chars, letter + number"
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
            {fieldErrors.password ? (
              <p className="mt-1 text-[11px] text-[#c92a2a]">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <div>
            <p
              id="create-user-role-label"
              className="mb-2 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase"
            >
              Role
            </p>
            <div
              role="radiogroup"
              aria-labelledby="create-user-role-label"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {(roles.length ? roles : fallbackRoles).map((option) => {
                const selected = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={submitting}
                    onClick={() => {
                      setRole(option.value);
                      if (option.value !== Role.MainTeamLead) {
                        setTeamName("");
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.teamName;
                          return next;
                        });
                      }
                    }}
                    className={[
                      "lf-pressable min-h-[42px] rounded-xl border px-3 py-2.5 text-left text-[12.5px] leading-snug font-medium transition-[border-color,background-color,color,box-shadow]",
                      selected
                        ? "border-[rgba(232,104,18,0.45)] bg-[#fff7ef] text-[#9a3f00] shadow-[inset_0_0_0_1px_rgba(232,104,18,0.12)]"
                        : "border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] text-[#495057] hover:border-[rgba(33,37,41,0.16)] hover:bg-white hover:text-[#212529]",
                      submitting ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <span className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className={[
                          "mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                          selected
                            ? "border-[#e86812] bg-[#e86812]"
                            : "border-[rgba(33,37,41,0.22)] bg-white",
                        ].join(" ")}
                      >
                        {selected ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        ) : null}
                      </span>
                      <span>{option.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.role ? (
              <p className="mt-1 text-[11px] text-[#c92a2a]">{fieldErrors.role}</p>
            ) : null}
          </div>

          <div
            className={[
              "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
              needsTeam
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            ].join(" ")}
            aria-hidden={!needsTeam}
          >
            <div className="overflow-hidden">
              <div className="pt-0.5">
                <label className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
                  Team name
                </label>
                <input
                  className={inputClass}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required={needsTeam}
                  minLength={2}
                  maxLength={120}
                  disabled={submitting || !needsTeam}
                  tabIndex={needsTeam ? 0 : -1}
                  placeholder="e.g. Elite Closers"
                  autoComplete="organization"
                />
                {fieldErrors.teamName ? (
                  <p className="mt-1 text-[11px] text-[#c92a2a]">
                    {fieldErrors.teamName}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[#adb5bd]">
                    Creates or links this Main Team Lead to a sales team
                  </p>
                )}
              </div>
            </div>
          </div>

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
              idleLabel="Create user"
              pendingLabel="Creating…"
              successLabel="Created"
              className="h-10 rounded-xl px-4 text-[13px]"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
