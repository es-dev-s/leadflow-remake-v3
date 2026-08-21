"use client";

import { getSessionId, getSessionUserId } from "@/lib/auth-token";

const CHANNEL = "leadflow.session";
const LIVE_KEY = "leadflow.session.live";

type SessionMessage = {
  type: "login";
  sessionId: string;
  userId: string;
  at?: number;
};

let sharedChannel: BroadcastChannel | null = null;

function channel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (sharedChannel) return sharedChannel;
  try {
    sharedChannel = new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
  return sharedChannel;
}

export function getLiveSession(): { userId: string; sessionId: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LIVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionMessage;
    const sessionId = data?.sessionId?.trim();
    const userId = data?.userId?.trim();
    if (!sessionId || !userId) return null;
    return { userId, sessionId };
  } catch {
    return null;
  }
}

/** Same-account takeover only — other users on this origin are ignored. */
export function isForeignSessionForUser(
  userId: string,
  incoming?: { userId?: string; sessionId?: string } | null,
): boolean {
  const uid = userId.trim();
  const incomingUser = incoming?.userId?.trim();
  const incomingSid = incoming?.sessionId?.trim();
  if (!uid || !incomingUser || !incomingSid) return false;
  if (incomingUser !== uid) return false;
  const mine = getSessionId();
  return !mine || mine !== incomingSid;
}

/** Tell other tabs on this origin that this tab now owns this account. */
export function announceSession(sessionId: string, userId: string) {
  const id = sessionId.trim();
  const uid = userId.trim();
  if (!id || !uid || typeof window === "undefined") return;
  const payload: SessionMessage = {
    type: "login",
    sessionId: id,
    userId: uid,
    at: Date.now(),
  };
  try {
    window.localStorage.setItem(LIVE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode may block storage */
  }
  try {
    channel()?.postMessage(payload);
  } catch {
    /* ignore */
  }
}

/** Logout this tab when the same account logs in elsewhere on this origin. */
export function subscribeSessionLock(
  userId: string,
  onReplaced: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const uid = userId.trim();
  if (!uid) return () => {};

  const kickIfForeign = (incoming?: SessionMessage | null) => {
    if (!isForeignSessionForUser(uid, incoming)) return;
    onReplaced();
  };

  const onMsg = (event: MessageEvent<SessionMessage>) => {
    if (event.data?.type !== "login") return;
    kickIfForeign(event.data);
  };
  const ch = channel();
  ch?.addEventListener("message", onMsg);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== LIVE_KEY || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue) as SessionMessage;
      if (data?.type !== "login") return;
      kickIfForeign(data);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("storage", onStorage);

  const live = getLiveSession();
  if (
    live &&
    live.userId === uid &&
    getSessionId() &&
    isForeignSessionForUser(uid, live)
  ) {
    onReplaced();
  }

  return () => {
    ch?.removeEventListener("message", onMsg);
    window.removeEventListener("storage", onStorage);
  };
}

export function liveSessionReplacedThisTab(): boolean {
  const live = getLiveSession();
  const mineSid = getSessionId();
  const mineUser = getSessionUserId();
  if (!live || !mineSid || !mineUser) return false;
  return live.userId === mineUser && live.sessionId !== mineSid;
}
