"use client";

import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Filter,
  LoaderCircle,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { AddLeadModal } from "@/components/dashboard/add-lead-modal";
import { AssignLeadsPopover } from "@/components/dashboard/assign-leads-popover";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { LeadPreviewSidebar } from "@/components/dashboard/lead-preview-sidebar";
import { QualificationBadgeSelect } from "@/components/dashboard/qualification-badge-select";
import { useActionPhase } from "@/hooks/use-action-phase";
import { isAssignableQualification } from "@/lib/lead-form-options";
import {
  LEAD_COLUMNS,
  type LeadColumnId,
} from "@/lib/leads-columns";
import type { LeadRecord } from "@/lib/leads-data";
import {
  formatDateTimeShort,
  formatDurationMinutes,
  formatLeadAddedAt,
} from "@/lib/datetime";
import { HighlightPhone, HighlightText } from "@/lib/highlight-match";
import { ApiError, deleteLeads, exportLeadsPdf, fetchLead } from "@/lib/api";
import {
  canAssignLeads,
  canAssignToTeamLeads,
  canChangeQualification,
  canCreateLeads,
  canDeleteLeads,
  canEditLeadProfile,
} from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";
import { formatFacetChips, leadPresetOptionsForRole, presetLabelForRole } from "@/lib/lead-filter-labels";
import { hasLeadFacets, parseLeadsDeepLink } from "@/lib/leads-href";
import { leadDetailToListPatch } from "@/lib/lead-record-map";
import { subscribeRealtime } from "@/lib/realtime";
import { useInfiniteLeadScroll } from "@/hooks/use-infinite-lead-scroll";
import { useLeadsQuery } from "@/hooks/use-leads-query";
import {
  restoreLeadsScrollPosition,
  usePersistedLeadsScroll,
} from "@/hooks/use-persisted-leads-scroll";
import { useVirtualWindow } from "@/hooks/use-virtual-window";
import {
  countSelectedOnPage,
  useLeadsStore,
} from "@/store/leads-store";
import { useLeadsScrollStore } from "@/store/leads-scroll-store";
import { useUiStore } from "@/store/ui-store";

const SORT_OPTIONS = [
  { id: "recent", label: "Recent activity" },
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "name", label: "Name A–Z" },
  { id: "status", label: "Status" },
  { id: "stage", label: "Stage" },
  { id: "value", label: "Deal value" },
  { id: "analyst", label: "Lead analyst" },
] as const;

const ROW_HEIGHT = 64;

function routeDisplay(team: string, salesExecutive: string) {
  const route = team && team !== "—" ? team : "";
  const exec = salesExecutive && salesExecutive !== "—" ? salesExecutive : "";
  return { route, exec };
}

/** Source / portal: full labels, wrap in-cell, never bleed into neighboring columns. */
function AttributionLabel({
  text,
  query,
}: {
  text: string;
  query?: string;
}) {
  const value = (text || "").trim();
  const empty = !value || value === "—";
  return (
    <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] leading-snug text-[#495057]">
      {empty ? (
        <span className="text-[#adb5bd]">—</span>
      ) : (
        <p className="truncate" title={value}>
          <HighlightText text={value} query={query} />
        </p>
      )}
    </td>
  );
}

