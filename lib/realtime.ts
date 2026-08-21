import { BACKEND_URL, ApiError, fetchMe, isSessionReplacedError } from "@/lib/api";
import { getAuthToken, getSessionId } from "@/lib/auth-token";
import { getLiveSession, liveSessionReplacedThisTab } from "@/lib/session-lock";
import { clearQueryCache } from "@/lib/query-cache";

export type RealtimeEvent = {
  type: string;
  leadId?: string;
  userId?: string;
  teamId?: string;
  role?: string;
  users?: Array<{ userId: string; teamId?: string; role?: string }>;
  actorId?: string;
  at?: number;
};

type Listener = (event: RealtimeEvent) => void;

/**
 * Single shared SSE connection for the whole app. Auth is the HttpOnly cookie
 * (withCredentials) — never put JWTs in the query string.
 */
class RealtimeClient {
  private source: EventSource | null = null;
  private listeners = new Set<Listener>();
  private sessionMarker: string | null = null;
  private reconnectTimer: number | null = null;
  private retryDelay = 1000;
  private readonly maxDelay = 20000;
  private started = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.ensureStarted();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitSessionReplaced() {
    const evt: RealtimeEvent = { type: "auth.session_replaced" };
    for (const listener of this.listeners) {
      try {
        listener(evt);
      } catch {
        /* ignore */
      }
    }
  }

  /** Call after login / logout so the stream re-auths with the new session. */
  refreshAuth() {
    const next = `${getAuthToken() ?? ""}:${getSessionId() ?? ""}`;
    if (next === this.sessionMarker && this.source) return;
    this.reconnect();
  }

  private ensureStarted() {
    if (this.started) return;
    this.started = true;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibility);
      window.addEventListener("online", this.onOnline);
    }
    this.connect();
  }

  private onVisibility = () => {
    if (document.visibilityState === "visible" && !this.source) {
      this.connect();
    }
  };

  private onOnline = () => {
    this.reconnect();
  };

  private connect() {
    if (typeof window === "undefined") return;
    if (this.source) return;

    const marker = `${getAuthToken() ?? ""}:${getSessionId() ?? ""}`;
    this.sessionMarker = marker;
    if (!getAuthToken()) {
      this.scheduleReconnect(2000);
      return;
    }

    const sid = getSessionId();
    if (liveSessionReplacedThisTab()) {
      this.emitSessionReplaced();
      return;
    }
    if (!sid) {
      this.scheduleReconnect(500);
      return;
    }

    const url = `${BACKEND_URL}/api/events?sid=${encodeURIComponent(sid)}`;

    let es: EventSource;
    try {
      es = new EventSource(url, { withCredentials: true });
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.source = es;

    es.onopen = () => {
      this.retryDelay = 1000;
    };

    es.onmessage = (ev) => {
      if (!ev.data) return;
      let parsed: RealtimeEvent | null = null;
      try {
        parsed = JSON.parse(ev.data) as RealtimeEvent;
      } catch {
        return;
      }
      if (!parsed || !parsed.type) return;
      if (parsed.type === "auth.session_replaced") {
        const live = getLiveSession();
        const mine = getSessionId();
        if (live && mine && live.sessionId === mine) {
          return;
        }
        this.emitSessionReplaced();
        return;
      }
      if (!parsed.type.startsWith("presence.")) {
        clearQueryCache();
      }
      for (const listener of this.listeners) {
        try {
          listener(parsed);
        } catch {
          /* a bad listener must not kill the stream */
        }
      }
    };

    es.onerror = () => {
      es.close();
      if (this.source === es) this.source = null;
      void fetchMe()
        .then(() => {
          if (liveSessionReplacedThisTab()) {
            this.emitSessionReplaced();
            return;
          }
          this.scheduleReconnect();
        })
        .catch((err: unknown) => {
          const apiErr = err instanceof ApiError ? err : null;
          if (
            apiErr?.status === 401 ||
            (apiErr != null &&
              isSessionReplacedError(apiErr.status, apiErr.message))
          ) {
            this.emitSessionReplaced();
            return;
          }
          this.scheduleReconnect();
        });
    };
  }

  private scheduleReconnect(delay?: number) {
    if (this.reconnectTimer !== null) return;
    const wait = delay ?? this.retryDelay;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, wait);
    if (delay === undefined) {
      this.retryDelay = Math.min(this.maxDelay, this.retryDelay * 2);
    }
  }

  private reconnect() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    this.retryDelay = 1000;
    this.connect();
  }
}

export const realtime = new RealtimeClient();

/** Convenience for React effects. Returns an unsubscribe fn. */
export function subscribeRealtime(listener: Listener): () => void {
  return realtime.subscribe(listener);
}
