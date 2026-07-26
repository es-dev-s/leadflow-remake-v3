"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const FILTER_PANEL_WIDTH = 400;
export const FILTER_PANEL_EXIT_MS = 380;

type Props = {
  open: boolean;
  id: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Smooth right-edge filter panel — no dimmed backdrop, depth via shadow only.
 */
export function FilterPanelShell({
  open,
  id,
  label,
  onClose,
  children,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setExpanded(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setExpanded(false);
    closeTimer.current = window.setTimeout(() => {
      setMounted(false);
      closeTimer.current = null;
    }, FILTER_PANEL_EXIT_MS);

    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, onClose]);

  if (!mounted) return null;

  return (
    <aside
      id={id}
      role="dialog"
      aria-label={label}
      aria-hidden={!expanded}
      className={[
        "absolute inset-y-0 right-0 z-40 flex h-full flex-col border-l border-[rgba(33,37,41,0.08)] bg-white transition-transform duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        "shadow-[-24px_0_48px_rgba(15,17,20,0.12)]",
        expanded ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
      style={{ width: `min(${FILTER_PANEL_WIDTH}px, 100%)` }}
    >
      {children}
    </aside>
  );
}