function ColumnCell({
  columnId,
  lead,
  justAssigned = false,
  searchQuery = "",
  qualificationEditable = true,
}: {
  columnId: LeadColumnId;
  lead: LeadRecord;
  justAssigned?: boolean;
  searchQuery?: string;
  qualificationEditable?: boolean;
}) {
  switch (columnId) {
    case "source":
      return <AttributionLabel text={lead.source} query={searchQuery} />;
    case "portal":
      return <AttributionLabel text={lead.portal} query={searchQuery} />;
    case "lead":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[13px] font-medium text-[#212529]">
              <HighlightText text={lead.leadLabel} query={searchQuery} />
            </p>
            {lead.isNew ? (
              <span className="shrink-0 rounded-md bg-[#ebfbee] px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[#2b8a3e] uppercase">
                New
              </span>
            ) : null}
          </div>
        </td>
      );
    case "analyst":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle">
          <p className="truncate text-[13px] font-medium text-[#212529]" title={lead.analystName}>
            <HighlightText text={lead.analystName} query={searchQuery} />
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[#6c757d]" title={lead.analystEmail}>
            <HighlightText text={lead.analystEmail} query={searchQuery} />
          </p>
        </td>
      );
    case "tag":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle">
          {lead.notAppropriate || lead.tag === "Not appropriate" ? (
            <span
              title="Not appropriate"
              className="inline-flex max-w-full items-center rounded border border-[rgba(201,42,42,0.2)] bg-[#fff5f5] px-1.5 py-px text-[10px] font-medium leading-4 text-[#c92a2a] whitespace-nowrap"
            >
              <span className="truncate">Not appropriate</span>
            </span>
          ) : lead.isNew || lead.tag === "New" ? (
            <span className="inline-flex items-center rounded border border-[rgba(47,158,68,0.22)] bg-[#ebfbee] px-1.5 py-px text-[10px] font-medium leading-4 text-[#2b8a3e] whitespace-nowrap">
              New
            </span>
          ) : (
            <span className="text-[12px] text-[#adb5bd]">—</span>
          )}
        </td>
      );
    case "phone":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] tabular-nums text-[#212529]">
          <p className="truncate" title={lead.contactPhone}>
            <HighlightPhone text={lead.contactPhone} query={searchQuery} />
          </p>
        </td>
      );
    case "email":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={lead.contactEmail}>
            <HighlightText text={lead.contactEmail} query={searchQuery} />
          </p>
        </td>
      );
    case "clientProfile":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={lead.clientProfile}>
            <HighlightText text={lead.clientProfile} query={searchQuery} />
          </p>
        </td>
      );
    case "location":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={lead.contactLocation}>
            <HighlightText text={lead.contactLocation} query={searchQuery} />
          </p>
        </td>
      );
    case "analystNotes":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={lead.analystNotes}>
            <HighlightText text={lead.analystNotes} query={searchQuery} />
          </p>
        </td>
      );
    case "status":
      return (
        <td
          className="min-w-0 overflow-hidden px-3 py-3 align-middle"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1">
            <div className="min-w-0 shrink">
              <QualificationBadgeSelect
                leadId={lead.id}
                statusRaw={lead.statusRaw}
                statusLabel={lead.status}
                editable={qualificationEditable}
              />
            </div>
            {lead.notAppropriate || lead.tag === "Not appropriate" ? (
              <span
                title="Not appropriate"
                className="inline-flex max-w-[7.5rem] shrink-0 items-center rounded border border-[rgba(201,42,42,0.2)] bg-[#fff5f5] px-1.5 py-px text-[10px] font-medium leading-4 text-[#c92a2a] whitespace-nowrap"
              >
                <span className="truncate">Not appropriate</span>
              </span>
            ) : null}
          </div>
        </td>
      );
    case "score":
      return (
        <td className="px-3 py-3 align-middle text-[13px] tabular-nums text-[#212529]">
          <HighlightText text={lead.score} query={searchQuery} />
        </td>
      );
    case "stage":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={lead.stage}>
            <HighlightText text={lead.stage} query={searchQuery} />
          </p>
        </td>
      );
    case "closed": {
      const closedWhen = lead.closedAt
        ? formatDateTimeShort(lead.closedAt)
        : lead.closed === "Closed"
          ? "Closed"
          : "—";
      const closeAge =
        lead.timeToCloseMinutes != null
          ? formatDurationMinutes(lead.timeToCloseMinutes)
          : "";
      const closedTitle = closeAge
        ? `${closedWhen} · ${closeAge} to close`
        : closedWhen;
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={closedTitle}>
            {lead.closedAt ? (
              <>
                <HighlightText text={closedWhen} query={searchQuery} />
                {closeAge ? (
                  <span className="text-[#adb5bd]"> · {closeAge}</span>
                ) : null}
              </>
            ) : (
              <HighlightText text={closedWhen} query={searchQuery} />
            )}
          </p>
        </td>
      );
    }
    case "ip":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] tabular-nums text-[#6c757d]">
          <p className="truncate" title={lead.ip}>
            {lead.ip}
          </p>
        </td>
      );
    case "executiveNotes":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={lead.executiveNotes}>
            <HighlightText text={lead.executiveNotes} query={searchQuery} />
          </p>
        </td>
      );
    case "added": {
      const addedLabel = formatLeadAddedAt(lead.createdAt, lead.createdAtRaw);
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#6c757d]">
          <p className="truncate" title={addedLabel}>
            <HighlightText text={addedLabel} query={searchQuery} />
          </p>
        </td>
      );
    }
    case "team": {
      const { route, exec } = routeDisplay(lead.team, lead.salesExecutive);
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle">
          {route || exec ? (
            <>
              {route ? (
                <p className="truncate text-[13px] font-medium text-[#212529]" title={route}>
                  <HighlightText text={route} query={searchQuery} />
                </p>
              ) : null}
              {exec ? (
                <p
                  className={[
                    "truncate text-[12px] text-[#6c757d]",
                    route ? "mt-0.5" : "text-[13px] font-medium text-[#212529]",
                  ].join(" ")}
                  title={exec}
                >
                  {route ? (
                    <>
                      SE · <HighlightText text={exec} query={searchQuery} />
                    </>
                  ) : (
                    <HighlightText text={exec} query={searchQuery} />
                  )}
                </p>
              ) : justAssigned ? (
                <p className="mt-0.5 truncate text-[11px] font-medium tracking-[0.02em] text-[#2b8a3e]">
                  Assigned
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[13px] text-[#adb5bd]">Unassigned</p>
          )}
        </td>
      );
    }
    case "handoff":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={lead.handoff}>
            <HighlightText text={lead.handoff} query={searchQuery} />
          </p>
        </td>
      );
    case "contact":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle">
          <p className="truncate text-[13px] tabular-nums text-[#212529]" title={lead.contactPhone}>
            <HighlightPhone text={lead.contactPhone} query={searchQuery} />
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[#6c757d]" title={lead.contactLocation}>
            {lead.contactLocation}
          </p>
        </td>
      );
    case "duplicateCheck":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={lead.duplicateCheck}>
            {lead.duplicateCheck}
          </p>
        </td>
      );
    case "dealValue":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] tabular-nums text-[#212529]">
          <p className="truncate" title={lead.dealValue}>
            <HighlightText text={lead.dealValue} query={searchQuery} />
          </p>
        </td>
      );
    case "salesExecutive":
      return (
        <td className="min-w-0 overflow-hidden px-3 py-3 align-middle text-[13px] text-[#495057]">
          <p className="truncate" title={lead.salesExecutive}>
            <HighlightText text={lead.salesExecutive} query={searchQuery} />
          </p>
        </td>
      );
    default:
      return null;
  }
}

