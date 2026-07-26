"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  fetchLead,
  fetchLeads,
  fetchPipelineSummary,
  type PipelineSummary,
} from "@/lib/api";
import type { LeadRecord } from "@/lib/leads-data";
import { useVirtualWindow } from "@/hooks/use-virtual-window";
import {
  isLeadAnalyst,
  isAnalystTeamLead,
  isMainTeamLead,
  isSalesExecutive,
  isSuperadmin,
} from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

const PAGE_SIZE = 40;
const ROW_HEIGHT = 64;

export type PipelineBucket =
  | "all"
  | "assigned"
  | "in-progress"
  | "converted"
  | "lost";

const BUCKET_FILTER: Record<PipelineBucket, string> = {
  all: "pipeline",
  assigned: "pipeline-assigned",
  "in-progress": "pipeline-in-progress",
  converted: "pipeline-won",
  lost: "pipeline-lost",
};

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString("en-US");
}

function canAccessPipeline(role: string | null | undefined) {
  return (
    isLeadAnalyst(role) ||
    isAnalystTeamLead(role) ||
    isSuperadmin(role) ||
    isMainTeamLead(role) ||
    isSalesExecutive(role)
  );
}

function stageBadgeClass(stageRaw: string) {
  switch (stageRaw) {
    case "PRE_SALES":
      return "border-[rgba(33,37,41,0.12)] bg-[#f1f3f5] text-[#495057]";
    case "WITH_TEAM_LEAD":
      return "border-[rgba(34,139,230,0.28)] bg-[#e7f5ff] text-[#1864ab]";
    case "WITH_EXECUTIVE":
      return "border-[rgba(12,166,120,0.28)] bg-[#e6fcf5] text-[#087f5b]";
    case "NOT_CONNECTED":
      return "border-[rgba(250,176,5,0.35)] bg-[#fff9db] text-[#e67700]";
    case "IN_NEGOTIATION":
      return "border-[rgba(232,104,18,0.28)] bg-[#fff4e6] text-[#9a3f00]";
    case "NO_RESPONSE_FROM_CLIENT":
      return "border-[rgba(134,142,150,0.35)] bg-[#f8f9fa] text-[#868e96]";
    case "CLOSED_WON":
      return "border-[rgba(47,158,68,0.28)] bg-[#ebfbee] text-[#2b8a3e]";
    case "CLOSED_LOST":
      return "border-[rgba(224,49,49,0.28)] bg-[#fff5f5] text-[#c92a2a]";
    default:
      return "border-[rgba(33,37,41,0.1)] bg-white text-[#212529]";
  }
}

function PipelineStageBadge({
  label,
  stageRaw,
}: {
  label: string;
  stageRaw: string;
}) {
  if (!label || label === "—") {
    return <span className="text-[13px] text-[#adb5bd]">—</span>;
  }
  return (
    <span
      className={[
        "inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-[-0.01em]",
        stageBadgeClass(stageRaw),
      ].join(" ")}
      title={label}
    >
      {label}
    </span>
  );
}

function noteText(notes: string | null | undefined) {
  const text = (notes ?? "").trim();
  if (!text || text === "—") return "";
  return text;
}

