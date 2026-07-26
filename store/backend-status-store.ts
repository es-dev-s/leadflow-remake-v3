"use client";

import { create } from "zustand";
import { fetchBackendHealth } from "@/lib/api";

export type BackendStatus = "checking" | "live" | "offline" | "degraded";

type BackendStatusState = {
  status: BackendStatus;
  database: string | null;
  /** Monotonic poll generation — stale responses are ignored. */
  pollEpoch: number;
  setFromHealth: (
    pollEpoch: number,
    payload: { status: string; database: string },
  ) => void;
  setOffline: (pollEpoch: number) => void;
  bumpPollEpoch: () => number;
};

export const useBackendStatusStore = create<BackendStatusState>()((set, get) => ({
  status: "checking",
  database: null,
  pollEpoch: 0,

  bumpPollEpoch: () => {
    const next = get().pollEpoch + 1;
    set({ pollEpoch: next });
    return next;
  },

  setFromHealth: (pollEpoch, payload) => {
    if (pollEpoch !== get().pollEpoch) return;
    const nextStatus: BackendStatus =
      payload.status === "ok" && payload.database === "ok"
        ? "live"
        : "degraded";
    set((state) => {
      if (
        state.status === nextStatus &&
        state.database === payload.database
      ) {
        return state;
      }
      return { status: nextStatus, database: payload.database };
    });
  },

  setOffline: (pollEpoch) => {
    if (pollEpoch !== get().pollEpoch) return;
    set((state) => {
      if (state.status === "offline" && state.database === null) return state;
      return { status: "offline", database: null };
    });
  },
}));

const POLL_MS = 30000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
let abortController: AbortController | null = null;

async function pollOnce() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return;
  }
  const epoch = useBackendStatusStore.getState().pollEpoch;
  const controller = new AbortController();
  abortController?.abort();
  abortController = controller;

  try {
    const data = await fetchBackendHealth(controller.signal);
    useBackendStatusStore.getState().setFromHealth(epoch, {
      status: data.status,
      database: data.database,
    });
  } catch {
    if (controller.signal.aborted) return;
    useBackendStatusStore.getState().setOffline(epoch);
  }
}

/** Shared singleton poller — one network loop for all status UI mounts. */
export function subscribeBackendStatusPolling() {
  subscribers += 1;
  if (subscribers === 1) {
    useBackendStatusStore.getState().bumpPollEpoch();
    void pollOnce();
    pollTimer = setInterval(() => {
      useBackendStatusStore.getState().bumpPollEpoch();
      void pollOnce();
    }, POLL_MS);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityPoll);
    }
  }

  return () => {
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      abortController?.abort();
      abortController = null;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityPoll);
      }
    }
  };
}

function onVisibilityPoll() {
  if (document.visibilityState !== "visible") return;
  useBackendStatusStore.getState().bumpPollEpoch();
  void pollOnce();
}