const LeadRow = memo(function LeadRow({
  lead,
  visibleColumnIds,
  searchQuery,
  searchField,
}: {
  lead: LeadRecord;
  visibleColumnIds: LeadColumnId[];
  searchQuery: string;
  searchField: string;
}) {
  const selected = useLeadsStore((s) => Boolean(s.selectedById[lead.id]));
  const justAssigned = useLeadsStore((s) =>
    Boolean(s.flashAssignedById[lead.id]),
  );
  const previewed = useUiStore((s) => s.previewLeadId === lead.id);
  const role = useAuthStore((s) => s.user?.role);
  const qualificationEditable = canChangeQualification(role);
  const toggleLeadSelection = useLeadsStore((s) => s.toggleLeadSelection);
  const setLeadSelected = useLeadsStore((s) => s.setLeadSelected);
  const clearLeadSelection = useLeadsStore((s) => s.clearLeadSelection);
  const markLeadSeen = useLeadsStore((s) => s.markLeadSeen);
  const openLeadPreview = useUiStore((s) => s.openLeadPreview);
  const closeLeadPreview = useUiStore((s) => s.closeLeadPreview);

  return (
    <tr
      data-selected={selected ? "true" : "false"}
      data-previewed={previewed ? "true" : "false"}
      data-just-assigned={justAssigned ? "true" : "false"}
      onClick={() => {
        const current = useUiStore.getState().previewLeadId;
        if (current === lead.id) {
          closeLeadPreview();
          return;
        }
        markLeadSeen(lead.id);
        openLeadPreview(lead.id);
        startTransition(() => {
          clearLeadSelection();
          setLeadSelected(lead.id, true);
        });
      }}
      className="lf-row cursor-pointer border-b border-[rgba(33,37,41,0.04)] last:border-b-0"
      style={{ height: ROW_HEIGHT }}
    >
      <td
        className="relative w-11 px-3 py-3 align-middle"
        onClick={(event) => event.stopPropagation()}
      >
        {selected || previewed || justAssigned ? (
          <span
            className={[
              "absolute top-0 bottom-0 left-0 w-[2px]",
              previewed
                ? "bg-[#e86812]"
                : justAssigned
                  ? "bg-[#2b8a3e]"
                  : "bg-[#212529]",
            ].join(" ")}
          />
        ) : null}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => {
            startTransition(() => {
              toggleLeadSelection(lead.id);
            });
          }}
          className="cursor-pointer"
          aria-label={`Select ${lead.leadLabel}`}
        />
      </td>
      {visibleColumnIds.map((columnId) => (
        <ColumnCell
          key={columnId}
          columnId={columnId}
          lead={lead}
          justAssigned={justAssigned}
          searchQuery={
            !searchField || searchField === columnId ? searchQuery : ""
          }
          qualificationEditable={qualificationEditable}
        />
      ))}
    </tr>
  );
});

