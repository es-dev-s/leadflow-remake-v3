import { BACKEND_URL } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-token";
import { clearQueryCache } from "@/lib/query-cache";

export type RealtimeEvent = {
  type: string;
  leadId?: string;
  userId?: string;
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

  /** Call after login / logout so the stream re-auths with the new session. */
  refreshAuth() {
    const next = getAuthToken();
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

    const marker = getAuthToken();
    this.sessionMarker = marker;
    if (!marker) {
      this.scheduleReconnect(2000);
      return;
    }

    const url = `${BACKEND_URL}/api/events`;

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
      clearQueryCache();
      for (const listener of this.listeners) {
        try {
          listener(parsed);
        } catch {
          /* a bad listener must not kill the stream */
        }
      }
    };

    es.onerror = () => {
      void import("@/lib/telemetry-api")
        .then((m) =>
          m.emitConnectionBreak("realtime EventSource error", "/api/events"),
        )
        .catch(() => {
          /* ignore */
        });
      es.close();
      if (this.source === es) this.source = null;
      this.scheduleReconnect();
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
