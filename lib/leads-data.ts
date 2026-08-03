export type LeadRecord = {
  id: string;
  analystName: string;
  analystEmail: string;
  source: string;
  portal: string;
  leadLabel: string;
  createdAt: string;
  /** UTC ISO instant from API when available (preferred for formatting). */
  createdAtRaw?: string;
  tag: string;
  contactPhone: string;
  contactEmail: string;
  contactLocation: string;
  clientProfile: string;
  analystNotes: string;
  executiveNotes: string;
  duplicateCheck: string;
  status: string;
  statusRaw: string;
  score: string;
  stage: string;
  stageRaw: string;
  closed: string;
  /** UTC ISO when the lead was closed (won/lost). */
  closedAt?: string | null;
  /** Minutes from lead createdAt → closedAt. */
  timeToCloseMinutes?: number | null;
  notAppropriate?: boolean;
  ip: string;
  dealValue: string;
  team: string;
  salesExecutive: string;
  handoff: string;
  isNew?: boolean;
};