function ToolbarMenuButton({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        useUiStore.getState().closeOverlays();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        useUiStore.getState().closeOverlays();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={[
          "lf-pressable inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-[13px] font-medium text-[#212529]",
          open
            ? "border-[rgba(33,37,41,0.16)] bg-[#f8f9fa]"
            : "border-[rgba(33,37,41,0.08)] hover:bg-[#f8f9fa]",
        ].join(" ")}
      >
        <span className="text-[#6c757d]">{icon}</span>
        {label}
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={[
            "text-[#868e96] transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      <div
        role="menu"
        aria-hidden={!open}
        className={[
          "absolute top-[calc(100%+6px)] left-0 z-30 min-w-[min(200px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[rgba(33,37,41,0.08)] bg-white p-1 shadow-[0_12px_32px_rgba(33,37,41,0.08)] transition-[opacity,transform,visibility] duration-150 ease-out",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

function MenuOption({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onSelect}
      className={[
        "lf-pressable flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px]",
        active
          ? "bg-[#f8f9fa] font-medium text-[#212529]"
          : "font-normal text-[#495057] hover:bg-[#f8f9fa] hover:text-[#212529]",
      ].join(" ")}
    >
      {label}
      {active ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[#212529]" />
      ) : null}
    </button>
  );
}

function CustomizePanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const open = useUiStore((s) => s.toolbarMenu === "customize");
  const toggleToolbarMenu = useUiStore((s) => s.toggleToolbarMenu);
  const visibleColumns = useLeadsStore((s) => s.visibleColumns);
  const toggleColumnVisibility = useLeadsStore((s) => s.toggleColumnVisibility);
  const showAllColumns = useLeadsStore((s) => s.showAllColumns);
  const hideOptionalColumns = useLeadsStore((s) => s.hideOptionalColumns);
  const resetColumns = useLeadsStore((s) => s.resetColumns);

  const visibleCount = LEAD_COLUMNS.filter(
    (column) => visibleColumns[column.id],
  ).length;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        useUiStore.getState().closeOverlays();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        useUiStore.getState().closeOverlays();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => toggleToolbarMenu("customize")}
        className={[
          "lf-pressable inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-[13px] font-medium text-[#212529]",
          open
            ? "border-[rgba(33,37,41,0.16)] bg-[#f8f9fa]"
            : "border-[rgba(33,37,41,0.08)] hover:bg-[#f8f9fa]",
        ].join(" ")}
      >
        <SlidersHorizontal
          size={14}
          strokeWidth={1.5}
          className="text-[#6c757d]"
        />
        Customize
      </button>

      <div
        role="dialog"
        aria-label="Customize columns"
        aria-hidden={!open}
        className={[
          "absolute top-[calc(100%+6px)] right-0 z-40 w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[rgba(33,37,41,0.08)] bg-white shadow-[0_12px_32px_rgba(33,37,41,0.08)] transition-[opacity,transform,visibility] duration-150 ease-out",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <div className="border-b border-[rgba(33,37,41,0.06)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-[#212529]">
                Customize columns
              </p>
              <p className="mt-0.5 text-[12px] text-[#6c757d]">
                {visibleCount} of {LEAD_COLUMNS.length} visible
              </p>
            </div>
            <button
              type="button"
              onClick={() => useUiStore.getState().closeOverlays()}
              aria-label="Close customize panel"
              className="lf-pressable flex h-7 w-7 items-center justify-center rounded-lg text-[#6c757d] hover:bg-[#f8f9fa] hover:text-[#212529]"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="lf-scroll max-h-[320px] overflow-y-auto px-2 py-2">
          {LEAD_COLUMNS.map((column) => {
            const visible = visibleColumns[column.id];
            return (
              <label
                key={column.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-[#f8f9fa]"
              >
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={() => {
                    startTransition(() => {
                      toggleColumnVisibility(column.id);
                    });
                  }}
                  className="cursor-pointer"
                />
                <span className="min-w-0 flex-1 text-[13px] text-[#212529]">
                  {column.label}
                </span>
                {visible ? (
                  <Eye size={14} strokeWidth={1.5} className="text-[#6c757d]" />
                ) : (
                  <EyeOff
                    size={14}
                    strokeWidth={1.5}
                    className="text-[#868e96]"
                  />
                )}
              </label>
            );
          })}
        </div>

        <div className="flex items-center gap-1 border-t border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] p-2">
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                showAllColumns();
              });
            }}
            className="lf-pressable inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-2 text-[12px] font-medium text-[#212529] hover:bg-white/80"
          >
            <Check size={12} strokeWidth={1.5} />
            Show all
          </button>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                hideOptionalColumns();
              });
            }}
            className="lf-pressable inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-2 text-[12px] font-medium text-[#212529] hover:bg-white/80"
          >
            <EyeOff size={12} strokeWidth={1.5} />
            Essentials
          </button>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                resetColumns();
              });
            }}
            className="lf-pressable inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#6c757d] hover:text-[#212529]"
            aria-label="Reset columns"
            title="Reset columns"
          >
            <RotateCcw size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectAllCheckbox({
  leadIds,
}: {
  leadIds: readonly string[];
}) {
  const selectAllId = useId();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const idsKey = leadIds.join("|");

  const selectedById = useLeadsStore((s) => s.selectedById);
  const selectPageLeads = useLeadsStore((s) => s.selectPageLeads);
  const clearPageLeads = useLeadsStore((s) => s.clearPageLeads);

  const selectedInWindow = useMemo(
    () => countSelectedOnPage(selectedById, leadIds),
    [selectedById, leadIds, idsKey],
  );

  const allSelected =
    leadIds.length > 0 && selectedInWindow === leadIds.length;
  const someSelected = selectedInWindow > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected, idsKey]);

  return (
    <input
      ref={selectAllRef}
      id={selectAllId}
      type="checkbox"
      checked={allSelected}
      onChange={() => {
        startTransition(() => {
          if (allSelected) {
            clearPageLeads(leadIds);
          } else {
            selectPageLeads(leadIds);
          }
        });
      }}
      className="cursor-pointer"
      aria-label="Select all loaded leads"
    />
  );
}

