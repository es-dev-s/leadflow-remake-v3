"use client";

import { ActionButton } from "@/components/dashboard/action-button";
import {
  updateLeadSalesOutcome,
  type LeadDetail,
} from "@/lib/api";
import {
  SE_OUTCOME_OPTIONS,
  isSeOutcomeValue,
  type SeOutcomeValue,
} from "@/lib/lead-filter-labels";
import { leadDetailToListPatch } from "@/lib/lead-record-map";
import { useActionPhase } from "@/hooks/use-action-phase";
import { useLeadsStore } from "@/store/leads-store";
import { useEffect, useMemo, useState } from "react";

type Props = {
  leadId: string;
  detail: LeadDetail | null;
  onSaved?: (detail: LeadDetail) => void;
};

function moneyInputValue(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return String(value);
}

/** Allow digits + one decimal point while typing. */
function sanitizeMoneyTyping(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

function parseMoney(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return Number.NaN;
  return n;
}

export function SeOutcomeForm({ leadId, detail, onSaved }: Props) {
  const patchLead = useLeadsStore((s) => s.patchLead);
  const [stage, setStage] = useState<SeOutcomeValue | "">("");
  const [initialPayment, setInitialPayment] = useState("");
  const [closedRevenue, setClosedRevenue] = useState("");
  const [notes, setNotes] = useState("");
  const {
    phase,
    start,
    succeed,
    fail,
    reset,
    isBusy: saving,
  } = useActionPhase();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!detail || detail.id !== leadId) return;
    setStage(isSeOutcomeValue(detail.salesStage) ? detail.salesStage : "");
    setInitialPayment(moneyInputValue(detail.initialPayment));
    setClosedRevenue(
      moneyInputValue(
        detail.closedRevenue ?? detail.dealValue ?? detail.estimatedDealValue,
      ),
    );
    setNotes(detail.executiveNotes ?? "");
    setError(null);
    reset();
  }, [detail, leadId, reset]);

  const closedRequiresRevenue = stage === "CLOSED_WON";
  const currency = detail?.dealCurrency?.trim() || "AUD";

  const canSave = useMemo(() => {
    if (!stage) return false;
    if (closedRequiresRevenue) {
      const revenue = parseMoney(closedRevenue);
      if (revenue == null || Number.isNaN(revenue) || revenue <= 0) return false;
    }
    const payment = parseMoney(initialPayment);
    if (payment != null && payment < 0) return false;
    const revenue = parseMoney(closedRevenue);
    if (revenue != null && revenue < 0) return false;
    if (Number.isNaN(payment) || Number.isNaN(revenue)) return false;
    return true;
  }, [stage, closedRequiresRevenue, closedRevenue, initialPayment]);

  async function handleSave() {
    if (saving || !canSave || !stage) return;
    const payment = parseMoney(initialPayment);
    const revenue = parseMoney(closedRevenue);
    if (Number.isNaN(payment) || Number.isNaN(revenue)) {
      setError("Enter valid amounts");
      return;
    }
    if (stage === "CLOSED_WON" && (revenue == null || revenue <= 0)) {
      setError("Closed revenue is required when outcome is Closed");
      return;
    }
    if ((payment != null && payment < 0) || (revenue != null && revenue < 0)) {
      setError("Amounts cannot be negative");
      return;
    }

    start();
    setError(null);
    try {
      const result = await updateLeadSalesOutcome(leadId, {
        salesStage: stage,
        initialPayment: payment,
        closedRevenue: revenue,
        executiveNotes: notes.trim() || null,
      });
      patchLead(leadId, leadDetailToListPatch(result));
      onSaved?.(result);
      await succeed("Saved");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      fail();
    }
  }

  return (
    <section className="space-y-3.5 rounded-2xl border border-[rgba(232,104,18,0.18)] bg-[linear-gradient(180deg,#fffaf5_0%,#ffffff_48%)] p-3.5">
      <div>
        <p className="text-[11px] font-medium tracking-[0.08em] text-[#9a3f00] uppercase">
          Edit · Sales outcome
        </p>
        <p className="mt-1 text-[12px] leading-snug text-[#868e96]">
          Update payment, deal value (closed revenue), outcome status, and your
          notes for this lead.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
          Outcome / Closed status
        </label>
        <div className="grid grid-cols-1 gap-1.5">
          {SE_OUTCOME_OPTIONS.map((option) => {
            const active = stage === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStage(option.value)}
                className={[
                  "lf-pressable rounded-xl border px-3 py-2 text-left text-[12px] font-medium transition-colors",
                  active
                    ? "border-[rgba(232,104,18,0.4)] bg-[#fff7ef] text-[#9a3f00]"
                    : "border-[rgba(33,37,41,0.08)] bg-white text-[#495057] hover:border-[rgba(33,37,41,0.14)]",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label
            htmlFor={`se-ip-${leadId}`}
            className="mb-1.5 block text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase"
          >
            Initial payment ({currency})
          </label>
          <input
            id={`se-ip-${leadId}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={initialPayment}
            onChange={(e) => setInitialPayment(sanitizeMoneyTyping(e.target.value))}
            placeholder="0.00"
            className="h-10 w-full rounded-xl border border-[rgba(33,37,41,0.08)] bg-white px-3 text-[13px] tabular-nums text-[#212529] outline-none placeholder:text-[#ced4da] focus:border-[rgba(232,104,18,0.35)] focus:ring-2 focus:ring-[rgba(232,104,18,0.12)]"
          />
        </div>

        <div>
          <label
            htmlFor={`se-rev-${leadId}`}
            className="mb-1.5 flex items-baseline justify-between gap-2 text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase"
          >
            <span>Closed revenue / Deal value ({currency})</span>
            {closedRequiresRevenue ? (
              <span className="normal-case tracking-normal text-[#e8590c]">
                Required
              </span>
            ) : null}
          </label>
          <input
            id={`se-rev-${leadId}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={closedRevenue}
            onChange={(e) => setClosedRevenue(sanitizeMoneyTyping(e.target.value))}
            placeholder="Type deal value, e.g. 4800"
            aria-label={`Closed revenue / Deal value (${currency})`}
            required={closedRequiresRevenue}
            className={[
              "h-10 w-full rounded-xl border bg-white px-3 text-[13px] tabular-nums text-[#212529] outline-none placeholder:text-[#ced4da] focus:ring-2",
              closedRequiresRevenue
                ? "border-[rgba(232,104,18,0.28)] focus:border-[rgba(232,104,18,0.45)] focus:ring-[rgba(232,104,18,0.12)]"
                : "border-[rgba(33,37,41,0.08)] focus:border-[rgba(232,104,18,0.35)] focus:ring-[rgba(232,104,18,0.12)]",
            ].join(" ")}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`se-notes-${leadId}`}
          className="mb-1.5 block text-[10px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase"
        >
          SE notes
        </label>
        <textarea
          id={`se-notes-${leadId}`}
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Call notes, next steps, objections…"
          className="w-full resize-none rounded-xl border border-[rgba(33,37,41,0.08)] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#212529] outline-none placeholder:text-[#ced4da] focus:border-[rgba(232,104,18,0.35)] focus:ring-2 focus:ring-[rgba(232,104,18,0.12)]"
        />
      </div>

      {error ? (
        <p className="text-[12px] text-[#c92a2a]">{error}</p>
      ) : null}

      <ActionButton
        type="button"
        phase={phase}
        disabled={!canSave}
        onClick={() => void handleSave()}
        idleLabel="Save outcome"
        pendingLabel="Saving…"
        successLabel="Saved"
        className="h-10 w-full rounded-xl text-[13px]"
      />
    </section>
  );
}
