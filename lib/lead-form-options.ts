export const PORTAL_WEBSITES_PRIMARY = [
  "ACSRPL Australia",
  "ACSRPL Report",
  "ACSRPL Writing",
  "CDR Assessment Help",
  "CDR Australia Migration",
  "CDR Australia Online",
  "CDR Australia Service",
  "CDR Australia VIP",
  "CDR For Engineer",
  "CDR Genius",
  "CDR Planet Australia",
  "CDR Report Writers",
  "CDR Review",
  "CDR Skill Assessment",
  "CDR Writers Australia",
  "CDR Writers Hub",
  "CDR Writing Expert",
  "Immidocs",
  "Migration Match",
  "Report Champs",
  "Top CDR Australia",
  "Write My CDR",
] as const;

export const PORTAL_WEBSITES_EDUCATIONAL = [
  "CCL HUB",
  "CCL HUB Website",
  "PTE HUB META",
  "PTE HUB WEBSITE",
  "NEPALI NAATI CCL",
] as const;

export const PORTAL_WEBSITES = [
  ...PORTAL_WEBSITES_PRIMARY,
  ...PORTAL_WEBSITES_EDUCATIONAL,
] as const;

const EDUCATIONAL_PORTAL_SET = new Set<string>(PORTAL_WEBSITES_EDUCATIONAL);

export function splitPortalFilterOptions(portals: string[]) {
  const primary: string[] = [];
  const found = new Set<string>();
  for (const portal of portals) {
    if (EDUCATIONAL_PORTAL_SET.has(portal)) found.add(portal);
    else primary.push(portal);
  }
  return {
    primary,
    educational: PORTAL_WEBSITES_EDUCATIONAL.filter((name) => found.has(name)),
  };
}

export const PORTAL_OTHER = "Other — not in list";

export const LEAD_SOURCES = [
  "Meta WhatsApp",
  "Website WhatsApp",
  "Meta Messenger",
  "Website Download Form",
  "Google Lead Form",
  "Support WA numbers",
] as const;

function compactAlphaNum(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sourceBase(raw: string) {
  const s = raw.trim();
  for (const sep of [" — ", " – ", " - ", "—", "–"] as const) {
    const i = s.indexOf(sep);
    if (i > 0) return s.slice(0, i).trim();
  }
  return s;
}

function portalLookupKey(raw: string) {
  let compact = compactAlphaNum(raw)
    .replace(/migartion/g, "migration")
    .replace(/assesement/g, "assessment")
    .replace(/writitng/g, "writing");
  for (let i = 0; i < 3; i += 1) {
    const next = compact.replace(
      /(websitedownloadform|comau|com|support)$/g,
      "",
    );
    if (next === compact) break;
    compact = next;
  }
  return compact;
}

const SOURCE_BY_KEY: Record<string, string> = {
  metawhatsapp: "Meta WhatsApp",
  websitewhatsapp: "Website WhatsApp",
  whatsappwebsite: "Website WhatsApp",
  metamessenger: "Meta Messenger",
  websitedownloadform: "Website Download Form",
  googleleadform: "Google Lead Form",
  gwhatsappcamcwacrw: "Support WA numbers",
  supportwanumbers: "Support WA numbers",
  supportwa: "Support WA numbers",
};

const PORTAL_BY_KEY: Record<string, string> = {
  cdraustraliamigartion: "CDR Australia Migration",
  cdrskillassesement: "CDR Skill Assessment",
  cdrwrititngexpert: "CDR Writing Expert",
  cdrassessmenthelp: "CDR Assessment Help",
  cdrreportwriter: "CDR Report Writers",
  acsrpwriting: "ACSRPL Writing",
  cclhub: "CCL HUB",
  cchlubwebsite: "CCL HUB Website",
  cclhubwebsite: "CCL HUB Website",
  ptehubmeta: "PTE HUB META",
  ptehubwebsite: "PTE HUB WEBSITE",
  nepalinaaticcl: "NEPALI NAATI CCL",
};

for (const name of LEAD_SOURCES) {
  SOURCE_BY_KEY[compactAlphaNum(name)] = name;
}
for (const name of PORTAL_WEBSITES) {
  PORTAL_BY_KEY[portalLookupKey(name)] = name;
  PORTAL_BY_KEY[compactAlphaNum(name)] = name;
}

const CANONICAL_SOURCE_SET = new Set<string>(LEAD_SOURCES);
const CANONICAL_PORTAL_SET = new Set<string>(PORTAL_WEBSITES);

function reservedFacet(raw: string) {
  const key = raw.trim().toLowerCase();
  return key === "none" || key === "unassigned" || key === "";
}

/** Map stored / legacy source strings onto the premium list. */
export function canonicalizeSource(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s || reservedFacet(s)) return s;
  if (CANONICAL_SOURCE_SET.has(s)) return s;
  const fromBase = SOURCE_BY_KEY[compactAlphaNum(sourceBase(s))];
  if (fromBase) return fromBase;
  const fromAll = SOURCE_BY_KEY[compactAlphaNum(s)];
  if (fromAll) return fromAll;
  const lower = s.toLowerCase();
  for (const name of LEAD_SOURCES) {
    const n = name.toLowerCase();
    if (lower === n || lower.startsWith(`${n} —`) || lower.startsWith(`${n} -`)) {
      return name;
    }
  }
  return s;
}

