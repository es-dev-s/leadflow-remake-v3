/** Shared deep-link params for /leads from the dashboard. */

export type LeadsDeepLink = {
  filter?: string;
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
  /** Exact extracted qualification reason (matches dashboard reasons buckets). */
  reason?: string;
  /** Inclusive YYYY-MM-DD range for createdAt. */
  addedFrom?: string;
  addedTo?: string;
  q?: string;
  field?: string;
  /** Display labels for chips (optional). */
  label?: string;
};

const PARAM_KEYS = [
  "filter",
  "country",
  "city",
  "teamId",
  "analystId",
  "salesExecId",
  "source",
  "portal",
  "metaProfile",
  "status",
  "stage",
  "reason",
  "addedFrom",
  "addedTo",
  "q",
  "field",
] as const;

export function buildLeadsHref(link: LeadsDeepLink): string {
  const sp = new URLSearchParams();
  for (const key of PARAM_KEYS) {
    const value = link[key];
    if (typeof value === "string" && value.trim()) {
      sp.set(key, value.trim());
    }
  }
  const qs = sp.toString();
  return qs ? `/leads?${qs}` : "/leads";
}

export function parseLeadsDeepLink(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): LeadsDeepLink {
  const get = (key: string) => searchParams.get(key)?.trim() || undefined;
  return {
    filter: get("filter"),
    country: get("country"),
    city: get("city"),
    teamId: get("teamId"),
    analystId: get("analystId"),
    salesExecId: get("salesExecId"),
    source: get("source"),
    portal: get("portal"),
    metaProfile: get("metaProfile"),
    status: get("status"),
    stage: get("stage"),
    reason: get("reason"),
    addedFrom: get("addedFrom"),
    addedTo: get("addedTo"),
    q: get("q"),
    field: get("field"),
  };
}

export function deepLinkKey(link: LeadsDeepLink): string {
  return PARAM_KEYS.map((key) => `${key}=${link[key] ?? ""}`).join("&");
}

export function hasLeadFacets(link: LeadsDeepLink): boolean {
  return Boolean(
    link.country ||
      link.city ||
      link.teamId ||
      link.analystId ||
      link.salesExecId ||
      link.source ||
      link.portal ||
      link.metaProfile ||
      link.status ||
      link.stage ||
      link.reason ||
      link.addedFrom ||
      link.addedTo ||
      link.filter ||
      link.q ||
      link.field,
  );
}

/** Build deep-link for a chart bucket key: YYYY-MM-DD (day) or YYYY-MM (month). */
export function addedBucketDeepLink(key: string): LeadsDeepLink | null {
  const day = key.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { addedFrom: day, addedTo: day };
  }
  if (/^\d{4}-\d{2}$/.test(day)) {
    const [ys, ms] = day.split("-");
    const y = Number(ys);
    const m = Number(ms);
    if (!y || !m) return null;
    const last = new Date(y, m, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      addedFrom: `${ys}-${pad(m)}-01`,
      addedTo: `${ys}-${pad(m)}-${pad(last)}`,
    };
  }
  return null;
}

/** Map qualification mix keys → list filter or exact status. */
export function qualificationDeepLink(statusKey: string): LeadsDeepLink {
  switch (statusKey) {
    case "IRRELEVANT":
      return { filter: "irrelevant" };
    case "NOT_QUALIFIED":
      return { filter: "new" };
    case "QUALIFIED":
    case "QUALIFIED_CALL":
    case "QUALIFIED_CHAT":
      return { status: statusKey };
    default:
      return { status: statusKey };
  }
}
