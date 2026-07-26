"use client";

import {
  assignLeads,
  fetchAssignableUsers,
  type AssignableUser,
  type AssignLeadsResult,
} from "@/lib/api";
import { useActionPhase } from "@/hooks/use-action-phase";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Search, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Step = "menu" | "team-leads" | "members";

type Props = {
  open: boolean;
  anchorRect: DOMRect | null;
  leadIds: string[];
  /** When true, skip Team leads and open the members list directly. */
  membersOnly?: boolean;
  onClose: () => void;
  onAssigned: (result: AssignLeadsResult) => void;
};

export function AssignLeadsPopover({
  open,
  anchorRect,
  leadIds,
  membersOnly = false,
  onClose,
  onAssigned,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>(membersOnly ? "members" : "menu");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AssignableUser[]>([]);
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
  const [entering, setEntering] = useState(false);

  openRef.current = open;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setStep(membersOnly ? "members" : "menu");
    setQuery("");
    setUsers([]);
    setError(null);
    resetAssign();
    setAssigningId(null);
    setEntering(true);
    const id = window.requestAnimationFrame(() => setEntering(false));
    return () => window.cancelAnimationFrame(id);
  }, [open, membersOnly, resetAssign]);

  useEffect(() => {
    if (!open || step === "menu") return;

    const type = step === "team-leads" ? "team-leads" : "members";
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setEntering(true);
    const enterId = window.requestAnimationFrame(() => setEntering(false));

    void fetchAssignableUsers(type, controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setUsers(rows);
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

    return () => {
      controller.abort();
      window.cancelAnimationFrame(enterId);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (step !== "menu" && !membersOnly) {
          setStep("menu");
          setQuery("");
          setError(null);
          return;
        }
        onClose();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, step, membersOnly]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.name, user.email, user.teamName ?? "", user.roleLabel]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [users, query]);

  if (!mounted || !open || !anchorRect) return null;

  const width = step === "menu" ? 220 : 300;
  const left = Math.min(
    Math.max(12, anchorRect.left + anchorRect.width / 2 - width / 2),
    window.innerWidth - width - 12,
  );
  const bottom = Math.max(12, window.innerHeight - anchorRect.top + 10);

  async function handleAssign(user: AssignableUser) {
    if (submitting || leadIds.length === 0) return;
    startAssign();
    setAssigningId(user.id);
    setError(null);
    try {
      const result = await assignLeads({
        leadIds,
        assigneeId: user.id,
        kind: step === "team-leads" ? "team-lead" : "member",
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

  function goTo(next: Step) {
    setQuery("");
    setError(null);
    setUsers([]);
    setStep(next);
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Assign leads"
      style={{
        position: "fixed",
        left,
        bottom,
        width,
        zIndex: 60,
      }}
      className={[
        "overflow-hidden rounded-xl border border-[rgba(33,37,41,0.08)] bg-white shadow-[0_12px_40px_rgba(15,17,20,0.14)] transition-[width,opacity,transform] duration-200 ease-out",
        entering
          ? "translate-y-1 opacity-0"
          : "translate-y-0 opacity-100",
      ].join(" ")}
    >
        {step === "menu" ? (
          <div className="py-1">
            <p className="px-3 pt-1.5 pb-1 text-[10px] font-medium tracking-[0.04em] text-[#adb5bd] uppercase">
              Assign to
            </p>
            <button
              type="button"
              onClick={() => goTo("team-leads")}
              className="lf-pressable flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#f8f9fa]"
            >
              <span className="text-[13px] text-[#212529]">Team leads</span>
              <ChevronRight
                size={14}
                strokeWidth={1.5}
                className="text-[#ced4da]"
              />
            </button>
            <button
              type="button"
              onClick={() => goTo("members")}
              className="lf-pressable flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#f8f9fa]"
            >
              <span className="text-[13px] text-[#212529]">Members</span>
              <ChevronRight
                size={14}
                strokeWidth={1.5}
                className="text-[#ced4da]"
              />
            </button>
          </div>
        ) : (
          <div className="flex max-h-[min(380px,68vh)] flex-col">
            <div className="flex shrink-0 items-center gap-0.5 px-1.5 pt-1.5 pb-1">
              {membersOnly ? (
                <span className="h-7 w-7" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={() => goTo("menu")}
                  className="lf-pressable flex h-7 w-7 items-center justify-center rounded-md text-[#868e96] hover:bg-[#f8f9fa] hover:text-[#212529]"
                  aria-label="Back"
                >
                  <ChevronLeft size={15} strokeWidth={1.5} />
                </button>
              )}
              <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#212529]">
                {step === "team-leads" ? "Team leads" : "Members"}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="lf-pressable flex h-7 w-7 items-center justify-center rounded-md text-[#ced4da] hover:bg-[#f8f9fa] hover:text-[#6c757d]"
                aria-label="Close"
              >
                <X size={13} strokeWidth={1.5} />
              </button>
            </div>

            <div className="shrink-0 px-2.5 pb-2">
              <div className="relative">
                <Search
                  size={13}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#ced4da]"
                />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or team…"
                  className="h-8 w-full rounded-lg border-0 bg-[#f1f3f5] pr-2.5 pl-8 text-[12px] text-[#212529] outline-none placeholder:text-[#adb5bd] focus:bg-[#e9ecef]"
                />
              </div>
            </div>

            <div className="lf-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-[rgba(33,37,41,0.05)]">
              {loading ? (
                <div className="flex items-center gap-2 justify-center px-3 py-10 text-[12px] text-[#adb5bd]">
                  <LoaderCircle size={13} className="animate-spin" />
                  Loading
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-10 text-center text-[12px] text-[#adb5bd]">
                  {error ? error : "No matches"}
                </p>
              ) : (
                <div className="py-1">
                  {filtered.map((user) => {
                    const rowBusy = assigningId === user.id;
                    const rowSuccess = rowBusy && assignPhase === "success";
                    const rowPending = rowBusy && assignPhase === "pending";
                    return (
                    <button
                      key={user.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleAssign(user)}
                      className={[
                        "lf-pressable flex w-full items-center gap-2 px-3 py-1.5 text-left disabled:opacity-50",
                        rowSuccess
                          ? "bg-[#ebfbee]"
                          : "hover:bg-[#f8f9fa]",
                      ].join(" ")}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[#212529]">
                        {user.name}
                      </span>
                      {rowPending ? (
                        <LoaderCircle
                          size={12}
                          className="shrink-0 animate-spin text-[#adb5bd]"
                        />
                      ) : rowSuccess ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#2b8a3e]">
                          <Check size={12} strokeWidth={2.25} />
                          Assigned
                        </span>
                      ) : (
                        <span className="max-w-[42%] shrink-0 truncate text-[11px] text-[#adb5bd]">
                          {user.teamName || "No team"}
                        </span>
                      )}
                    </button>
                    );
                  })}
                </div>
              )}
            </div>

            {error && !loading ? (
              <p className="shrink-0 border-t border-[rgba(33,37,41,0.05)] px-3 py-2 text-[11px] text-[#c92a2a]">
                {error}
              </p>
            ) : null}
          </div>
        )}
    </div>,
    document.body,
  );
}