function SelectionBar({
  onEditLead,
}: {
  onEditLead: (leadId: string) => void;
}) {
  const selectedCount = useLeadsStore((s) => s.selectedCount);
  const selectedById = useLeadsStore((s) => s.selectedById);
  const items = useLeadsStore((s) => s.items);
  const clearLeadSelection = useLeadsStore((s) => s.clearLeadSelection);
  const applyAssignments = useLeadsStore((s) => s.applyAssignments);
  const removeLeads = useLeadsStore((s) => s.removeLeads);
  const role = useAuthStore((s) => s.user?.role);
  const allowAssign = canAssignLeads(role);
  const allowProfileEdit = canEditLeadProfile(role);
  const allowDelete = canDeleteLeads(role);
  const assignMembersOnly = !canAssignToTeamLeads(role);
  const open = selectedCount > 0;

  const assignBtnRef = useRef<HTMLButtonElement>(null);
  const dockBarRef = useRef<HTMLDivElement>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const {
    phase: deletePhase,
    start: startDelete,
    succeed: succeedDelete,
    fail: failDelete,
    reset: resetDelete,
    isBusy: deleting,
  } = useActionPhase();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const leadIds = useMemo(
    () => Object.keys(selectedById).filter((id) => selectedById[id]),
    [selectedById],
  );

  const selectedLeads = useMemo(
    () => items.filter((item) => selectedById[item.id]),
    [items, selectedById],
  );
  const assignBlocked = selectedLeads.some(
    (lead) => !isAssignableQualification(lead.statusRaw),
  );
  const assignBlockedReason = assignBlocked
    ? "Only Qualified / Qualified - Chat / Qualified - Call leads can be assigned"
    : undefined;

  useEffect(() => {
    if (!open) {
      setAssignOpen(false);
      setDeleteOpen(false);
      setDeleteError(null);
      resetDelete();
    }
  }, [open, resetDelete]);

  function toggleAssign() {
    if (assignBlocked) return;
    setDeleteOpen(false);
    setAssignOpen((prev) => !prev);
  }

  async function confirmDelete() {
    if (deleting || leadIds.length === 0) return;
    startDelete();
    setDeleteError(null);
    try {
      await deleteLeads(leadIds);
      await succeedDelete("Deleted");
      setDeleteOpen(false);
      startTransition(() => {
        removeLeads(leadIds);
        clearLeadSelection();
      });
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete leads",
      );
      failDelete();
    }
  }

  const deleteCountLabel =
    leadIds.length === 1 ? "1 lead" : `${leadIds.length} leads`;

  return (
    <>
      <div
        className={[
          "pointer-events-none absolute inset-x-0 z-50 flex justify-center px-3 transition-[opacity,transform,visibility] duration-200 ease-out sm:px-4",
          "bottom-[max(4.25rem,calc(env(safe-area-inset-bottom)+3.5rem))]",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible translate-y-2 opacity-0",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div
          ref={dockBarRef}
          className={[
            "flex max-w-[min(100%,36rem)] flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-white/10 bg-[#1c1f24]/95 px-1.5 py-1.5 text-white shadow-[0_18px_48px_rgba(15,17,20,0.28)] backdrop-blur-xl",
            open ? "pointer-events-auto" : "pointer-events-none",
          ].join(" ")}
        >
          <span className="rounded-xl bg-[#e86812] px-2.5 py-1.5 text-[12px] font-semibold tabular-nums tracking-tight text-white">
            {selectedCount} Selected
          </span>
          <span className="mx-0.5 h-4 w-px bg-white/12" />
          {allowAssign ? (
            <button
              ref={assignBtnRef}
              type="button"
              onClick={toggleAssign}
              disabled={assignBlocked}
              title={assignBlockedReason}
              aria-expanded={assignOpen}
              aria-haspopup="dialog"
              data-assign-trigger="true"
              className={[
                "lf-pressable rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-white/90 hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/35 disabled:hover:bg-transparent",
                assignOpen ? "bg-white/14 text-white" : "",
              ].join(" ")}
            >
              Assign
            </button>
          ) : null}
          {allowProfileEdit ? (
            <button
              type="button"
              disabled={selectedCount !== 1}
              title={
                selectedCount !== 1
                  ? "Select one lead to edit"
                  : "Edit selected lead"
              }
              onClick={() => {
                if (leadIds.length !== 1) return;
                setAssignOpen(false);
                onEditLead(leadIds[0]);
              }}
              className="lf-pressable rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-white/90 hover:bg-white/10 disabled:text-white/35 disabled:hover:bg-transparent"
            >
              Edit Info
            </button>
          ) : null}
          {allowDelete ? (
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                setAssignOpen(false);
                setDeleteError(null);
                setDeleteOpen(true);
              }}
              className="lf-pressable inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-[#ffc9c9] hover:bg-[rgba(255,107,107,0.14)] disabled:opacity-60"
            >
              <Trash2 size={12} strokeWidth={1.5} className="text-[#ffa8a8]" />
              Delete
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                clearLeadSelection();
              });
            }}
            aria-label="Clear selection"
            className="lf-pressable ml-0.5 flex h-8 w-8 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <AssignLeadsPopover
        open={allowAssign && assignOpen}
        dockEl={dockBarRef.current}
        triggerEl={assignBtnRef.current}
        leadIds={leadIds}
        membersOnly={assignMembersOnly}
        onClose={() => setAssignOpen(false)}
        onAssigned={(result) => {
          applyAssignments(result.assignments);
          startTransition(() => {
            clearLeadSelection();
          });
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        tone="danger"
        title={`Delete ${deleteCountLabel}?`}
        description={
          deleteError
            ? deleteError
            : "This permanently removes the selected leads from the database. This can’t be undone."
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        successLabel="Deleted"
        cancelLabel="Keep"
        phase={deletePhase}
        onCancel={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setDeleteError(null);
          resetDelete();
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </>
  );
}

function LeadsExportButton() {
  const filterValue = useLeadsStore((s) => s.filterValue);
  const sortValue = useLeadsStore((s) => s.sortValue);
  const searchQuery = useLeadsStore((s) => s.searchQuery);
  const searchField = useLeadsStore((s) => s.searchField);
  const facets = useLeadsStore((s) => s.facets);
  const totalAvailable = useLeadsStore((s) => s.totalAvailable);
  const { start, succeed, fail, isPending } = useActionPhase(1400);
  const [error, setError] = useState<string | null>(null);

  const committedSearch =
    searchQuery.trim().length >= 2 ? searchQuery.trim() : "";
  const filtered = Boolean(
    (filterValue && filterValue !== "all") ||
      committedSearch ||
      hasLeadFacets(facets),
  );

  async function onExport() {
    if (isPending) return;
    setError(null);
    start();
    try {
      const result = await exportLeadsPdf({
        filter: filterValue,
        sort: sortValue,
        q: committedSearch || undefined,
        field: searchField || undefined,
        country: facets.country || undefined,
        city: facets.city || undefined,
        teamId: facets.teamId || undefined,
        analystId: facets.analystId || undefined,
        salesExecId: facets.salesExecId || undefined,
        source: facets.source || undefined,
        portal: facets.portal || undefined,
        metaProfile: facets.metaProfile || undefined,
        status: facets.status || undefined,
        stage: facets.stage || undefined,
        serviceLine: facets.serviceLine || undefined,
        reason: facets.reason || undefined,
        addedFrom: facets.addedFrom || undefined,
        addedTo: facets.addedTo || undefined,
      });
      if (result.count === 0) {
        await succeed("No leads to export");
        return;
      }
      await succeed(
        `Exported ${result.count.toLocaleString("en-US")} lead${result.count === 1 ? "" : "s"}`,
      );
    } catch (err) {
      fail();
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Export failed");
      }
    }
  }

  const label = filtered ? "Export filtered" : "Export";
  const title = filtered
    ? "Download a PDF of every lead matching the current filters"
    : totalAvailable > 0
      ? `Download a PDF of all ${totalAvailable.toLocaleString("en-US")} leads in your scope`
      : "Download a PDF of all leads in your scope";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          void onExport();
        }}
        disabled={isPending}
        title={title}
        className="lf-pressable inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.08)] bg-white px-2.5 text-[13px] font-medium text-[#212529] hover:bg-[#f8f9fa] disabled:cursor-wait disabled:opacity-70 sm:px-3"
      >
        {isPending ? (
          <LoaderCircle
            size={14}
            strokeWidth={1.75}
            className="animate-spin text-[#6c757d]"
          />
        ) : (
          <Download
            size={14}
            strokeWidth={1.5}
            className="text-[#6c757d]"
          />
        )}
        <span className="hidden sm:inline">
          {isPending ? "Exporting…" : label}
        </span>
      </button>
      {error ? (
        <p className="absolute top-[calc(100%+6px)] right-0 z-20 max-w-[16rem] rounded-md border border-[rgba(201,42,42,0.18)] bg-[#fff5f5] px-2 py-1 text-[11px] text-[#c92a2a] shadow-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LeadsContent() {
  const searchParams = useSearchParams();
  const {
    scrollRef: persistedScrollRef,
    scrollAttr,
    flushSave: flushLeadsScrollSave,
  } = usePersistedLeadsScroll({
    enabled: true,
    rowHeight: ROW_HEIGHT,
  });
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  // Stable callback ref — a new function identity each render would detach/attach
  // (null → node) forever and blow the update depth limit.
  const setScrollRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      persistedScrollRef.current = node;
      setScrollRoot((prev) => (prev === node ? prev : node));
    },
    [persistedScrollRef],
  );
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const role = useAuthStore((s) => s.user?.role);
  const allowCreate = canCreateLeads(role);
  const presetOptions = useMemo(() => leadPresetOptionsForRole(role), [role]);
  const clearLeadSelection = useLeadsStore((s) => s.clearLeadSelection);
  const patchLead = useLeadsStore((s) => s.patchLead);
  const deepLinkHandled = useRef<string | null>(null);

  const toolbarMenu = useUiStore((s) => s.toolbarMenu);
  const toggleToolbarMenu = useUiStore((s) => s.toggleToolbarMenu);
  const closeLeadPreview = useUiStore((s) => s.closeLeadPreview);
  const openLeadPreview = useUiStore((s) => s.openLeadPreview);

  const setFilterValue = useLeadsStore((s) => s.setFilterValue);
  const setSortValue = useLeadsStore((s) => s.setSortValue);
  const visibleColumns = useLeadsStore((s) => s.visibleColumns);

  const {
    filterValue,
    sortValue,
    isQueryPending,
    isInitialLoading,
    windowLeads,
    totalAvailable,
    windowCount,
    hasMore,
    queryEpoch,
    error,
    refreshLeadsPreservingWindow,
  } = useLeadsQuery();
  const searchQuery = useLeadsStore((s) => s.searchQuery);
  const searchField = useLeadsStore((s) => s.searchField);
  const setSearchField = useLeadsStore((s) => s.setSearchField);
  const facets = useLeadsStore((s) => s.facets);
  const clearFacets = useLeadsStore((s) => s.clearFacets);
  const applyDeepLink = useLeadsStore((s) => s.applyDeepLink);

  const refreshKeepingPlace = async (anchorId?: string) => {
    flushLeadsScrollSave();
    const el = scrollRoot;
    const scrollTop =
      el?.scrollTop ?? useLeadsScrollStore.getState().scrollTop;
    const clientHeight = el?.clientHeight ?? 640;
    const idx = Math.min(
      Math.max(0, windowLeads.length - 1),
      Math.floor(scrollTop / ROW_HEIGHT),
    );
    const resolvedAnchor =
      anchorId || windowLeads[idx]?.id || undefined;
    await refreshLeadsPreservingWindow({
      scrollTop,
      clientHeight,
      anchorId: resolvedAnchor,
      rowHeight: ROW_HEIGHT,
    });
    requestAnimationFrame(() => {
      restoreLeadsScrollPosition(scrollRoot, {
        scrollTop,
        anchorId: resolvedAnchor,
        items: useLeadsStore.getState().items,
        rowHeight: ROW_HEIGHT,
      });
    });
  };

  // Realtime: reconcile the visible window when leads change elsewhere.
  // Deletions apply instantly; other changes coalesce into one soft refresh
  // per burst so 200 concurrent sessions never stampede the backend.
  const refreshKeepingPlaceRef = useRef(refreshKeepingPlace);
  refreshKeepingPlaceRef.current = refreshKeepingPlace;
  useEffect(() => {
    let timer = 0;
    let pending = false;
    const unsubscribe = subscribeRealtime((evt) => {
      if (!evt.type.startsWith("lead.")) return;
      if (evt.type === "lead.deleted" && evt.leadId) {
        useLeadsStore.getState().removeLeads([evt.leadId]);
      }
      pending = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!pending) return;
        // Defer heavy refresh while hidden; flush the moment we're visible.
        if (typeof document !== "undefined" && document.hidden) return;
        pending = false;
        void refreshKeepingPlaceRef.current();
      }, 500);
    });
    const onVisible = () => {
      if (!pending || document.hidden) return;
      pending = false;
      void refreshKeepingPlaceRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const link = parseLeadsDeepLink(searchParams);
    // Ignore pure ?lead= preview links with no list filters.
    if (!hasLeadFacets(link) && !link.field) return;
    applyDeepLink(link);
  }, [searchParams, applyDeepLink]);

  useEffect(() => {
    const leadId = searchParams.get("lead")?.trim() ?? "";
    if (!leadId || deepLinkHandled.current === leadId) return;
    if (isInitialLoading) return;
    deepLinkHandled.current = leadId;
    openLeadPreview(leadId);
    startTransition(() => {
      clearLeadSelection();
      useLeadsStore.getState().setLeadSelected(leadId, true);
    });
  }, [
    searchParams,
    isInitialLoading,
    openLeadPreview,
    clearLeadSelection,
  ]);

  const facetSummary = useMemo(
    () => formatFacetChips({ facets }),
    [facets],
  );
  const windowLeadIds = useMemo(
    () => windowLeads.map((lead) => lead.id),
    [windowLeads],
  );

  const visibleColumnDefs = useMemo(
    () => LEAD_COLUMNS.filter((column) => visibleColumns[column.id]),
    [visibleColumns],
  );
  const visibleColumnIds = useMemo(
    () => visibleColumnDefs.map((column) => column.id),
    [visibleColumnDefs],
  );
  const tableMinWidth = useMemo(() => {
    return (
      44 +
      visibleColumnDefs.reduce((sum, column) => {
        const px = Number.parseInt(column.width, 10);
        return sum + (Number.isFinite(px) ? px : 130);
      }, 0)
    );
  }, [visibleColumnDefs]);

  const filterLabel = presetLabelForRole(filterValue, role) || "Filter";
  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === sortValue)?.label ?? "Sort";

  const { sentinelRef, isLoadingMore } = useInfiniteLeadScroll({
    root: scrollRoot,
    enabled: windowCount > 0 && !error,
    hasMore,
    queryEpoch,
    itemCount: windowCount,
  });

  const virtual = useVirtualWindow({
    root: scrollRoot,
    count: windowLeads.length,
    rowHeight: ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = useMemo(
    () => windowLeads.slice(virtual.startIndex, virtual.endIndex),
    [windowLeads, virtual.startIndex, virtual.endIndex],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 sm:gap-4">
      <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ToolbarMenuButton
            label={filterValue === "all" ? "Filter" : filterLabel}
            icon={<Filter size={14} strokeWidth={1.5} />}
            open={toolbarMenu === "filter"}
            onToggle={() => toggleToolbarMenu("filter")}
          >
            {presetOptions.map((option) => (
              <MenuOption
                key={option.id}
                label={option.label}
                active={filterValue === option.id}
                onSelect={() => {
                  startTransition(() => {
                    setFilterValue(option.id);
                    useUiStore.getState().closeOverlays();
                  });
                }}
              />
            ))}
          </ToolbarMenuButton>
          <ToolbarMenuButton
            label={sortValue === "name" ? "Sort" : sortLabel}
            icon={<ArrowUpDown size={14} strokeWidth={1.5} />}
            open={toolbarMenu === "sort"}
            onToggle={() => toggleToolbarMenu("sort")}
          >
            {SORT_OPTIONS.map((option) => (
              <MenuOption
                key={option.id}
                label={option.label}
                active={sortValue === option.id}
                onSelect={() => {
                  startTransition(() => {
                    setSortValue(option.id);
                    useUiStore.getState().closeOverlays();
                  });
                }}
              />
            ))}
          </ToolbarMenuButton>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CustomizePanel />
          <LeadsExportButton />
          {allowCreate ? (
            <button
              type="button"
              onClick={() => {
                setEditingLeadId(null);
                setLeadFormOpen(true);
              }}
              className="lf-pressable inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#212529] px-2.5 text-[13px] font-medium text-white hover:opacity-90 sm:px-3.5"
            >
              <Plus size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Add New Lead</span>
              <span className="sm:hidden">Add</span>
            </button>
          ) : null}
        </div>
      </div>

      <AddLeadModal
        open={leadFormOpen}
        leadId={editingLeadId}
        onClose={() => {
          setLeadFormOpen(false);
          setEditingLeadId(null);
        }}
        onSaved={(event) => {
          void (async () => {
            if (event.mode === "edit") {
              try {
                const detail = await fetchLead(event.id);
                startTransition(() => {
                  patchLead(event.id, leadDetailToListPatch(detail));
                });
                return;
              } catch {
                // Fall through to a soft preserve refresh.
              }
            }
            await refreshKeepingPlace(event.id);
          })();
        }}
      />

      <section className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[rgba(33,37,41,0.06)] bg-white">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div
            ref={setScrollRootRef}
            {...scrollAttr}
            className="lf-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain"
          >
            <table
              className="w-full table-fixed border-collapse text-left"
              style={{ minWidth: `${tableMinWidth}px` }}
            >
              <colgroup>
                <col className="w-11" />
                {visibleColumnDefs.map((column) => (
                  <col key={column.id} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] text-[12px] font-medium text-[#495057]">
                  <th className="bg-[#f8f9fa] px-3 py-3 text-left font-medium">
                    <SelectAllCheckbox leadIds={windowLeadIds} />
                  </th>
                  {visibleColumnDefs.map((column) => {
                    const scoped = searchField === column.id;
                    return (
                      <th
                        key={column.id}
                        className="min-w-0 overflow-hidden bg-[#f8f9fa] px-1 py-2 font-medium"
                      >
                        <button
                          type="button"
                          onClick={() => setSearchField(column.id)}
                          title={
                            scoped
                              ? `Clear ${column.label} search focus`
                              : `Search in ${column.label}`
                          }
                          className={[
                            "lf-pressable group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors",
                            scoped
                              ? "bg-[#fff7ef] text-[#9a3f00]"
                              : "text-[#495057] hover:bg-white hover:text-[#212529]",
                          ].join(" ")}
                        >
                          <span className="truncate">{column.label}</span>
                          {scoped ? (
                            <span className="shrink-0 text-[10px] font-semibold tracking-[0.04em] uppercase">
                              Focus
                            </span>
                          ) : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {error ? (
                  <tr>
                    <td
                      colSpan={visibleColumnIds.length + 1}
                      className="px-6 py-16"
                    >
                      <div className="mx-auto max-w-sm text-center">
                        <p className="text-[15px] font-medium text-[#212529]">
                          Couldn’t load leads
                        </p>
                        <p className="mt-1.5 text-[13px] text-[#6c757d]">
                          {error}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            void refreshKeepingPlace();
                          }}
                          className="lf-pressable mt-4 inline-flex h-9 items-center rounded-lg border border-[rgba(33,37,41,0.08)] bg-white px-3 text-[13px] font-medium text-[#212529] hover:bg-[#f8f9fa]"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : isInitialLoading && windowCount === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColumnIds.length + 1}
                      className="px-6 py-16"
                    >
                      <div className="flex items-center justify-center gap-2 text-[13px] text-[#6c757d]">
                        <LoaderCircle
                          size={16}
                          strokeWidth={1.5}
                          className="animate-spin text-[#212529]"
                        />
                        Loading leads from database…
                      </div>
                    </td>
                  </tr>
                ) : totalAvailable === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColumnIds.length + 1}
                      className="px-6 py-16"
                    >
                      <div className="mx-auto max-w-sm text-center">
                        <p className="text-[15px] font-medium text-[#212529]">
                          No leads match
                        </p>
                        <p className="mt-1.5 text-[13px] text-[#6c757d]">
                          Try another filter, clear search, or click a column
                          header to focus search.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(() => {
                              useLeadsStore.getState().clearSearchQuery();
                              setFilterValue("all");
                              setSortValue("name");
                            });
                          }}
                          className="lf-pressable mt-4 inline-flex h-9 items-center rounded-lg border border-[rgba(33,37,41,0.08)] bg-white px-3 text-[13px] font-medium text-[#212529] hover:bg-[#f8f9fa]"
                        >
                          Reset filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {virtual.offsetTop > 0 ? (
                      <tr aria-hidden>
                        <td
                          colSpan={visibleColumnIds.length + 1}
                          style={{
                            height: virtual.offsetTop,
                            padding: 0,
                            border: 0,
                          }}
                        />
                      </tr>
                    ) : null}

                    {virtualRows.map((lead) => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        visibleColumnIds={visibleColumnIds}
                        searchQuery={searchQuery}
                        searchField={searchField}
                      />
                    ))}

                    {virtual.offsetBottom > 0 ? (
                      <tr aria-hidden>
                        <td
                          colSpan={visibleColumnIds.length + 1}
                          style={{
                            height: virtual.offsetBottom,
                            padding: 0,
                            border: 0,
                          }}
                        />
                      </tr>
                    ) : null}
                  </>
                )}
              </tbody>
            </table>

            {!error && !(isInitialLoading && windowCount === 0) ? (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-4"
                aria-hidden={!hasMore || totalAvailable === 0}
              >
                {totalAvailable === 0 ? null : hasMore ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(33,37,41,0.08)] bg-white px-3 py-1.5 text-[12px] font-medium text-[#6c757d]">
                    <LoaderCircle
                      size={14}
                      strokeWidth={1.5}
                      className={
                        isLoadingMore || isQueryPending
                          ? "animate-spin text-[#212529]"
                          : ""
                      }
                    />
                    {isQueryPending
                      ? "Updating…"
                      : isLoadingMore
                        ? "Loading more…"
                        : "Scroll for more"}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#868e96]">
                    End of results · {totalAvailable.toLocaleString()} leads
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="relative z-20 flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[rgba(33,37,41,0.06)] bg-white px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
            <p className="min-w-0 max-w-full text-[11px] leading-snug text-[#6c757d] sm:text-[12px]">
              Showing {windowCount.toLocaleString()} of{" "}
              {totalAvailable.toLocaleString()}
              {filterValue !== "all" ? ` · ${filterLabel}` : ""}
              {facetSummary.length > 0 ? ` · ${facetSummary.join(" · ")}` : ""}
              {sortValue !== "name" ? ` · ${sortLabel}` : " · Name A–Z"}
              {searchQuery.trim()
                ? searchField
                  ? ` · “${searchQuery.trim()}” in ${
                      LEAD_COLUMNS.find((c) => c.id === searchField)?.label ??
                      searchField
                    }`
                  : ` · “${searchQuery.trim()}”`
                : searchField
                  ? ` · focus ${
                      LEAD_COLUMNS.find((c) => c.id === searchField)?.label ??
                      searchField
                    }`
                  : ""}
              {isQueryPending ? " · updating" : ""}
            </p>
            <div className="flex items-center gap-3">
              {facetSummary.length > 0 || filterValue !== "all" ? (
                <button
                  type="button"
                  onClick={() => clearFacets()}
                  className="lf-pressable text-[12px] font-medium text-[#9a3f00] hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
              {hasMore ? (
                <p className="text-[12px] text-[#868e96]">Scroll to load more</p>
              ) : null}
            </div>
          </div>

          <SelectionBar
            onEditLead={(leadId) => {
              closeLeadPreview();
              setEditingLeadId(leadId);
              setLeadFormOpen(true);
            }}
          />
        </div>

        <LeadPreviewSidebar
          onEdit={(leadId) => {
            closeLeadPreview();
            setEditingLeadId(leadId);
            setLeadFormOpen(true);
          }}
        />
      </section>
    </div>
  );
}
