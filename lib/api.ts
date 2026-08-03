import type { CreateLeadPayload } from "@/lib/lead-form-options";
import type { LeadRecord } from "@/lib/leads-data";
import { clearAuthToken } from "@/lib/auth-token";
import {
  clearQueryCache,
  readQueryCache,
  writeQueryCache,
} from "@/lib/query-cache";

export const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ?? ""
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
  skipAuthRedirect?: boolean;
};

let handlingUnauthorized = false;

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  clearAuthToken();
  // Best-effort cookie clear (HttpOnly cookie is cleared by the API).
  void fetch(`${BACKEND_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  }).catch(() => {
    /* ignore */
  });
  // Drop in-memory session data before hard redirect (avoids flash of prior user).
  void import("@/lib/reset-client-state")
    .then((m) => m.resetClientState())
    .catch(() => {
      /* ignore */
    });
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(
    `/login?next=${encodeURIComponent(next || "/")}`,
  );
}

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { auth = true, skipAuthRedirect = false, headers, signal, ...rest } =
    options;
  const nextHeaders = new Headers(headers);
  // Auth is the HttpOnly cookie via credentials: "include" (no Bearer in JS).
  // Let the browser set multipart boundaries for FormData uploads.
  const isFormData =
    typeof FormData !== "undefined" && rest.body instanceof FormData;
  if (rest.body && !isFormData && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  // Bound hung requests so UI state machines never wait forever under load.
  const timeoutMs = 20_000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const onOuterAbort = () => timeoutController.abort();
  if (signal) {
    if (signal.aborted) timeoutController.abort();
    else signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    const res = await fetch(
      path.startsWith("http") ? path : `${BACKEND_URL}${path}`,
      {
        ...rest,
        signal: timeoutController.signal,
        headers: nextHeaders,
        credentials: "include",
        cache: "no-store",
      },
    );

    if (res.status === 401 && auth && !skipAuthRedirect) {
      redirectToLogin();
    } else if (res.status >= 400 && auth) {
      // Silent ops beacon — never blocks the caller.
      const beaconPath = path.startsWith("http")
        ? new URL(path).pathname
        : path.split("?")[0] || path;
      void import("@/lib/telemetry-api")
        .then((m) =>
          m.emitHttpStatus(res.status, beaconPath, rest.method || "GET"),
        )
        .catch(() => {
          /* ignore */
        });
    }
    return res;
  } catch (err) {
    const aborted =
      (typeof DOMException !== "undefined" &&
        err instanceof DOMException &&
        err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError");
    if (auth && !aborted) {
      const beaconPath = path.startsWith("http")
        ? (() => {
            try {
              return new URL(path).pathname;
            } catch {
              return path;
            }
          })()
        : path.split("?")[0] || path;
      void import("@/lib/telemetry-api")
        .then((m) =>
          m.emitConnectionBreak(
            err instanceof Error ? err.message : "network failure",
            beaconPath,
          ),
        )
        .catch(() => {
          /* ignore */
        });
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * GET + JSON with a short client-side TTL cache. Used for aggregate endpoints
 * (summaries, buckets, geo…) so tab back-navigation renders instantly without
 * refetching identical data. The cache is cleared on every realtime event and
 * on login/logout, so mutations are always reflected immediately.
 */
async function getJSONCached<T>(
  path: string,
  ttlMs: number,
  signal: AbortSignal | undefined,
  errorLabel: string,
): Promise<T> {
  const cached = readQueryCache<T>(path, ttlMs);
  if (cached !== undefined) return cached;
  const res = await apiFetch(path, { signal });
  if (!res.ok) {
    throw new Error(`${errorLabel} (${res.status})`);
  }
  const data = (await res.json()) as T;
  writeQueryCache(path, data);
  return data;
}

async function readApiError(
  res: Response,
  fallback: string,
): Promise<ApiError> {
  try {
    const body = (await res.json()) as {
      error?: string;
      errors?: Array<{ field?: string; message?: string }>;
    };
    const fields: Record<string, string> = {};
    if (Array.isArray(body.errors)) {
      for (const item of body.errors) {
        if (item.field && item.message) fields[item.field] = item.message;
      }
    }
    return new ApiError(body.error || fallback, res.status, fields);
  } catch {
    return new ApiError(fallback, res.status);
  }
}

export type BackendHealth = {
  status: "ok" | "degraded" | string;
  service: string;
  database: string;
  time: string;
};

export type LeadListResponse = {
  items: LeadRecord[];
  nextCursor?: string;
  hasMore: boolean;
  total: number;
  limit: number;
  filter: string;
  sort: string;
  query?: string;
};

export type NamedCount = {
  name: string;
  count: number;
};

export type TeamLeadCount = {
  id: string;
  name: string;
  count: number;
};

export type AnalystLeadStats = {
  id: string;
  name: string;
  email: string;
  total: number;
  qualified: number;
  notQualified: number;
  irrelevant: number;
};

export type SalesExecOutcome = {
  id: string;
  name: string;
  assigned: number;
  withRep: number;
  won: number;
  lost: number;
};

export type StatusReasonCount = {
  status: string;
  reason: string;
  count: number;
};

export type AttributionStats = {
  name: string;
  total: number;
  won: number;
  /** Won / total * 100 */
  conversion: number;
};

export type LeadSummary = {
  activeUsers: number;
  leadsTotal: number;
  irrelevantLeads: number;
  qualifiedLeads: number;
  notQualifiedLeads: number;
  totalPassed: number;
  /** Currently in salesStage WITH_TEAM_LEAD (matches leads stage filter). */
  withTeamLeads: number;
  /** Currently in salesStage WITH_EXECUTIVE (matches leads stage filter). */
  withSalesExecs: number;
  totalLost: number;
  closedRevenue: number;
  totalWon: number;
  noResponse: number;
  openLeads: number;
  dealValueSum: number;
  leadsLast7Days: number;
  qualificationMix: NamedCount[];
  teamMix: TeamLeadCount[];
  /** Small enum mix kept on KPI payload; high-cardinality mixes use buckets. */
  sourceMix: AttributionStats[];
};

export type SummaryBucketDimension =
  | "reasons"
  | "portal"
  | "metaProfile"
  | "source"
  | "analyst"
  | "salesExec";

export type SummaryBucketPage<T> = {
  dimension: string;
  offset: number;
  limit: number;
  hasMore: boolean;
  bucketCount: number;
  leadTotal: number;
  wonTotal?: number;
  items: T[];
};

export type FetchLeadsParams = {
  filter?: string;
  sort?: string;
  q?: string;
  field?: string;
  cursor?: string;
  limit?: number;
  country?: string;
  city?: string;
  teamId?: string;
  analystId?: string;
  salesExecId?: string;
  source?: string;
  portal?: string;
  metaProfile?: string;
  status?: string;
  stage?: string;
  reason?: string;
  addedFrom?: string;
  addedTo?: string;
  signal?: AbortSignal;
};

export async function fetchBackendHealth(
  signal?: AbortSignal,
): Promise<BackendHealth> {
  const res = await fetch(`${BACKEND_URL}/health`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return (await res.json()) as BackendHealth;
}

export async function fetchLeads(
  params: FetchLeadsParams = {},
): Promise<LeadListResponse> {
  const sp = new URLSearchParams();
  if (params.filter) sp.set("filter", params.filter);
  if (params.sort) sp.set("sort", params.sort);
  if (params.q) sp.set("q", params.q);
  if (params.field) sp.set("field", params.field);
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.country) sp.set("country", params.country);
  if (params.city) sp.set("city", params.city);
  if (params.teamId) sp.set("teamId", params.teamId);
  if (params.analystId) sp.set("analystId", params.analystId);
  if (params.salesExecId) sp.set("salesExecId", params.salesExecId);
  if (params.source) sp.set("source", params.source);
  if (params.portal) sp.set("portal", params.portal);
  if (params.metaProfile) sp.set("metaProfile", params.metaProfile);
  if (params.status) sp.set("status", params.status);
  if (params.stage) sp.set("stage", params.stage);
  if (params.reason) sp.set("reason", params.reason);
  if (params.addedFrom) sp.set("addedFrom", params.addedFrom);
  if (params.addedTo) sp.set("addedTo", params.addedTo);

  const qs = sp.toString();
  const res = await apiFetch(`/api/leads${qs ? `?${qs}` : ""}`, {
    signal: params.signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to load leads (${res.status})`);
  }
  return (await res.json()) as LeadListResponse;
}

