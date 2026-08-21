export const PORTAL_WEBSITES = [
  "ACSRPL Australia",
  "ACSRPL Report",
  "ACSRPL Writing",
  "Best CDR Writer",
  "CCL Hub",
  "CDRAssessment Help",
  "CDR Australia Expert",
  "CDR Australia Group",
  "CDR Australia Help",
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
  "Migration Skills Australia",
  "Nepali Naati CCL",
  "PTE Hub",
  "Report Champs",
  "Report Insiders",
  "Top CDR Australia",
  "Write My CDR",
] as const;

export const PORTAL_OTHER = "Other — not in list";

export const LEAD_SOURCES = [
  "Meta WhatsApp",
  "Meta Messenger",
  "Website WhatsApp",
  "Meta Lead Form",
  "Website Download Form",
  "G.WhatsApp(CAM/CWA/CRW)",
  "Google LeadForm",
] as const;

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
