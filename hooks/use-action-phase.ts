"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showActionToast } from "@/store/action-toast-store";

export type ActionPhase = "idle" | "pending" | "success";

const DEFAULT_SUCCESS_MS = 1200;

/**
 * Idle → pending → green success flash for async CRUD buttons.
 * `succeed()` also fires the global green Done toast, then resolves after
 * the on-button success flash so callers can close modals afterward.
 */
export function useActionPhase(successMs = DEFAULT_SUCCESS_MS) {
  const [phase, setPhase] = useState<ActionPhase>("idle");
  const [successLabel, setSuccessLabel] = useState("Done");
  const timerRef = useRef<number | null>(null);
  const successMsRef = useRef(successMs);
  successMsRef.current = successMs;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setPhase("idle");
    setSuccessLabel("Done");
  }, [clearTimer]);

  const start = useCallback(() => {
    clearTimer();
    setPhase("pending");
  }, [clearTimer]);

  const fail = useCallback(() => {
    clearTimer();
    setPhase("idle");
  }, [clearTimer]);

  const succeed = useCallback(
    (message = "Done") => {
      const label = message.trim() || "Done";
      clearTimer();
      setSuccessLabel(label);
      setPhase("success");
      showActionToast(label);
      return new Promise<void>((resolve) => {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setPhase("idle");
          resolve();
        }, successMsRef.current);
      });
    },
    [clearTimer],
  );

  return {
    phase,
    successLabel,
    start,
    succeed,
    fail,
    reset,
    isBusy: phase !== "idle",
    isPending: phase === "pending",
    isSuccess: phase === "success",
  };
}
