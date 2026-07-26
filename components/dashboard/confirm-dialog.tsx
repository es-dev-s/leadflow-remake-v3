"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@/components/dashboard/action-button";
import type { ActionPhase } from "@/hooks/use-action-phase";

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  successLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  /** @deprecated prefer `phase` */
  loading?: boolean;
  phase?: ActionPhase;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  pendingLabel = "Working…",
  successLabel = "Done",
  cancelLabel = "Cancel",
  tone = "neutral",
  loading = false,
  phase,
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const resolvedPhase: ActionPhase =
    phase ?? (loading ? "pending" : "idle");
  const busy = resolvedPhase !== "idle";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Dismiss"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
        className="absolute inset-0 bg-[rgba(15,17,20,0.32)]"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lf-confirm-title"
        aria-describedby="lf-confirm-desc"
        className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white shadow-[0_28px_80px_rgba(15,17,20,0.22)]"
      >
        <div className="px-6 pt-6 pb-1">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="lf-confirm-title"
              className="text-[16px] font-medium tracking-[-0.02em] text-[#212529]"
            >
              {title}
            </h2>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="lf-pressable -mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#ced4da] hover:bg-[#f8f9fa] hover:text-[#6c757d] disabled:opacity-50"
              aria-label="Close"
            >
              <X size={15} strokeWidth={1.5} />
            </button>
          </div>
          <div
            id="lf-confirm-desc"
            className="mt-2 text-[13px] leading-relaxed text-[#868e96]"
          >
            {description}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pt-5 pb-5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="lf-pressable h-9 rounded-lg px-4 text-[13px] font-medium text-[#495057] hover:bg-[#f8f9fa] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <ActionButton
            phase={resolvedPhase}
            idleLabel={confirmLabel}
            pendingLabel={pendingLabel}
            successLabel={successLabel}
            tone={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            className="h-9 min-w-[108px] rounded-lg px-4 text-[13px]"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
