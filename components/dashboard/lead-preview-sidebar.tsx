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
import {
  BACKEND_URL,
  fetchLead,
  markLeadNotAppropriate,
  type LeadDetail,
} from "@/lib/api";
import {
  formatDate,
  formatDateTime,
  formatDurationMinutes,
  formatLeadAddedAt,
} from "@/lib/datetime";
import { leadDetailToListPatch } from "@/lib/lead-record-map";
import { isLeadNotAppropriate } from "@/lib/leads-data";
import {
  canEditLeadProfile,
  canMarkNotAppropriate,
  canUpdateSalesOutcome,
  isSalesExecutive,
} from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";
import { useLeadsStore } from "@/store/leads-store";
import { useUiStore } from "@/store/ui-store";

const EXIT_MS = 0;
const PANEL_WIDTH = 380;
const REASON_MIN = 10;
const REASON_MAX = 2000;

type Props = {
  onEdit: (leadId: string) => void;
};

function formatFirstResponse(minutes: number) {
  return formatDurationMinutes(minutes);
}

function formatDateTimeLabel(value: string | null | undefined) {
  return formatDateTime(value);
}

function ProofThumb({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    const controller = new AbortController();
    const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
    void fetch(url, {
      credentials: "include",
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        revoked = objectUrl;
        if (!controller.signal.aborted) setSrc(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSrc(null);
      });
    return () => {
      controller.abort();
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [path]);

  if (!src) {
    return (
      <p className="text-[12px] text-[#adb5bd]">Screenshot proof unavailable</p>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-xl border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="First response proof"
        className="max-h-40 w-full object-contain"
      />
    </a>
  );
}

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
  const allowNotAppropriate = canMarkNotAppropriate(role);
  const seMode = isSalesExecutive(role);
  const patchLead = useLeadsStore((s) => s.patchLead);

  const [renderedId, setRenderedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [reasonSubmitting, setReasonSubmitting] = useState(false);
  const fetchGen = useRef(0);
  const closeTimer = useRef<number | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const listLead =
    renderedId != null
      ? (leadItems.find((lead) => lead.id === renderedId) ?? null)
      : null;

  const resetReasonForm = () => {
    setReasonOpen(false);
    setReason("");
    setReasonError(null);
    setReasonSubmitting(false);
  };

  // Instant open/close — no width animation (avoids table scroll jitter).
  useEffect(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    if (previewLeadId) {
      setRenderedId(previewLeadId);
      setExpanded(true);
      resetReasonForm();
      return;
    }

    setExpanded(false);
    resetReasonForm();
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
      if (event.key === "Escape") {
        if (reasonOpen && !reasonSubmitting) {
          resetReasonForm();
          return;
        }
        closeLeadPreview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, closeLeadPreview, reasonOpen, reasonSubmitting]);

  useEffect(() => {
    if (!reasonOpen) return;
    const id = window.requestAnimationFrame(() => {
      reasonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [reasonOpen]);

  if (!renderedId) return null;

  const title =
    detail?.fullName?.trim() ||
    listLead?.leadLabel?.trim() ||
    "Lead details";
  const isNotAppropriate = isLeadNotAppropriate(detail) || isLeadNotAppropriate(listLead);
  const notAppropriateReason =
    detail?.notAppropriateReason?.trim() ||
    "";
  const canSubmitNotAppropriate = allowNotAppropriate && !isNotAppropriate;

  const submitNotAppropriate = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN) {
      setReasonError(`Please explain why (at least ${REASON_MIN} characters).`);
      return;
    }
    if (trimmed.length > REASON_MAX) {
      setReasonError(`Reason must be at most ${REASON_MAX} characters.`);
      return;
    }
    setReasonSubmitting(true);
    setReasonError(null);
    try {
      const updated = await markLeadNotAppropriate(renderedId, trimmed);
      setDetail(updated);
      patchLead(renderedId, leadDetailToListPatch(updated));
      resetReasonForm();
    } catch (err: unknown) {
      setReasonError(
        err instanceof Error ? err.message : "Failed to submit reason",
      );
    } finally {
      setReasonSubmitting(false);
    }
  };
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
                {listLead?.createdAt || detail?.createdAt
                  ? ` · ${formatLeadAddedAt(
                      listLead?.createdAt || detail?.createdAt,
                      listLead?.createdAtRaw,
                    )}`
                  : ""}
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

              {isNotAppropriate ? (
                <div
                  role="status"
                  className="rounded-xl border border-[rgba(201,42,42,0.18)] bg-[#fff5f5] px-3 py-3"
                >
                  <p className="text-[11px] font-semibold tracking-[0.06em] text-[#c92a2a] uppercase">
                    Not appropriate
                  </p>
                  <p className="mt-1 text-[12px] text-[#868e96]">
                    Qualification set to Irrelevant
                  </p>
                  {notAppropriateReason ? (
                    <p className="mt-1.5 text-[13px] leading-snug whitespace-pre-wrap text-[#495057]">
                      {notAppropriateReason}
                    </p>
                  ) : null}
                  {detail?.notAppropriateAt ? (
                    <p className="mt-2 text-[11px] text-[#adb5bd]">
                      {formatDateTimeLabel(detail.notAppropriateAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}

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
                  <Field
                    label="Date"
                    value={
                      detail?.createdAt
                        ? formatDate(detail.createdAt)
                        : listLead
                          ? formatLeadAddedAt(
                              listLead.createdAt,
                              listLead.createdAtRaw,
                            )
                          : null
                    }
                  />
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
                  {detail?.closedAt || listLead?.closedAt ? (
                    <>
                      <Field label="Closed" value="Closed" />
                      <Field
                        label="Closed at"
                        value={formatDateTimeLabel(
                          detail?.closedAt || listLead?.closedAt,
                        )}
                      />
                      <Field
                        label="Time to close"
                        value={formatDurationMinutes(
                          detail?.timeToCloseMinutes ??
                            listLead?.timeToCloseMinutes,
                        )}
                      />
                    </>
                  ) : (
                    <Field
                      label="Closed"
                      value={detail?.closed || listLead?.closed || "Open"}
                    />
                  )}
                </div>
              </section>

              {detail?.qualificationHistory &&
              detail.qualificationHistory.length > 0 ? (
                <section className="space-y-2.5 border-t border-[rgba(33,37,41,0.05)] pt-4">
                  <p className="text-[11px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                    Status history
                  </p>
                  <ol className="m-0 list-none space-y-0 p-0">
                    {[...detail.qualificationHistory]
                      .reverse()
                      .map((step, idx, arr) => {
                        const when = formatDateTimeLabel(step.changedAt);
                        const duration = formatDurationMinutes(
                          step.minutesInStatus,
                        );
                        const isLast = idx === arr.length - 1;
                        return (
                          <li
                            key={`${step.changedAt}-${step.toStatus}-${idx}`}
                            className="relative flex gap-3 pb-3 last:pb-0"
                          >
                            <div className="relative flex w-3 shrink-0 flex-col items-center self-stretch">
                              <span
                                className={[
                                  "mt-1.5 h-2 w-2 shrink-0 rounded-full ring-2",
                                  step.isCurrent
                                    ? "bg-[#e86812] ring-[rgba(232,104,18,0.22)]"
                                    : "bg-[#ced4da] ring-transparent",
                                ].join(" ")}
                                aria-hidden
                              />
                              {!isLast ? (
                                <span
                                  className="mt-1 w-px flex-1 bg-[rgba(33,37,41,0.08)]"
                                  aria-hidden
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-3">
                                <p
                                  className={[
                                    "min-w-0 truncate text-[13px] leading-snug",
                                    step.isCurrent
                                      ? "font-medium text-[#212529]"
                                      : "text-[#495057]",
                                  ].join(" ")}
                                >
                                  {step.toLabel}
                                </p>
                                <p
                                  className={[
                                    "shrink-0 tabular-nums text-[12px] leading-snug",
                                    step.isCurrent
                                      ? "font-medium text-[#9a3f00]"
                                      : "text-[#868e96]",
                                  ].join(" ")}
                                >
                                  {duration}
                                </p>
                              </div>
                              {(when || step.actorName) && (
                                <p className="mt-0.5 truncate text-[11px] text-[#adb5bd]">
                                  {[when, step.actorName]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                  </ol>
                </section>
              ) : null}

              <section className="space-y-3 border-t border-[rgba(33,37,41,0.05)] pt-4">
                <p className="text-[11px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                  First response
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="First client message"
                    value={formatDateTimeLabel(detail?.firstClientMessageAt)}
                  />
                  <Field
                    label="First agent message"
                    value={formatDateTimeLabel(detail?.firstAgentMessageAt)}
                  />
                  <Field
                    label="Response time"
                    value={
                      detail?.firstResponseMinutes != null
                        ? formatFirstResponse(detail.firstResponseMinutes)
                        : null
                    }
                  />
                </div>
                {detail?.firstResponseProofPath ? (
                  <ProofThumb path={detail.firstResponseProofPath} />
                ) : (
                  <p className="text-[12px] text-[#adb5bd]">No screenshot proof</p>
                )}
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

              {seMode && allowSalesOutcome && !isNotAppropriate ? (
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
          {reasonOpen ? (
            <div className="space-y-2.5">
              <div>
                <label
                  htmlFor="lf-not-appropriate-reason"
                  className="text-[11px] font-medium tracking-[0.06em] text-[#868e96] uppercase"
                >
                  Why not appropriate
                </label>
                <p className="mt-1 text-[11px] leading-snug text-[#adb5bd]">
                  Submitting sets this lead to Irrelevant and adds a Not
                  appropriate badge.
                </p>
                <textarea
                  id="lf-not-appropriate-reason"
                  ref={reasonRef}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (reasonError) setReasonError(null);
                  }}
                  rows={4}
                  maxLength={REASON_MAX}
                  disabled={reasonSubmitting}
                  placeholder="Explain why this lead is not appropriate for sales…"
                  className="mt-1.5 w-full resize-none rounded-lg border border-[rgba(33,37,41,0.1)] bg-white px-3 py-2 text-[13px] leading-snug text-[#212529] outline-none placeholder:text-[#adb5bd] focus:border-[rgba(33,37,41,0.28)] disabled:opacity-60"
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-[#adb5bd]">
                    Min {REASON_MIN} characters
                  </p>
                  <p className="text-[11px] tabular-nums text-[#adb5bd]">
                    {reason.trim().length}/{REASON_MAX}
                  </p>
                </div>
                {reasonError ? (
                  <p className="mt-1 text-[12px] text-[#c92a2a]">{reasonError}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reasonSubmitting}
                  onClick={resetReasonForm}
                  className="lf-pressable h-9 flex-1 rounded-lg border border-[rgba(33,37,41,0.08)] bg-white text-[12px] font-medium text-[#495057] hover:bg-[#f8f9fa] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reasonSubmitting || reason.trim().length < REASON_MIN}
                  onClick={() => void submitNotAppropriate()}
                  className="lf-pressable inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#c92a2a] text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {reasonSubmitting ? (
                    <>
                      <LoaderCircle size={13} className="animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {allowNotAppropriate ? (
                <button
                  type="button"
                  disabled={!canSubmitNotAppropriate || loading}
                  onClick={() => {
                    if (!canSubmitNotAppropriate) return;
                    setReasonOpen(true);
                    setReasonError(null);
                  }}
                  className={[
                    "lf-pressable h-9 flex-1 rounded-lg border text-[12px] font-medium",
                    isNotAppropriate
                      ? "cursor-default border-[rgba(201,42,42,0.2)] bg-[#fff5f5] text-[#c92a2a]"
                      : "border-[rgba(201,42,42,0.22)] bg-white text-[#c92a2a] hover:bg-[#fff5f5]",
                  ].join(" ")}
                >
                  {isNotAppropriate ? "Marked" : "Not appropriate"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeLeadPreview}
                className={[
                  "lf-pressable h-9 rounded-lg border border-[rgba(33,37,41,0.08)] bg-white text-[12px] font-medium text-[#495057] hover:bg-[#f8f9fa]",
                  allowProfileEdit || allowNotAppropriate ? "flex-1" : "w-full",
                ].join(" ")}
              >
                Close
              </button>
              {allowProfileEdit && !isNotAppropriate ? (
                <button
                  type="button"
                  onClick={() => onEdit(renderedId)}
                  className="lf-pressable h-9 flex-1 rounded-lg bg-[#212529] text-[12px] font-medium text-white hover:opacity-90"
                >
                  Edit info
                </button>
              ) : allowProfileEdit && isNotAppropriate ? (
                <button
                  type="button"
                  disabled
                  title="Not appropriate leads cannot be edited"
                  className="lf-pressable h-9 flex-1 cursor-not-allowed rounded-lg bg-[#212529] text-[12px] font-medium text-white opacity-40"
                >
                  Edit info
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
