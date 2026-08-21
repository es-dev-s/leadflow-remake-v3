"use client";

import { X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@/components/dashboard/action-button";
import {
  ApiError,
  fetchAnalystTeams,
  fetchLeads,
  transferLeadAnalystRequest,
  updateUserRequest,
  type AnalystTeamBrief,
  type PublicUser,
} from "@/lib/api";
import { useActionPhase } from "@/hooks/use-action-phase";

type Props = {
  open: boolean;
  user: PublicUser | null;
  onClose: () => void;
  onTransferred: (user: PublicUser, leadsOwned: number, toTeamName: string) => void;
  /** Used when the analyst-teams API is unavailable (e.g. older backend). */
  fallbackTeams?: AnalystTeamBrief[];
};

const inputClass =
  "h-11 w-full rounded-xl border border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] px-3.5 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow] focus:border-[rgba(232,104,18,0.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(232,104,18,0.1)]";

function teamsEqual(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function pickAnalystTeams(
  apiTeams: AnalystTeamBrief[] | null | undefined,
  fallback: AnalystTeamBrief[],
): AnalystTeamBrief[] {
  const fromApi = (apiTeams ?? []).filter(
    (team) => team.leadId?.trim() && team.name?.trim(),
  );
  if (fromApi.length > 0) return fromApi;
  return fallback;
}

export function TransferLaModal({
  open,
  user,
  onClose,
  onTransferred,
  fallbackTeams = [],
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [teams, setTeams] = useState<AnalystTeamBrief[]>([]);
  const [toLeadId, setToLeadId] = useState("");
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const {
    phase: submitPhase,
    start: startSubmit,
    succeed: succeedSubmit,
    fail: failSubmit,
    reset: resetSubmit,
    isBusy: submitting,
  } = useActionPhase();
  const [error, setError] = useState<string | null>(null);
  const openRef = useRef(open);
  const userIdRef = useRef<string | null>(null);
  openRef.current = open;
  userIdRef.current = user?.id ?? null;

  const currentTeam = user?.analystTeamName?.trim() ?? "";

  const destinations = useMemo(() => {
    return teams.filter((team) => !teamsEqual(team.name, currentTeam));
  }, [teams, currentTeam]);

  const selectedTeam = useMemo(
    () => destinations.find((team) => team.leadId === toLeadId) ?? null,
    [destinations, toLeadId],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !user) return;
    setToLeadId("");
    setLeadCount(null);
    setError(null);
    resetSubmit();
    setLoadingMeta(true);
    const controller = new AbortController();
    const targetId = user.id;
    void Promise.all([
      fetchAnalystTeams(controller.signal).catch(() => null),
      fetchLeads({
        analystId: user.id,
        limit: 1,
        signal: controller.signal,
      }).catch(() => null),
    ])
      .then(([teamRows, leadsPage]) => {
        if (controller.signal.aborted || userIdRef.current !== targetId) return;
        const options = pickAnalystTeams(teamRows, fallbackTeams);
        setTeams(options);
        setLeadCount(
          typeof leadsPage?.total === "number" ? leadsPage.total : null,
        );
        if (options.length === 0) {
          setError("No analyst teams are configured yet");
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || userIdRef.current !== targetId) return;
        const options = pickAnalystTeams(null, fallbackTeams);
        if (options.length > 0) {
          setTeams(options);
          setError(null);
          return;
        }
        setError(
          err instanceof Error ? err.message : "Failed to load analyst teams",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted && userIdRef.current === targetId) {
          setLoadingMeta(false);
        }
      });
    return () => controller.abort();
  }, [open, user, fallbackTeams]);

  if (!mounted || !open || !user) return null;

  const hasTeam = Boolean(currentTeam);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !user || !toLeadId || !selectedTeam) return;
    const targetId = user.id;
    startSubmit();
    setError(null);
    try {
      const result = await transferLeadAnalystRequest(targetId, {
        toLeadId,
        toTeamName: selectedTeam.name,
        expectedTeamName: user.analystTeamName,
      });
      if (!openRef.current || userIdRef.current !== targetId) return;
      onTransferred(
        result.user,
        result.leadsOwned,
        result.toTeamName || selectedTeam.name,
      );
      await succeedSubmit(hasTeam ? "Transferred" : "Assigned");
      if (!openRef.current || userIdRef.current !== targetId) return;
      onClose();
    } catch (err: unknown) {
      if (!openRef.current || userIdRef.current !== targetId) return;
      if (err instanceof ApiError && selectedTeam) {
        const canFallback =
          err.status === 404 ||
          err.message.toLowerCase().includes("not found") ||
          err.message.toLowerCase().includes("destination analyst team");
        if (canFallback) {
          try {
            const updated = await updateUserRequest(targetId, {
              name: user.name,
              email: user.email,
              role: user.role,
              teamName: selectedTeam.name,
            });
            if (!openRef.current || userIdRef.current !== targetId) return;
            onTransferred(updated.user, leadCount ?? 0, selectedTeam.name);
            await succeedSubmit(hasTeam ? "Transferred" : "Assigned");
            if (!openRef.current || userIdRef.current !== targetId) return;
            onClose();
            return;
          } catch (fallbackErr: unknown) {
            if (!openRef.current || userIdRef.current !== targetId) return;
            setError(
              fallbackErr instanceof ApiError
                ? fallbackErr.message
                : fallbackErr instanceof Error
                  ? fallbackErr.message
                  : "Transfer failed",
            );
            failSubmit();
            return;
          }
        }
      }
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Transfer failed");
      }
      failSubmit();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[rgba(33,37,41,0.28)] backdrop-blur-[2px]"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-la-title"
        className="relative z-10 flex max-h-[min(92dvh,640px)] w-full max-w-[440px] flex-col overflow-hidden rounded-t-2xl border border-[rgba(33,37,41,0.08)] bg-white shadow-[0_24px_64px_rgba(33,37,41,0.18)] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(33,37,41,0.06)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="transfer-la-title"
              className="text-[16px] font-medium tracking-[-0.02em] text-[#212529]"
            >
              Transfer to analyst team
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-[#868e96]">
              {user.name} · {currentTeam || "No team"}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="lf-pressable rounded-lg p-1.5 text-[#adb5bd] hover:bg-[#f8f9fa] hover:text-[#495057] disabled:opacity-50"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="lf-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="rounded-xl border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] px-3.5 py-3">
              <p className="text-[12px] leading-relaxed text-[#495057]">
                {hasTeam
                  ? "Moves this Lead Analyst onto the selected analyst team (Analyst Team Lead pod). Their created leads stay with them."
                  : "Assigns this Lead Analyst to the selected analyst team."}
              </p>
              <p className="mt-2 text-[12px] font-medium tabular-nums text-[#212529]">
                {leadCount == null
                  ? loadingMeta
                    ? "Counting created leads…"
                    : "Created leads: —"
                  : `Created leads: ${leadCount.toLocaleString("en-US")}`}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
                Destination analyst team
              </label>
              <select
                className={inputClass}
                value={toLeadId}
                disabled={submitting || loadingMeta}
                required
                onChange={(e) => setToLeadId(e.target.value)}
              >
                <option value="">
                  {loadingMeta ? "Loading teams…" : "Select a team"}
                </option>
                {destinations.map((team) => (
                  <option key={team.leadId} value={team.leadId}>
                    {team.name}
                    {team.leadName ? ` · ${team.leadName}` : ""}
                  </option>
                ))}
              </select>
              {!loadingMeta && destinations.length === 0 ? (
                <p className="mt-1 text-[11px] text-[#c92a2a]">
                  No other analyst teams available
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="rounded-lg border border-[rgba(201,42,42,0.18)] bg-[#fff5f5] px-3 py-2 text-[12px] text-[#c92a2a]">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[rgba(33,37,41,0.06)] px-5 py-3">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="lf-pressable h-10 rounded-xl px-3.5 text-[13px] font-medium text-[#6c757d] hover:bg-[#f8f9fa] hover:text-[#212529] disabled:opacity-50"
            >
              Cancel
            </button>
            <ActionButton
              type="submit"
              phase={submitPhase}
              disabled={!toLeadId || loadingMeta}
              idleLabel={hasTeam ? "Transfer" : "Assign"}
              pendingLabel="Transferring…"
              successLabel="Transferred"
              className="h-10 rounded-xl px-4 text-[13px]"
            />
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
