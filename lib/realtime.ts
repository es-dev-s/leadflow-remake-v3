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
 * Single shared SSE connection for the whole app. EventSource reconnects
 * automatically on network blips; we additionally guard against auth changes,
 * hard errors, and back-off so we never hammer the server under load.
 */
class RealtimeClient {
  private source: EventSource | null = null;
  private listeners = new Set<Listener>();
  private token: string | null = null;
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

  /** Call after login / logout so the stream re-auths with the new token. */
  refreshAuth() {
    const next = getAuthToken();
    if (next === this.token && this.source) return;
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
    // Browsers can silently drop a background SSE socket; re-verify on return.
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

    const token = getAuthToken();
    this.token = token;
    if (!token) {
      // Not signed in yet — retry shortly; cheap and bounded.
      this.scheduleReconnect(2000);
      return;
    }

    const url = `${BACKEND_URL}/api/events?access_token=${encodeURIComponent(
      token,
    )}`;

    let es: EventSource;
    try {
      es = new EventSource(url);
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
      // Something changed somewhere — cached aggregates are no longer trusted.
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
      // EventSource will try to reconnect on its own, but if the token is
      // stale (401) it loops forever. Close and reconnect with backoff so a
      // refreshed token is picked up.
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
