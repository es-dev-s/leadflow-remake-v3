export type LeadColumnId =
  | "source"
  | "portal"
  | "lead"
  | "analyst"
  | "tag"
  | "phone"
  | "email"
  | "clientProfile"
  | "location"
  | "analystNotes"
  | "status"
  | "score"
  | "stage"
  | "closed"
  | "closedDate"
  | "ip"
  | "executiveNotes"
  | "added"
  | "team"
  | "handoff"
  | "contact"
  | "duplicateCheck"
  | "dealValue"
  | "salesExecutive";

export type LeadColumnDef = {
  id: LeadColumnId;
  label: string;
  width: string;
};

/** Ordered to match the product lead-table list; extras kept at the end. */
export const LEAD_COLUMNS: LeadColumnDef[] = [
  { id: "source", label: "Source", width: "200px" },
  { id: "portal", label: "Portal", width: "240px" },
  { id: "lead", label: "Name", width: "170px" },
  { id: "analyst", label: "Analyst", width: "160px" },
  { id: "tag", label: "Tag", width: "100px" },
  { id: "phone", label: "Phone", width: "130px" },
  { id: "email", label: "Email", width: "200px" },
  { id: "clientProfile", label: "Client Profile", width: "180px" },
  { id: "location", label: "Location", width: "150px" },
  { id: "analystNotes", label: "Analyst Notes", width: "200px" },
  { id: "status", label: "Qualification", width: "168px" },
  { id: "score", label: "Score", width: "80px" },
  { id: "stage", label: "Sales Status", width: "140px" },
  { id: "closed", label: "Closed", width: "100px" },
  { id: "closedDate", label: "Closed date", width: "150px" },
  { id: "ip", label: "IP", width: "110px" },
  { id: "executiveNotes", label: "Executive Notes", width: "200px" },
  { id: "added", label: "Added", width: "140px" },
  { id: "team", label: "Route", width: "120px" },
  { id: "handoff", label: "Handoff", width: "220px" },
  // Existing extras (kept; hidden by default)
  { id: "contact", label: "Contact", width: "150px" },
  { id: "duplicateCheck", label: "Duplicate check", width: "140px" },
  { id: "dealValue", label: "Deal value", width: "100px" },
  { id: "salesExecutive", label: "Sales executive", width: "130px" },
];

export const DEFAULT_VISIBLE_COLUMNS: Record<LeadColumnId, boolean> = {
  source: true,
  portal: true,
  lead: true,
  analyst: true,
  tag: true,
  phone: true,
  email: true,
  clientProfile: true,
  location: true,
  analystNotes: true,
  status: true,
  score: true,
  stage: true,
  closed: true,
  closedDate: true,
  ip: true,
  executiveNotes: true,
  added: true,
  team: true,
  handoff: true,
  contact: false,
  duplicateCheck: false,
  dealValue: false,
  salesExecutive: false,
};
