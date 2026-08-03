import type { LeadDetail } from "@/lib/api";
import { qualificationLabel } from "@/lib/lead-form-options";
import { seOutcomeLabel } from "@/lib/lead-filter-labels";
import type { LeadRecord } from "@/lib/leads-data";

function dash(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || "—";
}

function formatLocation(
  city: string | null | undefined,
  country: string | null | undefined,
): string {
  const c = dash(city);
  const co = dash(country);
  if (c === "—" && co === "—") return "—";
  return `${c}, ${co}`;
}

function formatMoney(
  value: number | null | undefined,
  currency = "AUD",
): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${currency} ${value}`;
}

/** Map editable lead detail fields onto the list row shape. */
export function leadDetailToListPatch(
  detail: LeadDetail,
): Partial<LeadRecord> {
  const score =
    typeof detail.leadScore === "number" ? String(detail.leadScore) : "—";
  const currency = detail.dealCurrency?.trim() || "AUD";
  const stageRaw = detail.salesStage || "";
  const dealAmount =
    typeof detail.dealValue === "number"
      ? detail.dealValue
      : typeof detail.closedRevenue === "number"
        ? detail.closedRevenue
        : typeof detail.estimatedDealValue === "number"
          ? detail.estimatedDealValue
          : null;
  return {
    leadLabel: detail.fullName?.trim() || "—",
    source: dash(detail.source),
    portal: dash(detail.portalWebsite),
    contactPhone: dash(detail.phone),
    contactEmail: dash(detail.email),
    contactLocation: formatLocation(detail.city, detail.country),
    clientProfile: dash(detail.clientProfile),
    analystNotes: dash(detail.notes),
    executiveNotes: dash(detail.executiveNotes),
    statusRaw: detail.qualificationStatus || "",
    status: qualificationLabel(detail.qualificationStatus) || "—",
    score,
    createdAt: detail.createdAt || "—",
    stageRaw,
    stage: detail.salesStageLabel || seOutcomeLabel(stageRaw) || "—",
    closed: detail.closed || "—",
    closedAt: detail.closedAt ?? null,
    timeToCloseMinutes: detail.timeToCloseMinutes ?? null,
    notAppropriate: Boolean(detail.notAppropriate),
    ...(detail.notAppropriate ? { tag: "Not appropriate" as const } : {}),
    ip:
      typeof detail.initialPayment === "number"
        ? String(detail.initialPayment)
        : "—",
    dealValue: detail.dealValueDisplay || formatMoney(dealAmount, currency),
  };
}
