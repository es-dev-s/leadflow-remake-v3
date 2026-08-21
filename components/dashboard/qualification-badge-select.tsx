"use client";

import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { updateLeadQualification } from "@/lib/api";
import {
  QUALIFICATION_OPTIONS,
  qualificationLabel,
  type QualificationValue,
} from "@/lib/lead-form-options";
import { useActionPhase } from "@/hooks/use-action-phase";
import { useLeadsStore } from "@/store/leads-store";

function badgeClass(status: string) {
  switch (status) {
    case "QUALIFIED":
      return "border-[rgba(47,158,68,0.28)] bg-[#ebfbee] text-[#2b8a3e]";
    case "QUALIFIED_CHAT":
      return "border-[rgba(34,139,230,0.28)] bg-[#e7f5ff] text-[#1864ab]";
    case "QUALIFIED_CALL":
      return "border-[rgba(232,104,18,0.28)] bg-[#fff4e6] text-[#9a3f00]";
    case "PAID":
      return "border-[rgba(9,146,104,0.28)] bg-[#e6fcf5] text-[#087f5b]";
    case "ORGANIC":
      return "border-[rgba(92,124,250,0.28)] bg-[#edf2ff] text-[#3b5bdb]";
    case "NOT_QUALIFIED":
      return "border-[rgba(33,37,41,0.12)] bg-[#f1f3f5] text-[#495057]";
    case "IRRELEVANT":
      return "border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] text-[#868e96]";
    default:
      return "border-[rgba(33,37,41,0.1)] bg-white text-[#212529]";
  }
}

type Props = {
  leadId: string;
  statusRaw: string;
  statusLabel: string;
  /** When false, render a static badge (no dropdown). */
  editable?: boolean;
};

export function QualificationBadgeSelect({
  leadId,
  statusRaw,
  statusLabel,
  editable = true,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const patchLead = useLeadsStore((s) => s.patchLead);
  const [open, setOpen] = useState(false);
  const {
    phase,
    start,
    succeed,
    fail,
    isBusy: saving,
  } = useActionPhase(900);
  const [error, setError] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const current =
    QUALIFICATION_OPTIONS.find((option) => option.value === statusRaw)?.value ??
    (statusRaw as QualificationValue | "");

  useEffect(() => {
    if (!editable && open) setOpen(false);
  }, [editable, open]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 220),
        width: Math.max(rect.width, 196),
      });
    };
    update();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById(listId);
      if (menu?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, listId]);

  async function select(value: QualificationValue) {
    if (saving || value === current) {
      setOpen(false);
      return;
    }
    const previous = {
      status: statusLabel,
      statusRaw: statusRaw || current,
    };
    patchLead(leadId, {
      statusRaw: value,
      status: qualificationLabel(value),
    });
    start();
    setError(null);
    setOpen(false);
    try {
      const result = await updateLeadQualification(leadId, value);
      patchLead(leadId, {
        statusRaw: result.qualificationStatus,
        status: qualificationLabel(result.qualificationStatus),
      });
      await succeed("Saved");
    } catch (err: unknown) {
      patchLead(leadId, previous);
      setError(err instanceof Error ? err.message : "Update failed");
      fail();
    }
  }

  if (!editable) {
    return (
      <div className="relative min-w-0 max-w-full">
        <span
          title={qualificationLabel(current || statusRaw) || statusLabel || "—"}
          className={[
            "inline-flex max-w-full items-center rounded px-1.5 py-px text-[10px] font-medium leading-4 whitespace-nowrap",
            "border",
            badgeClass(current || statusRaw),
          ].join(" ")}
        >
          <span className="truncate">
            {qualificationLabel(current || statusRaw) || statusLabel || "—"}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full">
      <button
        ref={buttonRef}
        type="button"
        disabled={saving}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change qualification"
        title={qualificationLabel(current || statusRaw) || statusLabel || "—"}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={[
          "lf-pressable inline-flex max-w-full items-center gap-0.5 rounded border px-1.5 py-px text-[10px] font-medium leading-4 whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-200 disabled:opacity-70",
          phase === "success"
            ? "border-[rgba(47,158,68,0.28)] bg-[#ebfbee] text-[#2b8a3e]"
            : badgeClass(current || statusRaw),
        ].join(" ")}
      >
        <span className="min-w-0 truncate">
          {phase === "success"
            ? "Saved"
            : qualificationLabel(current || statusRaw) || statusLabel || "—"}
        </span>
        {phase === "pending" ? (
          <LoaderCircle size={10} className="shrink-0 animate-spin" />
        ) : phase === "success" ? (
          <Check
            size={10}
            strokeWidth={2.25}
            className="shrink-0 animate-[lf-action-pop_320ms_ease-out]"
          />
        ) : (
          <ChevronDown size={10} className="shrink-0 opacity-60" />
        )}
      </button>
      {error ? (
        <p className="mt-1 max-w-[160px] truncate text-[10px] text-[#c92a2a]">
          {error}
        </p>
      ) : null}
      {open && menuPos
        ? createPortal(
            <div
              id={listId}
              role="listbox"
              className="fixed z-[140] overflow-hidden rounded-lg border border-[rgba(33,37,41,0.1)] bg-white py-1 shadow-[0_16px_40px_rgba(15,17,20,0.14)]"
              style={{
                top: menuPos.top,
                left: Math.max(8, menuPos.left),
                width: Math.max(menuPos.width, 168),
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              {QUALIFICATION_OPTIONS.map((option) => {
                const active = option.value === current;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      void select(option.value);
                    }}
                    className={[
                      "flex w-full items-center px-2.5 py-1.5 text-left transition-colors",
                      active
                        ? "bg-[#fff7ef] font-medium text-[#9a3f00]"
                        : "text-[#212529] hover:bg-[#f8f9fa]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-flex rounded border px-1.5 py-px text-[10px] font-medium leading-4 whitespace-nowrap",
                        badgeClass(option.value),
                      ].join(" ")}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
