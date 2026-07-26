"use client";

import {
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SeOutcomeForm } from "@/components/dashboard/se-outcome-form";
import { fetchLead, type LeadDetail } from "@/lib/api";
import {
  canEditLeadProfile,
  canUpdateSalesOutcome,
  isSalesExecutive,
} from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";
import { useLeadsStore } from "@/store/leads-store";
import { useUiStore } from "@/store/ui-store";

const EXIT_MS = 0;
const PANEL_WIDTH = 380;

type Props = {
  onEdit: (leadId: string) => void;
};

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const text = (value ?? "").trim();
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
        {label}
      </p>
      <p className="mt-1 break-words text-[13px] leading-snug text-[#212529]">
        {text || "—"}
      </p>
    </div>
  );
}

export function LeadPreviewSidebar({ onEdit }: Props) {
  const previewLeadId = useUiStore((s) => s.previewLeadId);
  const closeLeadPreview = useUiStore((s) => s.closeLeadPreview);
  const leadItems = useLeadsStore((s) => s.items);
  const role = useAuthStore((s) => s.user?.role);
  const allowProfileEdit = canEditLeadProfile(role);
  const allowSalesOutcome = canUpdateSalesOutcome(role);
  const seMode = isSalesExecutive(role);

  const [renderedId, setRenderedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchGen = useRef(0);
  const closeTimer = useRef<number | null>(null);
  const listLead =
    renderedId != null
      ? (leadItems.find((lead) => lead.id === renderedId) ?? null)
      : null;

  // Instant open/close — no width animation (avoids table scroll jitter).
  useEffect(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    if (previewLeadId) {
      setRenderedId(previewLeadId);
      setExpanded(true);
      return;
    }

    setExpanded(false);
    if (EXIT_MS <= 0) {
      setRenderedId(null);
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }
    closeTimer.current = window.setTimeout(() => {
      setRenderedId(null);
      setDetail(null);
      setError(null);
      setLoading(false);
      closeTimer.current = null;
    }, EXIT_MS);

    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [previewLeadId]);

  // Fetch detail for the rendered id; abort/stale-guard on switch/close.
  useEffect(() => {
    if (!renderedId) return;

    const gen = ++fetchGen.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail((prev) => (prev?.id === renderedId ? prev : null));

    void fetchLead(renderedId, controller.signal)
      .then((row) => {
        if (fetchGen.current !== gen) return;
        setDetail(row);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || fetchGen.current !== gen) return;
        setDetail(null);
        setError(err instanceof Error ? err.message : "Failed to load lead");
      })
      .finally(() => {
        if (fetchGen.current === gen) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [renderedId]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLeadPreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, closeLeadPreview]);

  if (!renderedId) return null;

  const title =
    detail?.fullName?.trim() ||
    listLead?.leadLabel?.trim() ||
    "Lead details";

  return (
    <>
      {expanded ? (
        <button
          type="button"
          aria-label="Close lead preview"
          onClick={() => closeLeadPreview()}
          className="absolute inset-0 z-20 bg-[rgba(15,17,20,0.28)] lg:hidden"
        />
      ) : null}
      <aside
        aria-hidden={!expanded}
        className={[
          "overflow-hidden border-l border-[rgba(33,37,41,0.06)] bg-white",
          // Below lg: overlay so the table keeps its full width.
          "max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:shadow-[-18px_0_40px_rgba(15,17,20,0.16)]",
          // Desktop: sit beside the table in-flow.
          "lg:relative lg:shrink-0 lg:shadow-none",
          expanded ? "" : "border-l-transparent",
        ].join(" ")}
        style={{
          width: expanded ? `min(${PANEL_WIDTH}px, 100%)` : 0,
        }}
      >
        <div
          className="flex h-full max-w-full flex-col"
          style={{ width: `min(${PANEL_WIDTH}px, 100vw)` }}
        >
        <div className="relative shrink-0 overflow-hidden border-b border-[rgba(33,37,41,0.06)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,rgba(255,247,239,0.9)_0%,rgba(255,255,255,0.65)_50%,rgba(248,249,250,0.95)_100%)]"
          />
          <div className="relative flex items-start justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-[#9a3f00] uppercase">
                Lead preview
              </p>
              <h2 className="mt-1 truncate text-[16px] font-medium tracking-[-0.03em] text-[#212529]">
                {title}
              </h2>
              <p className="mt-0.5 truncate text-[12px] text-[#868e96]">
                {detail?.source || listLead?.source || "—"}
                {listLead?.createdAt ? ` · ${listLead.createdAt}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={closeLeadPreview}
              className="lf-pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(33,37,41,0.08)] bg-white/80 text-[#868e96] hover:bg-white hover:text-[#212529]"
              aria-label="Close preview"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="lf-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {loading && !detail ? (
            <div className="flex h-40 items-center justify-center gap-2 text-[12px] text-[#adb5bd]">
              <LoaderCircle size={14} className="animate-spin" />
              Loading…
            </div>
          ) : error && !detail ? (
            <p className="py-10 text-center text-[12px] text-[#c92a2a]">
              {error}
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] px-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#495057] shadow-[0_1px_2px_rgba(15,17,20,0.06)]">
                  <UserRound size={16} strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#212529]">
                    {title}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[#868e96]">
                    {detail?.qualificationStatus?.replace(/_/g, " ") ||
                      listLead?.status ||
                      "—"}
                  </p>
                </div>
              </div>

              <section className="space-y-3">
                <p className="text-[11px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                  Contact
                </p>
                <div className="grid gap-3">
                  <div className="flex items-start gap-2.5">
                    <Mail
                      size={13}
                      strokeWidth={1.5}
                      className="mt-0.5 shrink-0 text-[#ced4da]"
                    />
                    <Field label="Email" value={detail?.email} />
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Phone
                      size={13}
                      strokeWidth={1.5}
                      className="mt-0.5 shrink-0 text-[#ced4da]"
                    />
                    <Field
                      label="Phone"
                      value={detail?.phone || listLead?.contactPhone}
                    />
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MapPin
                      size={13}
                      strokeWidth={1.5}
                      className="mt-0.5 shrink-0 text-[#ced4da]"
                    />
                    <Field
                      label="Location"
                      value={
                        [detail?.city, detail?.country]
                          .filter(Boolean)
                          .join(", ") || listLead?.contactLocation
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3 border-t border-[rgba(33,37,41,0.05)] pt-4">
                <p className="text-[11px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                  Acquisition
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Source" value={detail?.source} />
                  <Field label="Portal" value={detail?.portalWebsite} />
                  <Field
                    label="Facebook / Meta"
                    value={detail?.facebookProfile}
                  />
                  <Field label="Language" value={detail?.language} />
                  <Field label="Date" value={detail?.createdAt} />
                  <Field
                    label="Lead score"
                    value={
                      detail?.leadScore != null
                        ? String(detail.leadScore)
                        : null
                    }
                  />
                </div>
              </section>

              <section className="space-y-3 border-t border-[rgba(33,37,41,0.05)] pt-4">
                <p className="text-[11px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                  Pipeline
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Status" value={listLead?.status} />
                  <Field
                    label="Stage"
                    value={detail?.salesStageLabel || listLead?.stage}
                  />
                  <Field label="Team" value={listLead?.team} />
                  <Field
                    label="Sales executive"
                    value={listLead?.salesExecutive}
                  />
                  <Field
                    label="Initial payment"
                    value={
                      detail?.initialPayment != null
                        ? `${detail.dealCurrency || "AUD"} ${detail.initialPayment}`
                        : listLead?.ip
                    }
                  />
                  <Field
                    label="Deal value"
                    value={
                      detail?.dealValueDisplay ||
                      (detail?.dealValue != null
                        ? `${detail.dealCurrency || "AUD"} ${detail.dealValue}`
                        : listLead?.dealValue)
                    }
                  />
                  <Field label="Closed" value={detail?.closed || listLead?.closed} />
                </div>
              </section>

              <section className="space-y-3 border-t border-[rgba(33,37,41,0.05)] pt-4">
                <p className="text-[11px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                  Profile & notes
                </p>
                <Field label="Client profile" value={detail?.clientProfile} />
                <Field label="Analyst notes" value={detail?.notes} />
                {!seMode ? (
                  <Field
                    label="SE notes"
                    value={detail?.executiveNotes || listLead?.executiveNotes}
                  />
                ) : null}
                <Field
                  label="Lead analyst"
                  value={
                    listLead
                      ? `${listLead.analystName}${listLead.analystEmail && listLead.analystEmail !== "—" ? ` · ${listLead.analystEmail}` : ""}`
                      : null
                  }
                />
              </section>

              {seMode && allowSalesOutcome ? (
                <div className="border-t border-[rgba(33,37,41,0.05)] pt-4">
                  <SeOutcomeForm
                    leadId={renderedId}
                    detail={detail}
                    onSaved={setDetail}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[rgba(33,37,41,0.06)] px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeLeadPreview}
              className={[
                "lf-pressable h-9 rounded-lg border border-[rgba(33,37,41,0.08)] bg-white text-[12px] font-medium text-[#495057] hover:bg-[#f8f9fa]",
                allowProfileEdit ? "flex-1" : "w-full",
              ].join(" ")}
            >
              Close
            </button>
            {allowProfileEdit ? (
              <button
                type="button"
                onClick={() => onEdit(renderedId)}
                className="lf-pressable h-9 flex-1 rounded-lg bg-[#212529] text-[12px] font-medium text-white hover:opacity-90"
              >
                Edit info
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
