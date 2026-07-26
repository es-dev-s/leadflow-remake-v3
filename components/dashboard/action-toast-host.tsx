"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useActionToastStore } from "@/store/action-toast-store";

const SHOW_MS = 1600;

/**
 * Floating green confirmation after saves / deletes / assigns.
 * Mount once near the app root so it survives modal close.
 */
export function ActionToastHost() {
  const id = useActionToastStore((s) => s.id);
  const message = useActionToastStore((s) => s.message);
  const visible = useActionToastStore((s) => s.visible);
  const hide = useActionToastStore((s) => s.hide);
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!visible || id === 0) return;
    setEntered(false);
    const enter = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    const hideTimer = window.setTimeout(() => {
      setEntered(false);
      window.setTimeout(() => hide(), 220);
    }, SHOW_MS);
    return () => {
      window.cancelAnimationFrame(enter);
      window.clearTimeout(hideTimer);
    };
  }, [visible, id, hide]);

  if (!mounted || (!visible && !entered)) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div
        className={[
          "pointer-events-none inline-flex items-center gap-2 rounded-full border border-[rgba(47,158,68,0.28)] bg-[#ebfbee] px-3.5 py-2 text-[13px] font-medium text-[#2b8a3e] shadow-[0_12px_40px_rgba(15,17,20,0.12)] transition-[opacity,transform] duration-200 ease-out",
          entered
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0",
        ].join(" ")}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2b8a3e] text-white">
          <Check
            size={12}
            strokeWidth={2.75}
            className="animate-[lf-action-pop_320ms_ease-out]"
          />
        </span>
        <span>{message}</span>
      </div>
    </div>,
    document.body,
  );
}
