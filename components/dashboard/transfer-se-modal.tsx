"use client";

import { X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@/components/dashboard/action-button";
import {
  ApiError,
  fetchLeads,
  fetchTeams,
  transferSalesExecRequest,
  type PublicUser,
  type TeamBrief,
} from "@/lib/api";
import { useActionPhase } from "@/hooks/use-action-phase";

type Props = {
  open: boolean;
  user: PublicUser | null;
  onClose: () => void;
  onTransferred: (user: PublicUser, leadsMoved: number, toTeamName: string) => void;
};

const inputClass =
  "h-11 w-full rounded-xl border border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] px-3.5 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow] focus:border-[rgba(232,104,18,0.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(232,104,18,0.1)]";

export function TransferSeModal({ open, user, onClose, onTransferred }: Props) {
  const [mounted, setMounted] = useState(false);
  const [teams, setTeams] = useState<TeamBrief[]>([]);
  const [toTeamId, setToTeamId] = useState("");
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

  const destinations = useMemo(() => {
    const current = user?.teamId?.trim() ?? "";
    return teams.filter((t) => t.id !== current);
  }, [teams, user?.teamId]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !user) return;
    setToTeamId("");
    setLeadCount(null);
    setError(null);
    resetSubmit();
    setLoadingMeta(true);
    const controller = new AbortController();
    const targetId = user.id;
    void Promise.all([
      fetchTeams(controller.signal),
      fetchLeads({
        salesExecId: user.id,
        limit: 1,
        signal: controller.signal,
      }).catch(() => null),
    ])
      .then(([teamRows, leadsPage]) => {
        if (controller.signal.aborted || userIdRef.current !== targetId) return;
        setTeams(teamRows);
        setLeadCount(
          typeof leadsPage?.total === "number" ? leadsPage.total : null,
        );
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || userIdRef.current !== targetId) return;
        setError(err instanceof Error ? err.message : "Failed to load teams");
      })
      .finally(() => {
        if (!controller.signal.aborted && userIdRef.current === targetId) {
          setLoadingMeta(false);
        }
      });
    return () => controller.abort();
  }, [open, user]);

  if (!mounted || !open || !user) return null;

  const hasTeam = Boolean(user.teamId?.trim());

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !user || !toTeamId) return;
    const targetId = user.id;
    const dest = destinations.find((t) => t.id === toTeamId);
    startSubmit();
    setError(null);
    try {
      const result = await transferSalesExecRequest(targetId, {
        toTeamId,
        expectedTeamId: user.teamId,
      });
      if (!openRef.current || userIdRef.current !== targetId) return;
      onTransferred(
        result.user,
        result.leadsMoved,
        dest?.name || result.user.teamName || "selected team",
      );
      await succeedSubmit(hasTeam ? "Transferred" : "Assigned");
      if (!openRef.current || userIdRef.current !== targetId) return;
      onClose();
    } catch (err: unknown) {
      if (!openRef.current || userIdRef.current !== targetId) return;
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
        aria-labelledby="transfer-se-title"
        className="relative z-10 flex max-h-[min(92dvh,640px)] w-full max-w-[440px] flex-col overflow-hidden rounded-t-2xl border border-[rgba(33,37,41,0.08)] bg-white shadow-[0_24px_64px_rgba(33,37,41,0.18)] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(33,37,41,0.06)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="transfer-se-title"
              className="text-[16px] font-medium tracking-[-0.02em] text-[#212529]"
            >
              Transfer to a team
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-[#868e96]">
              {user.name} · {user.teamName || "No team"}
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
                  ? "Moves this sales executive and all leads currently assigned to them onto the destination team. The transfer is recorded in Transfer logs."
                  : "Assigns this sales executive to the selected team. Any leads currently assigned to them move with them. The change is recorded in Transfer logs."}
              </p>
              <p className="mt-2 text-[12px] font-medium tabular-nums text-[#212529]">
                {leadCount == null
                  ? loadingMeta
                    ? "Counting assigned leads…"
                    : "Assigned leads: —"
                  : `Assigned leads to move: ${leadCount.toLocaleString("en-US")}`}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
                Destination team
              </label>
              <select
                className={inputClass}
                value={toTeamId}
                disabled={submitting || loadingMeta}
                required
                onChange={(e) => setToTeamId(e.target.value)}
              >
                <option value="">
                  {loadingMeta ? "Loading teams…" : "Select a team"}
                </option>
                {destinations.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {!loadingMeta && destinations.length === 0 ? (
                <p className="mt-1 text-[11px] text-[#c92a2a]">
                  No other teams available
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
              disabled={!toTeamId || loadingMeta}
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