/** Map typos, .com variants, and spacing onto the portal list. */
export function canonicalizePortal(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s || reservedFacet(s)) return s;
  if (CANONICAL_PORTAL_SET.has(s)) return s;
  return (
    PORTAL_BY_KEY[portalLookupKey(s)] ||
    PORTAL_BY_KEY[compactAlphaNum(s)] ||
    [...PORTAL_WEBSITES].find((name) => name.toLowerCase() === s.toLowerCase()) ||
    s
  );
}

export function isCanonicalPortal(raw: string | null | undefined) {
  const mapped = canonicalizePortal(raw);
  return CANONICAL_PORTAL_SET.has(mapped);
}

export function isCanonicalSource(raw: string | null | undefined) {
  const mapped = canonicalizeSource(raw);
  return CANONICAL_SOURCE_SET.has(mapped);
}

export const QUALIFICATION_OPTIONS = [
  { value: "QUALIFIED", label: "Qualified" },
  { value: "QUALIFIED_CHAT", label: "Qualified - Chat" },
  { value: "QUALIFIED_CALL", label: "Qualified - Call" },
  { value: "PAID", label: "Paid" },
  { value: "ORGANIC", label: "Organic" },
  { value: "NOT_QUALIFIED", label: "Not Qualified" },
  { value: "IRRELEVANT", label: "Irrelevant" },
] as const;

export type QualificationValue = (typeof QUALIFICATION_OPTIONS)[number]["value"];

const ASSIGNABLE_QUALIFICATIONS = new Set<string>([
  "QUALIFIED",
  "QUALIFIED_CHAT",
  "QUALIFIED_CALL",
  "PAID",
  "ORGANIC",
]);

function compactQualificationKey(status: string) {
  return status
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Canonical code (PAID / ORGANIC / QUALIFIED_CHAT / …) or the trimmed input. */
export function normalizeQualification(
  status: string | null | undefined,
): string {
  const raw = String(status ?? "").trim();
  if (!raw) return "";
  if (ASSIGNABLE_QUALIFICATIONS.has(raw) || QUALIFICATION_OPTIONS.some((o) => o.value === raw)) {
    return raw;
  }
  const compact = compactQualificationKey(raw);
  const byValue = QUALIFICATION_OPTIONS.find((option) => option.value === compact);
  if (byValue) return byValue.value;
  const byLabel = QUALIFICATION_OPTIONS.find(
    (option) => option.label.toLowerCase() === raw.toLowerCase(),
  );
  return byLabel?.value ?? raw;
}

export function isAssignableQualification(status: string | null | undefined) {
  return ASSIGNABLE_QUALIFICATIONS.has(normalizeQualification(status));
}

export function assignableQualificationHint() {
  return "Only qualified leads can be assigned (Qualified, Chat, Call, Paid, Organic)";
}

export function qualificationLabel(status: string | null | undefined) {
  const code = normalizeQualification(status);
  const match = QUALIFICATION_OPTIONS.find((option) => option.value === code);
  return match?.label ?? (status ? String(status).replace(/_/g, " ") : "—");
}

export type CreateLeadPayload = {
  /** Optional — blank names are allowed. */
  fullName?: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  portalWebsite?: string;
  source: string;
  facebookProfile?: string;
  language?: string;
  clientProfile?: string;
  qualificationStatus: string;
  leadScore?: number;
  createdAt?: string;
  notes?: string;
  /** Local datetime of first customer message (YYYY-MM-DDTHH:mm). */
  firstClientMessageAt?: string | null;
  /** Local datetime of first agent reply (YYYY-MM-DDTHH:mm). */
  firstAgentMessageAt?: string | null;
  /** Public path from upload API, or empty string to clear. */
  firstResponseProofPath?: string | null;
};
