import { hasSessionMarker } from "@/lib/auth-token";

/** Same-origin proxy to the isolated telemetry service (:9081). */
export const TELEMETRY_BASE = (
  process.env.NEXT_PUBLIC_TELEMETRY_URL ?? "/telemetry"
).replace(/\/$/, "");

export type SupportStatusTotal = {
  statusCode: number;
  count: number;
};

export type SupportStatusBucket = {
  hour: string;
  statusCode: number;
  count: number;
};

export type SupportKindBucket = {
  hour: string;
  kind: string;
  count: number;
};

export type SupportIncident = {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  reason: string;
  open: boolean;
};

export type SupportEvent = {
  id: string;
  occurredAt: string;
  kind: string;
  severity: string;
  source: string;
  statusCode?: number | null;
  path?: string;
  method?: string;
  userId?: string;
  userEmail?: string;
  message?: string;
};

export type SupportOverview = {
  generatedAt: string;
  activeUsers: number;
  concurrentUsers: number;
  platformStatus: string;
  openDowntimeMinutes: number;
  downtimeEvents24h: number;
  connectionBreaks24h: number;
  serverRestarts24h: number;
  httpErrors24h: number;
  statusTotals24h: SupportStatusTotal[];
  statusSeries24h: SupportStatusBucket[];
  connectionSeries24h: SupportKindBucket[];
  incidents: SupportIncident[];
  recentEvents: SupportEvent[];
};

type IngestEvent = {
  kind: string;
  severity?: string;
  source?: string;
  statusCode?: number;
  path?: string;
  method?: string;
  message?: string;
  userId?: string;
  userEmail?: string;
};

function sessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "lf.telemetry.session";
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

async function telemetryFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${TELEMETRY_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
}

/** Fire-and-forget client beacon — never throws into UI flows. */
export function emitTelemetry(events: IngestEvent | IngestEvent[]) {
  if (typeof window === "undefined") return;
  if (!hasSessionMarker()) return;
  const list = Array.isArray(events) ? events : [events];
  if (list.length === 0) return;
  void fetch(`${TELEMETRY_BASE}/v1/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      events: list.map((e) => ({
        source: e.source ?? "ui",
        ...e,
      })),
    }),
    keepalive: true,
    cache: "no-store",
  }).catch(() => {
    /* swallow */
  });
}

export function emitHttpStatus(status: number, path: string, method = "GET") {
  if (status === 401) return;
  emitTelemetry({
    kind: "http_status",
    severity: status >= 500 ? "error" : "warn",
    statusCode: status,
    path,
    method,
    message: `HTTP ${status}`,
  });
}

export function emitConnectionBreak(message: string, path = "/api/events") {
  emitTelemetry({
    kind: "connection_break",
    severity: "error",
    path,
    method: "GET",
    message,
  });
}

export async function sendHeartbeat(): Promise<void> {
  try {
    await telemetryFetch("/v1/heartbeat", {
      method: "POST",
      body: JSON.stringify({ sessionId: sessionId() }),
    });
  } catch {
    /* ignore */
  }
}

export async function fetchSupportOverview(
  signal?: AbortSignal,
): Promise<SupportOverview> {
  const res = await telemetryFetch("/v1/support/overview", { signal });
  if (!res.ok) {
    throw new Error(`Failed to load support overview (${res.status})`);
  }
  return (await res.json()) as SupportOverview;
}

export async function fetchSupportEvents(
  limit = 50,
  signal?: AbortSignal,
): Promise<SupportEvent[]> {
  const res = await telemetryFetch(
    `/v1/support/events?limit=${encodeURIComponent(String(limit))}`,
    { signal },
  );
  if (!res.ok) {
    throw new Error(`Failed to load support events (${res.status})`);
  }
  const data = (await res.json()) as { items?: SupportEvent[] };
  return data.items ?? [];
}