/** Short, stable display name — avoids wide cells shifting columns while scrolling. */
function displayLeadName(full: string | null | undefined) {
  const raw = (full ?? "").trim();
  if (!raw || raw === "—") return { short: "—", full: "" };
  const parts = raw.split(/\s+/).filter(Boolean);
  let short = parts[0] ?? raw;
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    short = `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
  }
  if (short.length > 22) {
    short = `${short.slice(0, 21)}…`;
  }
  return { short, full: raw };
}

function NoteCell({
  leadId,
  leadName,
  preview,
}: {
  leadId: string;
  leadName: string;
  preview: string;
}) {
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fullNote, setFullNote] = useState<string | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const text = noteText(preview);
  const titleName = displayLeadName(leadName);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 160);
  }, []);

  const openPanel = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (!open) {
      setFullNote(null);
      setNoteError(null);
      setLoadingNote(false);
      return;
    }
    const controller = new AbortController();
    setLoadingNote(true);
    setNoteError(null);
    void fetchLead(leadId, controller.signal)
      .then((detail) => {
        if (controller.signal.aborted) return;
        const note = noteText(detail.notes);
        setFullNote(note || "No notes recorded.");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setNoteError(err instanceof Error ? err.message : "Failed to load note");
        setFullNote(text || null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingNote(false);
      });
    return () => controller.abort();
  }, [open, leadId, text]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!text) {
    return (
      <span className="block h-8 overflow-hidden text-[13px] leading-8 text-[#adb5bd]">
        —
      </span>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : openPanel())}
        className={[
          "group/note relative block h-8 w-full min-w-0 overflow-hidden rounded-md px-1.5 text-left outline-none transition-[background-color,box-shadow,color] duration-150",
          "hover:bg-[#fff7ef] hover:shadow-[inset_0_0_0_1px_rgba(232,104,18,0.22)]",
          "focus-visible:bg-[#fff7ef] focus-visible:shadow-[inset_0_0_0_1px_rgba(232,104,18,0.35)]",
          open ? "bg-[#fff7ef] shadow-[inset_0_0_0_1px_rgba(232,104,18,0.28)]" : "",
        ].join(" ")}
        title="View full note"
      >
        <span
          className={[
            "block truncate text-[13px] leading-8 transition-colors duration-150",
            open
              ? "text-[#9a3f00]"
              : "text-[#495057] group-hover/note:text-[#9a3f00]",
          ].join(" ")}
        >
          {text}
        </span>
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
              <button
                type="button"
                aria-label="Close note"
                className={[
                  "absolute inset-0 bg-[rgba(33,37,41,0.28)] backdrop-blur-[2px] transition-opacity duration-150",
                  visible ? "opacity-100" : "opacity-0",
                ].join(" ")}
                onClick={close}
              />
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-label="Lead note"
                tabIndex={-1}
                className={[
                  "relative z-[1] flex max-h-[min(72vh,520px)] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.08)] bg-white shadow-[0_24px_64px_rgba(33,37,41,0.18)] outline-none transition-[opacity,transform] duration-150 ease-out",
                  visible
                    ? "translate-y-0 scale-100 opacity-100"
                    : "translate-y-2 scale-[0.98] opacity-0",
                ].join(" ")}
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[rgba(33,37,41,0.06)] px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium tracking-[0.08em] text-[#adb5bd] uppercase">
                      Analyst note
                    </p>
                    <p
                      className="mt-1 truncate text-[15px] font-medium tracking-[-0.02em] text-[#212529]"
                      title={titleName.full || undefined}
                    >
                      {titleName.full || titleName.short}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="lf-pressable -mr-1 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#868e96] transition-colors hover:bg-[#f8f9fa] hover:text-[#212529]"
                    aria-label="Close"
                  >
                    <span className="text-[18px] leading-none">×</span>
                  </button>
                </div>
                <div className="lf-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {loadingNote && !fullNote ? (
                    <div className="space-y-2.5 py-1">
                      <div className="h-3 w-[92%] animate-pulse rounded bg-[#f1f3f5]" />
                      <div className="h-3 w-[78%] animate-pulse rounded bg-[#f1f3f5]" />
                      <div className="h-3 w-[86%] animate-pulse rounded bg-[#f1f3f5]" />
                    </div>
                  ) : noteError && !fullNote ? (
                    <p className="text-[13px] text-[#c92a2a]">{noteError}</p>
                  ) : (
                    <p className="whitespace-pre-wrap text-[14px] leading-[1.65] text-[#343a40]">
                      {fullNote}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-end border-t border-[rgba(33,37,41,0.06)] bg-[#fafbfc] px-5 py-3">
                  <button
                    type="button"
                    onClick={close}
                    className="lf-pressable inline-flex h-9 items-center rounded-lg bg-[#212529] px-3.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function PipelineContent() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const allowed = canAccessPipeline(role);

  const [bucket, setBucket] = useState<PipelineBucket>("all");
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [items, setItems] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const epochRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const moreAbortRef = useRef<AbortController | null>(null);

  const bindScrollRoot = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setScrollRoot((prev) => (prev === node ? prev : node));
  }, []);

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    void fetchPipelineSummary({ signal: controller.signal })
      .then(setSummary)
      .catch(() => {
        /* list error surface is enough */
      });
    return () => controller.abort();
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    moreAbortRef.current?.abort();
    const controller = new AbortController();
    const epoch = ++epochRef.current;
    setLoading(true);
    setError(null);
    setItems([]);
    setNextCursor("");
    setHasMore(false);

    const filter = BUCKET_FILTER[bucket];

    void fetchLeads({
      filter,
      sort: "newest",
      limit: PAGE_SIZE,
      signal: controller.signal,
    })
      .then((page) => {
        if (controller.signal.aborted || epoch !== epochRef.current) return;
        setItems(page.items ?? []);
        setTotal(page.total ?? 0);
        setNextCursor(page.nextCursor ?? "");
        setHasMore(Boolean(page.hasMore));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || epoch !== epochRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load pipeline");
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!controller.signal.aborted && epoch === epochRef.current) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [allowed, bucket]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMoreRef.current) return;
    const epoch = epochRef.current;
    moreAbortRef.current?.abort();
    const controller = new AbortController();
    moreAbortRef.current = controller;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const filter = BUCKET_FILTER[bucket];
      const page = await fetchLeads({
        filter,
        sort: "newest",
        cursor: nextCursor,
        limit: PAGE_SIZE,
        signal: controller.signal,
      });
      if (controller.signal.aborted || epoch !== epochRef.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        const next = page.items ?? [];
        // Never trim the head — dropping early rows breaks virtual index→offset
        // mapping and makes the list jump to top/end while scrolling.
        return [...prev, ...next.filter((l) => !seen.has(l.id))];
      });
      setNextCursor(page.nextCursor ?? "");
      setHasMore(Boolean(page.hasMore));
      if (typeof page.total === "number") setTotal(page.total);
    } catch (err: unknown) {
      if (controller.signal.aborted || epoch !== epochRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      if (epoch === epochRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [bucket, hasMore, nextCursor]);

  const onIntersect = useEffectEvent(() => {
    if (loadingMoreRef.current) return;
    void loadMore();
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => onIntersect());
      },
      // Modest prefetch — a huge rootMargin made the first nudge cascade
      // load-more until the end of the list.
      { root: scrollRoot, rootMargin: "160px 0px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // Re-arm when the window grows (sentinel may stay intersecting), but do
    // not depend on loadingMore — that recreated the observer every page and
    // caused scroll jumps.
  }, [hasMore, loading, items.length, scrollRoot]);

  const virtual = useVirtualWindow({
    root: scrollRoot,
    count: items.length,
    rowHeight: ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = useMemo(
    () => items.slice(virtual.startIndex, virtual.endIndex),
    [items, virtual.startIndex, virtual.endIndex],
  );

  const seScoped = isSalesExecutive(role);
  const cards: Array<{
    id: PipelineBucket;
    label: string;
    value: number;
    hint: string;
  }> = [
    ...(seScoped
      ? [
          {
            id: "all" as const,
            label: "Total assigned to me",
            value: summary?.total ?? 0,
            hint: "All leads assigned to you",
          },
        ]
      : []),
    {
      id: "assigned",
      label: seScoped ? "Assigned to me" : "Passed to SE/TLs",
      value: summary?.assignedInternal ?? 0,
      hint: seScoped
        ? "Currently with you"
        : "With team lead · with executive",
    },
    {
      id: "in-progress",
      label: "In progress",
      value: summary?.inProgress ?? 0,
      hint: "Working · negotiating · no response",
    },
    {
      id: "converted",
      label: "Closed",
      value: summary?.closedWon ?? 0,
      hint: "Won deals",
    },
    {
      id: "lost",
      label: "Lost",
      value: summary?.closedLost ?? 0,
      hint: "Lost deals",
    },
  ];

  if (!allowed) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 sm:gap-4">
      <div
        className={[
          "grid shrink-0 gap-2 sm:gap-3",
          seScoped
            ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
            : "grid-cols-2 md:grid-cols-4",
        ].join(" ")}
      >
        {cards.map((card) => {
          const active = bucket === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (card.id === "all") {
                  setBucket("all");
                  return;
                }
                setBucket((prev) => (prev === card.id ? "all" : card.id));
              }}
              className={[
                "lf-pressable rounded-2xl border px-3 py-3 text-left transition-colors sm:px-4 sm:py-3.5",
                active
                  ? "border-[rgba(232,104,18,0.35)] bg-[#fff7ef]"
                  : "border-[rgba(33,37,41,0.06)] bg-white hover:bg-[#fafbfc]",
              ].join(" ")}
            >
              <p className="text-[12px] text-[#868e96]">{card.label}</p>
              <p className="mt-1 text-[22px] font-medium tracking-[-0.04em] tabular-nums text-[#212529]">
                {formatCount(card.value)}
              </p>
              <p className="mt-1 hidden text-[11px] text-[#adb5bd] sm:block">{card.hint}</p>
            </button>
          );
        })}
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(33,37,41,0.05)] px-4 py-3">
          <p className="text-[13px] text-[#495057]">
            Showing{" "}
            <span className="font-medium tabular-nums text-[#212529]">
              {formatCount(items.length)}
            </span>
            {total > 0 ? (
              <>
                {" "}
                of{" "}
                <span className="font-medium tabular-nums text-[#212529]">
                  {formatCount(total)}
                </span>
              </>
            ) : null}
            {bucket !== "all" ? (
              <span className="text-[#868e96]">
                {" "}
                · {cards.find((c) => c.id === bucket)?.label}
              </span>
            ) : null}
          </p>
          {bucket !== "all" ? (
            <button
              type="button"
              onClick={() => setBucket("all")}
              className="lf-pressable text-[12px] font-medium text-[#9a3f00] hover:underline"
            >
              Clear filter
            </button>
          ) : null}
        </div>

        <div
          ref={bindScrollRoot}
          className="lf-scroll min-h-0 flex-1 overflow-auto [overflow-anchor:none]"
        >
          {loading && items.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-[13px] text-[#868e96]">Loading pipeline…</p>
            </div>
          ) : error && items.length === 0 ? (
            <div className="flex h-40 items-center justify-center px-4">
              <p className="text-[13px] text-[#c92a2a]">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-[13px] text-[#868e96]">No leads in this stage.</p>
            </div>
          ) : (
            <>
              <table className="w-full min-w-[720px] table-fixed border-collapse text-left md:min-w-[960px]">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[16%]" />
                  <col className="w-[34%]" />
                  <col className="w-[8%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-[rgba(33,37,41,0.06)] text-[11px] tracking-[0.08em] text-[#adb5bd] uppercase">
                    <th className="px-4 py-2.5 font-medium">Source</th>
                    <th className="px-4 py-2.5 font-medium">Lead name</th>
                    <th className="px-4 py-2.5 font-medium">Note</th>
                    <th className="px-4 py-2.5 font-medium">Score</th>
                    <th className="px-4 py-2.5 font-medium">Pipeline status</th>
                    <th className="px-4 py-2.5 font-medium">Qualified on</th>
                  </tr>
                </thead>
                <tbody>
                  {virtual.offsetTop > 0 ? (
                    <tr aria-hidden>
                      <td
                        colSpan={6}
                        style={{
                          height: virtual.offsetTop,
                          padding: 0,
                          border: 0,
                        }}
                      />
                    </tr>
                  ) : null}
                  {virtualRows.map((lead) => {
                    const name = displayLeadName(lead.leadLabel);
                    return (
                      <tr
                        key={lead.id}
                        className="border-b border-[rgba(33,37,41,0.04)] hover:bg-[#fafbfc]"
                        style={{ height: ROW_HEIGHT }}
                      >
                        <td className="overflow-hidden px-4 py-2 text-[13px] text-[#495057]">
                          <span className="block truncate" title={lead.source || undefined}>
                            {lead.source || "—"}
                          </span>
                        </td>
                        <td className="overflow-hidden px-4 py-2 text-[13px] font-medium text-[#212529]">
                          <span className="block truncate" title={name.full || undefined}>
                            {name.short}
                          </span>
                        </td>
                        <td className="overflow-hidden px-4 py-2 align-middle">
                          <NoteCell
                            leadId={lead.id}
                            leadName={lead.leadLabel}
                            preview={lead.analystNotes}
                          />
                        </td>
                        <td className="overflow-hidden px-4 py-2 text-[13px] tabular-nums text-[#212529]">
                          <span className="block truncate">{lead.score || "—"}</span>
                        </td>
                        <td className="overflow-hidden px-4 py-2">
                          <PipelineStageBadge
                            label={lead.stage}
                            stageRaw={lead.stageRaw}
                          />
                        </td>
                        <td className="overflow-hidden px-4 py-2 text-[13px] text-[#495057]">
                          <span className="block truncate">
                            {lead.createdAt || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {virtual.offsetBottom > 0 ? (
                    <tr aria-hidden>
                      <td
                        colSpan={6}
                        style={{
                          height: virtual.offsetBottom,
                          padding: 0,
                          border: 0,
                        }}
                      />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </>
          )}

          {hasMore ? (
            <div
              ref={sentinelRef}
              className="flex items-center justify-center py-4"
            >
              <p className="text-[12px] text-[#adb5bd]">
                {loadingMore ? "Loading more…" : "Scroll for more"}
              </p>
            </div>
          ) : items.length > 0 ? (
            <p className="px-4 py-3 text-center text-[12px] text-[#adb5bd]">
              End of results · {formatCount(total)} leads
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