export type AssignableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  teamId: string | null;
  teamName: string | null;
};

export async function fetchAssignableUsers(
  type: "team-leads" | "members",
  signal?: AbortSignal,
): Promise<AssignableUser[]> {
  const res = await apiFetch(
    `/api/assignable-users?type=${encodeURIComponent(type)}`,
    { signal },
  );
  if (!res.ok) {
    throw await readApiError(
      res,
      `Failed to load assignable users (${res.status})`,
    );
  }
  const data = (await res.json()) as { users?: AssignableUser[] };
  return Array.isArray(data.users) ? data.users : [];
}

export type LeadAssignmentResult = {
  leadId: string;
  team: string;
  salesExecutive: string;
  handoff: string;
};

export type AssignLeadsResult = {
  updated: number;
  assignments: LeadAssignmentResult[];
};

export async function assignLeads(
  payload: {
    leadIds: string[];
    assigneeId: string;
    kind: "team-lead" | "member";
  },
  signal?: AbortSignal,
): Promise<AssignLeadsResult> {
  const res = await apiFetch(`/api/leads/assign`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let message = `Failed to assign leads (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const data = (await res.json()) as {
    updated?: number;
    assignments?: LeadAssignmentResult[];
  };
  return {
    updated: typeof data.updated === "number" ? data.updated : 0,
    assignments: Array.isArray(data.assignments) ? data.assignments : [],
  };
}

export async function deleteLeads(
  leadIds: string[],
  signal?: AbortSignal,
): Promise<{ deleted: number }> {
  const res = await apiFetch(`/api/leads`, {
    method: "DELETE",
    body: JSON.stringify({ leadIds }),
    signal,
  });
  if (!res.ok) {
    let message = `Failed to delete leads (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as { deleted: number };
}

export type LeadDetail = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  portalWebsite: string | null;
  source: string;
  facebookProfile: string | null;
  language: string | null;
  clientProfile: string | null;
  qualificationStatus: string;
  leadScore: number | null;
  createdAt: string;
  notes: string | null;
  firstClientMessageAt?: string | null;
  firstAgentMessageAt?: string | null;
  /** Derived minutes between client and agent first messages. */
  firstResponseMinutes?: number | null;
  firstResponseProofPath?: string | null;
  salesStage?: string;
  salesStageLabel?: string;
  initialPayment?: number | null;
  closedRevenue?: number | null;
  estimatedDealValue?: number | null;
  dealValue?: number | null;
  dealValueDisplay?: string;
  dealCurrency?: string;
  executiveNotes?: string | null;
  closed?: string;
  notAppropriate?: boolean;
  notAppropriateReason?: string | null;
  notAppropriateAt?: string | null;
};

export type FirstResponseProofUpload = {
  path: string;
  filename: string;
  mime: string;
  size: number;
};

export async function uploadFirstResponseProof(
  file: File,
  signal?: AbortSignal,
): Promise<FirstResponseProofUpload> {
  const body = new FormData();
  body.append("file", file);
  const res = await apiFetch("/api/uploads/first-response-proof", {
    method: "POST",
    body,
    signal,
  });
  if (!res.ok) {
    throw await readApiError(res, `Failed to upload screenshot (${res.status})`);
  }
  return (await res.json()) as FirstResponseProofUpload;
}

export type SalesOutcomePayload = {
  salesStage?: string;
  initialPayment?: number | null;
  closedRevenue?: number | null;
  executiveNotes?: string | null;
};

export async function updateLeadSalesOutcome(
  id: string,
  payload: SalesOutcomePayload,
  signal?: AbortSignal,
): Promise<LeadDetail> {
  const res = await apiFetch(`/api/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let message = `Failed to update sales outcome (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as LeadDetail;
}

export async function markLeadNotAppropriate(
  id: string,
  reason: string,
  signal?: AbortSignal,
): Promise<LeadDetail> {
  const res = await apiFetch(`/api/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      notAppropriate: true,
      notAppropriateReason: reason,
    }),
    signal,
  });
  if (!res.ok) {
    let message = `Failed to mark lead as not appropriate (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as LeadDetail;
}

export async function fetchLead(
  id: string,
  signal?: AbortSignal,
): Promise<LeadDetail> {
  const res = await apiFetch(`/api/leads/${encodeURIComponent(id)}`, {
    signal,
  });
  if (!res.ok) {
    let message = `Failed to load lead (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as LeadDetail;
}

export async function lookupLeadContact(
  params: {
    phone?: string;
    excludeId?: string;
  },
  signal?: AbortSignal,
): Promise<{
  /** Phone number already exists on some lead (informational). */
  exists: boolean;
  id?: string;
  leadName?: string;
  teamName?: string;
  matchedOn?: string;
  /** Portals already used with this phone on the platform. */
  existingPortals?: string[];
  /** Sources already used with this phone on the platform. */
  existingSources?: string[];
}> {
  const sp = new URLSearchParams();
  if (params.phone?.trim()) sp.set("phone", params.phone.trim());
  if (params.excludeId?.trim()) sp.set("excludeId", params.excludeId.trim());
  if (!sp.get("phone")) {
    return { exists: false };
  }
  const res = await apiFetch(`/api/leads/contact-lookup?${sp.toString()}`, {
    signal,
  });
  if (!res.ok) {
    throw await readApiError(res, `Failed to check contact (${res.status})`);
  }
  return (await res.json()) as {
    exists: boolean;
    id?: string;
    leadName?: string;
    teamName?: string;
    matchedOn?: string;
    existingPortals?: string[];
    existingSources?: string[];
  };
}

export async function createLead(
  payload: CreateLeadPayload,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  const res = await apiFetch(`/api/leads`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let message = `Failed to create lead (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as { id: string };
}

export async function updateLeadQualification(
  id: string,
  qualificationStatus: string,
  signal?: AbortSignal,
): Promise<{ id: string; qualificationStatus: string; status: string }> {
  const res = await apiFetch(`/api/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ qualificationStatus }),
    signal,
  });
  if (!res.ok) {
    throw await readApiError(res, "Failed to update qualification");
  }
  return (await res.json()) as {
    id: string;
    qualificationStatus: string;
    status: string;
  };
}

export async function updateLead(
  id: string,
  payload: CreateLeadPayload,
  signal?: AbortSignal,
): Promise<{ id: string; updated: boolean }> {
  const res = await apiFetch(`/api/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let message = `Failed to update lead (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as { id: string; updated: boolean };
}

export async function fetchLeadsSummary(
  params: {
    country?: string;
    city?: string;
    filter?: string;
    teamId?: string;
    analystId?: string;
    salesExecId?: string;
    source?: string;
    portal?: string;
    metaProfile?: string;
    status?: string;
    stage?: string;
    addedFrom?: string;
    addedTo?: string;
    signal?: AbortSignal;
  } = {},
): Promise<LeadSummary> {
  const sp = new URLSearchParams();
  if (params.country) sp.set("country", params.country);
  if (params.city) sp.set("city", params.city);
  if (params.filter && params.filter !== "all") sp.set("filter", params.filter);
  if (params.teamId) sp.set("teamId", params.teamId);
  if (params.analystId) sp.set("analystId", params.analystId);
  if (params.salesExecId) sp.set("salesExecId", params.salesExecId);
  if (params.source) sp.set("source", params.source);
  if (params.portal) sp.set("portal", params.portal);
  if (params.metaProfile) sp.set("metaProfile", params.metaProfile);
  if (params.status) sp.set("status", params.status);
  if (params.stage) sp.set("stage", params.stage);
  if (params.addedFrom) sp.set("addedFrom", params.addedFrom);
  if (params.addedTo) sp.set("addedTo", params.addedTo);
  const qs = sp.toString();
  return getJSONCached<LeadSummary>(
    `/api/leads/summary${qs ? `?${qs}` : ""}`,
    15_000,
    params.signal,
    "Failed to load leads summary",
  );
}

export type KpiItem = {
  id: string;
  label: string;
  description: string;
  formula?: string;
  available: boolean;
  unavailableReason?: string;
  numerator?: number;
  denominator?: number;
  rate?: number;
  value?: number;
  unit?: string;
  direction?: "higher_better" | "lower_better" | "info" | string;
  targetValue?: number | null;
  benchmarkValue?: number | null;
  teamWeight?: number | null;
  supervisorWeight?: number | null;
  teamAligned?: boolean;
  supervisorAligned?: boolean;
  metTarget?: boolean | null;
  metBenchmark?: boolean | null;
};

export type KpiSnapshot = {
  items: KpiItem[];
  notAppropriateCount?: number;
};

export type KpiTargetConfig = {
  key: string;
  label: string;
  description: string;
  formula?: string;
  unit: string;
  direction: string;
  targetValue: number | null;
  benchmarkValue: number | null;
  teamWeight: number | null;
  supervisorWeight: number | null;
  teamAligned: boolean;
  supervisorAligned: boolean;
  sortOrder: number;
  updatedAt: string;
};

export async function fetchKPI(
  params: {
    country?: string;
    city?: string;
    filter?: string;
    teamId?: string;
    analystId?: string;
    salesExecId?: string;
    managerId?: string;
    source?: string;
    portal?: string;
    status?: string;
    stage?: string;
    addedFrom?: string;
    addedTo?: string;
    signal?: AbortSignal;
  } = {},
): Promise<KpiSnapshot> {
  const sp = new URLSearchParams();
  if (params.country) sp.set("country", params.country);
  if (params.city) sp.set("city", params.city);
  if (params.filter && params.filter !== "all") sp.set("filter", params.filter);
  if (params.teamId) sp.set("teamId", params.teamId);
  if (params.analystId) sp.set("analystId", params.analystId);
  if (params.salesExecId) sp.set("salesExecId", params.salesExecId);
  if (params.managerId) sp.set("managerId", params.managerId);
  if (params.source) sp.set("source", params.source);
  if (params.portal) sp.set("portal", params.portal);
  if (params.status) sp.set("status", params.status);
  if (params.stage) sp.set("stage", params.stage);
  if (params.addedFrom) sp.set("addedFrom", params.addedFrom);
  if (params.addedTo) sp.set("addedTo", params.addedTo);
  const qs = sp.toString();
  return getJSONCached<KpiSnapshot>(
    `/api/kpi${qs ? `?${qs}` : ""}`,
    15_000,
    params.signal,
    "Failed to load KPI",
  );
}

export async function fetchKpiTargets(
  signal?: AbortSignal,
): Promise<KpiTargetConfig[]> {
  const res = await apiFetch("/api/kpi/targets", { method: "GET", signal });
  if (!res.ok) {
    throw await readApiError(res, "Failed to load KPI targets");
  }
  const data = (await res.json()) as { items?: KpiTargetConfig[] };
  return data.items ?? [];
}

export async function updateKpiTargets(
  items: Array<{
    key: string;
    targetValue: number | null;
    benchmarkValue: number | null;
    teamWeight: number | null;
    supervisorWeight: number | null;
  }>,
): Promise<KpiTargetConfig[]> {
  const res = await apiFetch("/api/kpi/targets", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    throw await readApiError(res, "Failed to update KPI targets");
  }
  clearQueryCache();
  const data = (await res.json()) as { items?: KpiTargetConfig[] };
  return data.items ?? [];
}

export type PipelineSummary = {
  assignedInternal: number;
  inProgress: number;
  closedWon: number;
  closedLost: number;
  total: number;
};

export async function fetchPipelineSummary(
  params: {
    country?: string;
    city?: string;
    signal?: AbortSignal;
  } = {},
): Promise<PipelineSummary> {
  const sp = new URLSearchParams();
  if (params.country) sp.set("country", params.country);
  if (params.city) sp.set("city", params.city);
  const qs = sp.toString();
  return getJSONCached<PipelineSummary>(
    `/api/leads/pipeline/summary${qs ? `?${qs}` : ""}`,
    15_000,
    params.signal,
    "Failed to load pipeline summary",
  );
}

export async function fetchSummaryBuckets<T>(params: {
  dimension: SummaryBucketDimension;
  status?: string;
  country?: string;
  city?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<SummaryBucketPage<T>> {
  const sp = new URLSearchParams();
  sp.set("dimension", params.dimension);
  if (params.status) sp.set("status", params.status);
  if (params.country) sp.set("country", params.country);
  if (params.city) sp.set("city", params.city);
  if (params.offset != null) sp.set("offset", String(params.offset));
  if (params.limit != null) sp.set("limit", String(params.limit));
  const body = await getJSONCached<SummaryBucketPage<T>>(
    `/api/leads/summary/buckets?${sp.toString()}`,
    15_000,
    params.signal,
    `Failed to load ${params.dimension} buckets`,
  );
  return {
    ...body,
    items: Array.isArray(body.items) ? body.items : [],
  };
}

export type GeoOptionsResponse = {
  type: "countries" | "cities";
  country?: string;
  items: NamedCount[];
};

export async function fetchGeographyMix(params: {
  country?: string;
  city?: string;
  signal?: AbortSignal;
} = {}): Promise<{ items: NamedCount[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.country) sp.set("country", params.country);
  if (params.city) sp.set("city", params.city);
  const qs = sp.toString();
  return getJSONCached<{ items: NamedCount[]; total: number }>(
    `/api/leads/geography${qs ? `?${qs}` : ""}`,
    30_000,
    params.signal,
    "Failed to load geography",
  );
}

export async function fetchGeoOptions(params: {
  type?: "countries" | "cities";
  country?: string;
  signal?: AbortSignal;
} = {}): Promise<GeoOptionsResponse> {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.country) sp.set("country", params.country);
  const qs = sp.toString();
  return getJSONCached<GeoOptionsResponse>(
    `/api/leads/geo-options${qs ? `?${qs}` : ""}`,
    60_000,
    params.signal,
    "Failed to load geo options",
  );
}

export type TimeBucketCount = {
  key: string;
  label: string;
  count: number;
};

export type AddedSeriesResponse = {
  granularity: "day" | "month" | string;
  items: TimeBucketCount[];
  total: number;
  peak: number;
  average: number;
};

export async function fetchLeadsAddedSeries(params: {
  granularity?: "day" | "month";
  country?: string;
  city?: string;
  signal?: AbortSignal;
} = {}): Promise<AddedSeriesResponse> {
  const sp = new URLSearchParams();
  if (params.granularity) sp.set("granularity", params.granularity);
  if (params.country) sp.set("country", params.country);
  if (params.city) sp.set("city", params.city);
  const qs = sp.toString();
  return getJSONCached<AddedSeriesResponse>(
    `/api/leads/added-series${qs ? `?${qs}` : ""}`,
    30_000,
    params.signal,
    "Failed to load added series",
  );
}

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  teamId: string | null;
  teamName: string | null;
  analystTeamName: string | null;
  managerId: string | null;
  managerName: string | null;
  isOutboundAnalyst: boolean;
  /** Account enabled — inactive users cannot log in; data is kept. */
  isActive: boolean;
  isActiveSession: boolean;
  activeSessionSetAt: string | null;
  image: string | null;
  mustResetPassword: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UsersListResponse = {
  users: PublicUser[];
  total: number;
};

export async function fetchUsers(
  signal?: AbortSignal,
): Promise<UsersListResponse> {
  const res = await apiFetch(`/api/users`, {
    signal,
  });
  if (!res.ok) {
    throw await readApiError(res, `Failed to load users (${res.status})`);
  }
  return (await res.json()) as UsersListResponse;
}

export type AuthResponse = {
  /** Present for API clients; browsers must not persist this. */
  token?: string;
  expiresAt: string;
  user: PublicUser;
};

export type RoleOption = {
  value: string;
  label: string;
};

export async function loginRequest(
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<AuthResponse> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    auth: false,
    skipAuthRedirect: true,
    body: JSON.stringify({ email, password }),
    signal,
  });
  if (!res.ok) {
    throw await readApiError(res, "Login failed");
  }
  return (await res.json()) as AuthResponse;
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", {
      method: "POST",
      auth: false,
      skipAuthRedirect: true,
    });
  } catch {
    /* cookie clear is best-effort */
  }
}

export async function fetchMe(signal?: AbortSignal): Promise<PublicUser> {
  const res = await apiFetch("/api/auth/me", {
    signal,
    skipAuthRedirect: true,
  });
  if (!res.ok) {
    throw await readApiError(res, "Session expired");
  }
  const data = (await res.json()) as { user: PublicUser };
  return data.user;
}

export async function fetchRoles(
  signal?: AbortSignal,
): Promise<RoleOption[]> {
  const res = await apiFetch("/api/roles", { signal });
  if (!res.ok) {
    throw await readApiError(res, "Failed to load roles");
  }
  const data = (await res.json()) as { roles?: RoleOption[] };
  return Array.isArray(data.roles) ? data.roles : [];
}

export async function createUserRequest(
  payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    teamId?: string | null;
    teamName?: string | null;
  },
  signal?: AbortSignal,
): Promise<{ user: PublicUser; temporaryPassword?: string }> {
  const body: Record<string, unknown> = {
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: payload.role,
  };
  if (payload.teamId) body.teamId = payload.teamId;
  if (payload.teamName?.trim()) body.teamName = payload.teamName.trim();
  const res = await apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw await readApiError(res, "Failed to create user");
  }
  const data = (await res.json()) as {
    user: PublicUser;
    temporaryPassword?: string;
  };
  return {
    user: data.user,
    temporaryPassword:
      typeof data.temporaryPassword === "string"
        ? data.temporaryPassword
        : payload.password,
  };
}

export async function updateUserRequest(
  id: string,
  payload: {
    name: string;
    email: string;
    role: string;
    password?: string | null;
    mustResetPassword?: boolean;
  },
  signal?: AbortSignal,
): Promise<{ user: PublicUser; temporaryPassword?: string }> {
  const body: Record<string, unknown> = {
    name: payload.name,
    email: payload.email,
    role: payload.role,
  };
  if (payload.password != null && payload.password.trim() !== "") {
    body.password = payload.password;
  }
  if (typeof payload.mustResetPassword === "boolean") {
    body.mustResetPassword = payload.mustResetPassword;
  }
  const res = await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw await readApiError(res, "Failed to update user");
  }
  const data = (await res.json()) as {
    user: PublicUser;
    temporaryPassword?: string;
  };
  return {
    user: data.user,
    temporaryPassword:
      typeof data.temporaryPassword === "string"
        ? data.temporaryPassword
        : undefined,
  };
}

export async function setUserActiveRequest(
  id: string,
  isActive: boolean,
  signal?: AbortSignal,
): Promise<PublicUser> {
  const res = await apiFetch(
    `/api/users/${encodeURIComponent(id)}/active`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
      signal,
    },
  );
  if (!res.ok) {
    throw await readApiError(res, "Failed to update account status");
  }
  const data = (await res.json()) as { user: PublicUser };
  return data.user;
}

export async function deleteUserRequest(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    signal,
  });
  if (!res.ok) {
    throw await readApiError(res, "Failed to delete user");
  }
}

export type TeamBrief = {
  id: string;
  name: string;
};

export async function fetchTeams(signal?: AbortSignal): Promise<TeamBrief[]> {
  const res = await apiFetch("/api/teams", { signal });
  if (!res.ok) {
    throw await readApiError(res, "Failed to load teams");
  }
  const data = (await res.json()) as { teams?: TeamBrief[] };
  return Array.isArray(data.teams) ? data.teams : [];
}

export async function transferSalesExecRequest(
  id: string,
  payload: { toTeamId: string; expectedTeamId?: string | null },
  signal?: AbortSignal,
): Promise<{
  user: PublicUser;
  leadsMoved: number;
  transferId: string;
  fromTeamId: string | null;
  toTeamId: string;
}> {
  const body: Record<string, unknown> = {
    toTeamId: payload.toTeamId,
  };
  if (payload.expectedTeamId) {
    body.expectedTeamId = payload.expectedTeamId;
  }
  const res = await apiFetch(
    `/api/users/${encodeURIComponent(id)}/transfer-team`,
    {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    },
  );
  if (!res.ok) {
    throw await readApiError(res, "Failed to transfer sales executive");
  }
  return (await res.json()) as {
    user: PublicUser;
    leadsMoved: number;
    transferId: string;
    fromTeamId: string | null;
    toTeamId: string;
  };
}

export type SalesExecTeamTransferLog = {
  id: string;
  salesExecId: string;
  salesExecName: string;
  fromTeamId: string | null;
  fromTeamName: string | null;
  toTeamId: string;
  toTeamName: string;
  transferredById: string;
  transferredByName: string;
  createdAt: string;
};

export type LeadTransferLog = {
  id: string;
  leadId: string;
  leadName: string;
  action: string;
  actionLabel: string;
  actorId: string | null;
  actorName: string | null;
  detail: string | null;
  createdAt: string;
};

export type TransferActionMix = {
  action: string;
  label: string;
  count: number;
};

export type TransfersPageResponse = {
  type: "leads" | "sales-exec";
  items: (LeadTransferLog | SalesExecTeamTransferLog)[];
  total: number;
  nextCursor?: string;
  hasMore: boolean;
  limit: number;
  query?: string;
  action?: string;
  totals: {
    leads: number;
    salesExecTeam: number;
  };
  actionMix?: TransferActionMix[];
};

export async function fetchTransfersPage(params: {
  type: "leads" | "sales-exec";
  cursor?: string;
  q?: string;
  action?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<TransfersPageResponse> {
  const sp = new URLSearchParams();
  sp.set("type", params.type);
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.q) sp.set("q", params.q);
  if (params.action && params.action !== "all") sp.set("action", params.action);
  if (params.limit) sp.set("limit", String(params.limit));

  const res = await apiFetch(`/api/transfers?${sp.toString()}`, {
    signal: params.signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to load transfers (${res.status})`);
  }
  return (await res.json()) as TransfersPageResponse;
}

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  leadId?: string | null;
  href: string;
};

export type NotificationsResponse = {
  items: AppNotification[];
  unreadCount: number;
};

export async function fetchNotifications(
  params: { limit?: number; signal?: AbortSignal } = {},
): Promise<NotificationsResponse> {
  const sp = new URLSearchParams();
  if (params.limit) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  const res = await apiFetch(`/api/notifications${qs ? `?${qs}` : ""}`, {
    signal: params.signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to load notifications (${res.status})`);
  }
  const data = (await res.json()) as NotificationsResponse;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    unreadCount:
      typeof data.unreadCount === "number" ? data.unreadCount : 0,
  };
}

export async function markNotificationsRead(payload: {
  ids?: string[];
  all?: boolean;
}): Promise<{ updated: number }> {
  const res = await apiFetch(`/api/notifications/read`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to update notifications (${res.status})`);
  }
  return (await res.json()) as { updated: number };
}
