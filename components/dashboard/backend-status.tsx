"use client";

import {
  type BackendStatus,
  useBackendStatus,
} from "@/hooks/use-backend-status";

const STATUS_COPY: Record<
  BackendStatus,
  { label: string; title: string; dot: string }
> = {
  checking: {
    label: "Checking",
    title: "Checking backend…",
    dot: "bg-[#adb5bd] animate-pulse",
  },
  live: {
    label: "Online",
    title: "Backend online",
    dot: "bg-[#2f9e44]",
  },
  degraded: {
    label: "Degraded",
    title: "Backend degraded",
    dot: "bg-[#f08c00]",
  },
  offline: {
    label: "Offline",
    title: "Backend offline",
    dot: "bg-[#e03131]",
  },
};

export function BackendStatusIndicator() {
  const { status, database } = useBackendStatus();
  const copy = STATUS_COPY[status];
  const title =
    database && status !== "checking" && status !== "offline"
      ? `${copy.title} · DB ${database}`
      : copy.title;

  return (
    <div
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[rgba(33,37,41,0.08)] bg-white px-2 sm:px-2.5"
      title={title}
      aria-live="polite"
      aria-label={title}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
      <span className="hidden text-[12px] font-medium text-[#495057] sm:inline">
        Backend{" "}
        <span className="text-[#212529]">{copy.label}</span>
      </span>
    </div>
  );
}
