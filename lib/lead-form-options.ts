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
  { value: "NOT_QUALIFIED", label: "Not Qualified" },
  { value: "IRRELEVANT", label: "Irrelevant" },
] as const;

export type QualificationValue = (typeof QUALIFICATION_OPTIONS)[number]["value"];

export function isAssignableQualification(status: string | null | undefined) {
  return (
    status === "QUALIFIED" ||
    status === "QUALIFIED_CHAT" ||
    status === "QUALIFIED_CALL"
  );
}

export function qualificationLabel(status: string | null | undefined) {
  const match = QUALIFICATION_OPTIONS.find((option) => option.value === status);
  return match?.label ?? (status ? status.replace(/_/g, " ") : "—");
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
