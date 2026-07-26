"use client";

import { Check, LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ActionPhase } from "@/hooks/use-action-phase";

type Tone = "primary" | "danger" | "soft" | "ghost";

type Props = {
  phase: ActionPhase;
  idleLabel: ReactNode;
  pendingLabel?: ReactNode;
  successLabel?: ReactNode;
  /** When omitted, uses the phase hook’s latest success label if provided via prop sync. */
  tone?: Tone;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

const toneIdle: Record<Tone, string> = {
  primary:
    "bg-[#212529] text-white hover:opacity-90 disabled:opacity-45",
  danger:
    "bg-[#c92a2a] text-white hover:bg-[#b02525] disabled:opacity-60",
  soft:
    "border border-[rgba(33,37,41,0.08)] bg-white text-[#212529] hover:bg-[#f8f9fa] disabled:opacity-50",
  ghost:
    "bg-transparent text-[#495057] hover:bg-[#f8f9fa] disabled:opacity-50",
};

export function ActionButton({
  phase,
  idleLabel,
  pendingLabel = "Working…",
  successLabel = "Done",
  tone = "primary",
  className = "",
  disabled,
  type = "button",
  ...rest
}: Props) {
  const isPending = phase === "pending";
  const isSuccess = phase === "success";
  const busy = isPending || isSuccess;

  const surface = isSuccess
    ? "border border-[rgba(47,158,68,0.3)] bg-[#ebfbee] text-[#2b8a3e] shadow-[0_0_0_3px_rgba(47,158,68,0.1)]"
    : toneIdle[tone];

  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={isPending || undefined}
      aria-live="polite"
      className={[
        "lf-pressable inline-flex items-center justify-center gap-1.5 font-medium transition-[background-color,color,border-color,opacity,transform,box-shadow] duration-200 ease-out disabled:cursor-not-allowed",
        surface,
        className,
      ].join(" ")}
      {...rest}
    >
      {isPending ? (
        <>
          <LoaderCircle
            size={14}
            strokeWidth={1.75}
            className="shrink-0 animate-spin opacity-90"
          />
          <span className="truncate">{pendingLabel}</span>
        </>
      ) : isSuccess ? (
        <>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2b8a3e] text-white">
            <Check
              size={10}
              strokeWidth={2.75}
              className="animate-[lf-action-pop_320ms_ease-out]"
            />
          </span>
          <span className="truncate">{successLabel}</span>
        </>
      ) : (
        <span className="truncate">{idleLabel}</span>
      )}
    </button>
  );
}
