"use client";

import { ArrowRight, LoaderCircle, Search, X } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchTransfersPage,
  type LeadTransferLog,
  type SalesExecTeamTransferLog,
  type TransferActionMix,
} from "@/lib/api";
import {
  isLeadAnalyst,
  isMainTeamLead,
  isSalesExecutive,
} from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

type TabId = "leads" | "sales-exec";

const PAGE_SIZE = 40;

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function actionTone(action: string) {
  switch (action) {
    case "DIRECT_ASSIGNED_TO_EXECUTIVE_BY_ATL":
    case "ASSIGNED_TO_EXECUTIVE":
      return "border-[rgba(47,158,68,0.22)] bg-[#ebfbee] text-[#2b8a3e]";
    case "UNASSIGNED_BY_ATL":
      return "border-[rgba(233,136,18,0.28)] bg-[#fff7ef] text-[#9a3f00]";
    case "ROUTED_TO_MAIN_TEAM":
      return "border-[rgba(33,37,41,0.1)] bg-[#f1f3f5] text-[#212529]";
    default:
      return "border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] text-[#6c757d]";
  }
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        size={14}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#adb5bd]"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-[rgba(33,37,41,0.1)] bg-white pr-9 pl-9 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow] placeholder:text-[#adb5bd] focus:border-[rgba(232,104,18,0.45)] focus:shadow-[0_0_0_3px_rgba(232,104,18,0.12)]"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-0.5 text-[#adb5bd] transition-colors hover:bg-[#f8f9fa] hover:text-[#495057]"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}

function SalesExecTable({ items }: { items: SalesExecTeamTransferLog[] }) {
  return (
    <table className="w-full min-w-[640px] border-collapse text-left sm:min-w-[760px]">
      <thead className="sticky top-0 z-10 bg-[#f8f9fa]">
        <tr className="border-b border-[rgba(33,37,41,0.05)] text-[10px] font-medium tracking-[0.06em] text-[#adb5bd] uppercase">
          <th className="w-10 px-3.5 py-2.5 font-medium @[28rem]:px-5">#</th>
          <th className="px-2 py-2.5 font-medium">Sales executive</th>
          <th className="px-2 py-2.5 font-medium">Team move</th>
          <th className="px-2 py-2.5 font-medium">Moved by</th>
          <th className="px-3.5 py-2.5 text-right font-medium @[28rem]:px-5">
            When
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((row, index) => (
          <tr
            key={row.id}
            className="border-b border-[rgba(33,37,41,0.04)] bg-white last:border-b-0 hover:bg-[#fafbfc]"
          >
            <td className="px-3.5 py-2.5 text-[11px] tabular-nums text-[#adb5bd] @[28rem]:px-5">
              {String(index + 1).padStart(2, "0")}
            </td>
            <td className="px-2 py-2.5 text-[13px] font-medium text-[#212529]">
              {row.salesExecName}
            </td>
            <td className="px-2 py-2.5">
              <div className="flex min-w-0 items-center gap-2 text-[13px]">
                <span className="truncate text-[#868e96]">
                  {row.fromTeamName || "Unassigned"}
                </span>
                <ArrowRight
                  size={14}
                  strokeWidth={1.75}
                  className="shrink-0 text-[#e86812]"
                />
                <span className="truncate font-medium text-[#212529]">
                  {row.toTeamName}
                </span>
              </div>
            </td>
            <td className="px-2 py-2.5 text-[13px] text-[#495057]">
              {row.transferredByName}
            </td>
            <td className="px-3.5 py-2.5 text-right text-[12px] tabular-nums text-[#868e96] @[28rem]:px-5">
              {formatWhen(row.createdAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LeadsTable({
  items,
  showActor = true,
}: {
  items: LeadTransferLog[];
  showActor?: boolean;
}) {
  return (
    <table
      className={`w-full border-collapse text-left ${showActor ? "min-w-[760px] sm:min-w-[920px]" : "min-w-[640px] sm:min-w-[760px]"}`}
    >
      <thead className="sticky top-0 z-10 bg-[#f8f9fa]">
        <tr className="border-b border-[rgba(33,37,41,0.05)] text-[10px] font-medium tracking-[0.06em] text-[#adb5bd] uppercase">
          <th className="w-10 px-3.5 py-2.5 font-medium @[28rem]:px-5">#</th>
          <th className="px-2 py-2.5 font-medium">Lead</th>
          <th className="px-2 py-2.5 font-medium">Action</th>
          {showActor ? (
            <th className="px-2 py-2.5 font-medium">Actor</th>
          ) : null}
          <th className="px-2 py-2.5 font-medium">Detail</th>
          <th className="px-3.5 py-2.5 text-right font-medium @[28rem]:px-5">
            When
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((row, index) => (
          <tr
            key={row.id}
            className="border-b border-[rgba(33,37,41,0.04)] bg-white last:border-b-0 hover:bg-[#fafbfc]"
          >
            <td className="px-3.5 py-2.5 text-[11px] tabular-nums text-[#adb5bd] @[28rem]:px-5">
              {String(index + 1).padStart(2, "0")}
            </td>
            <td className="px-2 py-2.5">
              <p className="max-w-[220px] truncate text-[13px] font-medium text-[#212529]">
                {row.leadName}
              </p>
            </td>
            <td className="px-2 py-2.5">
              <span
                className={`inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${actionTone(row.action)}`}
              >
                {row.actionLabel}
              </span>
            </td>
            {showActor ? (
              <td className="px-2 py-2.5 text-[13px] text-[#495057]">
                {row.actorName || "System"}
              </td>
            ) : null}
            <td className="px-2 py-2.5">
              <p className="max-w-[360px] truncate text-[12px] text-[#6c757d]">
                {row.detail || "—"}
              </p>
            </td>
            <td className="px-3.5 py-2.5 text-right text-[12px] tabular-nums text-[#868e96] @[28rem]:px-5">
              {formatWhen(row.createdAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TransfersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  const teamName = useAuthStore((s) => s.user?.teamName);
  const creatorScoped = isLeadAnalyst(role);
  const teamScoped = isMainTeamLead(role);
  const hideActorColumn =
    isMainTeamLead(role) || isSalesExecutive(role);
  const urlTab: TabId =
    !creatorScoped && searchParams.get("tab") === "sales-exec"
      ? "sales-exec"
      : "leads";
  const urlQuery = searchParams.get("q")?.trim() ?? "";

  const [tab, setTab] = useState<TabId>(urlTab);
  const [queryInput, setQueryInput] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery);
  const [actionFilter, setActionFilter] = useState("all");

  const [leadItems, setLeadItems] = useState<LeadTransferLog[]>([]);
  const [seItems, setSeItems] = useState<SalesExecTeamTransferLog[]>([]);
  const [leadCursor, setLeadCursor] = useState<string | undefined>();
  const [seCursor, setSeCursor] = useState<string | undefined>();
  const [leadHasMore, setLeadHasMore] = useState(false);
  const [seHasMore, setSeHasMore] = useState(false);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [tabTotals, setTabTotals] = useState({ leads: 0, salesExecTeam: 0 });
  const [actionMix, setActionMix] = useState<TransferActionMix[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadEpochRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);

  // Debounce search input.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  // Deep-link from notifications: /transfers?tab=&q=
  useEffect(() => {
    setTab(urlTab);
    setQueryInput(urlQuery);
    setQuery(urlQuery);
    setActionFilter("all");
  }, [urlTab, urlQuery]);

  function changeTab(next: TabId) {
    setTab(next);
    setQueryInput("");
    setQuery("");
    setActionFilter("all");
    router.replace(`/transfers?tab=${next}`, { scroll: false });
  }

  const loadPage = useEffectEvent(
    async (opts: { reset: boolean; epoch: number }) => {
      const cursor = opts.reset
        ? undefined
        : tab === "leads"
          ? leadCursor
          : seCursor;

      if (!opts.reset && !cursor) return;
      if (!opts.reset) {
        const hasMore = tab === "leads" ? leadHasMore : seHasMore;
        if (!hasMore || loadingMore) return;
      }

      if (opts.reset) {
        loadAbortRef.current?.abort();
        loadAbortRef.current = new AbortController();
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const signal = loadAbortRef.current?.signal;

      try {
        const data = await fetchTransfersPage({
          type: tab,
          cursor,
          q: query || undefined,
          action: tab === "leads" ? actionFilter : undefined,
          limit: PAGE_SIZE,
          signal,
        });

        if (opts.epoch !== loadEpochRef.current) return;
        if (signal?.aborted) return;

        setTabTotals({
          leads: data.totals?.leads ?? 0,
          salesExecTeam: data.totals?.salesExecTeam ?? 0,
        });
        setFilteredTotal(data.total ?? 0);
        if (Array.isArray(data.actionMix)) setActionMix(data.actionMix);

        if (tab === "leads") {
          const page = (data.items as LeadTransferLog[]) ?? [];
          setLeadItems((prev) => (opts.reset ? page : [...prev, ...page]));
          setLeadCursor(data.nextCursor);
          setLeadHasMore(Boolean(data.hasMore));
        } else {
          const page = (data.items as SalesExecTeamTransferLog[]) ?? [];
          setSeItems((prev) => (opts.reset ? page : [...prev, ...page]));
          setSeCursor(data.nextCursor);
          setSeHasMore(Boolean(data.hasMore));
        }
        setError(null);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        if (opts.epoch !== loadEpochRef.current) return;
        setError(
          err instanceof Error ? err.message : "Failed to load transfers",
        );
      } finally {
        if (opts.epoch === loadEpochRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
  );

  // Reset + fetch when tab/query/action changes.
  useEffect(() => {
    const epoch = ++loadEpochRef.current;
    setLeadItems([]);
    setSeItems([]);
    setLeadCursor(undefined);
    setSeCursor(undefined);
    setLeadHasMore(false);
    setSeHasMore(false);
    void loadPage({ reset: true, epoch });
    return () => {
      loadAbortRef.current?.abort();
    };
  }, [tab, query, actionFilter]);

  // Scroll sentinel for next page.
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const hasMore = tab === "leads" ? leadHasMore : seHasMore;
    if (!hasMore) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          void loadPage({ reset: false, epoch: loadEpochRef.current });
        });
      },
      { root, rootMargin: "280px 0px", threshold: 0 },
    );

    observer.observe(sentinel);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [tab, leadHasMore, seHasMore, leadItems.length, seItems.length]);

  const items = tab === "leads" ? leadItems : seItems;
  const hasMore = tab === "leads" ? leadHasMore : seHasMore;

  const tabs = useMemo(
    () => {
      const leadTab = {
        id: "leads" as const,
        label: "Leads transfer",
        count: tabTotals.leads,
      };
      if (creatorScoped) return [leadTab];
      return [
        leadTab,
        {
          id: "sales-exec" as const,
          label: "SE team transfer",
          count: tabTotals.salesExecTeam,
        },
      ];
    },
    [tabTotals, creatorScoped],
  );

  return (
    <section className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[rgba(33,37,41,0.05)] px-3.5 py-3 @[40rem]:px-5">
        <div className="flex flex-col gap-3 @[48rem]:flex-row @[48rem]:items-end @[48rem]:justify-between">
          <div className="min-w-0">
            <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529] @[28rem]:text-[17px]">
              Transfer logs
            </h2>
            {teamScoped ? (
              <p className="mt-0.5 text-[12px] text-[#868e96]">
                {teamName
                  ? `Handoffs and SE moves for ${teamName}`
                  : "Handoffs and SE moves for your team"}
              </p>
            ) : null}
          </div>

          {!loading || items.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-[#f8f9fa] px-2.5 py-1 text-[11px] tabular-nums text-[#212529]">
                <span className="text-[#868e96]">Matched</span>
                <span className="font-medium">
                  {formatCount(filteredTotal)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-white px-2.5 py-1 text-[11px] tabular-nums text-[#212529]">
                <span className="text-[#868e96]">Loaded</span>
                <span className="font-medium">{formatCount(items.length)}</span>
              </span>
            </div>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Transfer log type"
          className="flex w-full gap-1 rounded-xl bg-[#f8f9fa] p-1"
        >
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeTab(item.id)}
                className={[
                  "lf-pressable relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-white font-medium text-[#212529] shadow-[0_1px_2px_rgba(33,37,41,0.06)]"
                    : "text-[#6c757d] hover:text-[#212529]",
                ].join(" ")}
              >
                <span className="truncate">{item.label}</span>
                <span
                  className={[
                    "rounded-md px-1.5 py-0.5 text-[11px] tabular-nums",
                    active
                      ? "bg-[#fff7ef] text-[#9a3f00]"
                      : "bg-[rgba(33,37,41,0.06)] text-[#868e96]",
                  ].join(" ")}
                >
                  {formatCount(item.count)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField
            value={queryInput}
            onChange={setQueryInput}
            placeholder={
              tab === "sales-exec"
                ? "Search executive, team, or mover…"
                : hideActorColumn
                  ? "Search lead or detail…"
                  : "Search lead, actor, or detail…"
            }
          />
          {tab === "leads" ? (
            <label className="relative shrink-0 sm:w-[240px]">
              <span className="sr-only">Filter by action</span>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-[rgba(33,37,41,0.1)] bg-white px-3 pr-8 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow] focus:border-[rgba(232,104,18,0.45)] focus:shadow-[0_0_0_3px_rgba(232,104,18,0.12)]"
              >
                <option value="all">All transfer actions</option>
                {actionMix.map((action) => (
                  <option key={action.action} value={action.action}>
                    {action.label} ({action.count})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {items.length === 0 && loading ? (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
          <p className="text-[13px] text-[#6c757d]">Loading transfers…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
          <p className="text-[13px] text-[#6c757d]">
            {error ? `Couldn’t load transfers: ${error}` : "No transfers match."}
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="lf-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain"
        >
          {tab === "leads" ? (
            <LeadsTable items={leadItems} showActor={!hideActorColumn} />
          ) : (
            <SalesExecTable items={seItems} />
          )}

          <div
            ref={sentinelRef}
            className="flex items-center justify-center gap-2 px-4 py-4"
            aria-hidden={!hasMore && !loadingMore}
          >
            {loadingMore ? (
              <>
                <LoaderCircle
                  size={14}
                  className="animate-spin text-[#adb5bd]"
                />
                <span className="text-[12px] text-[#868e96]">Loading more…</span>
              </>
            ) : hasMore ? (
              <span className="text-[11px] text-[#adb5bd]">Scroll for more</span>
            ) : (
              <span className="text-[11px] text-[#adb5bd]">
                End of results · {formatCount(items.length)} loaded
              </span>
            )}
          </div>
        </div>
      )}

      {error && items.length > 0 ? (
        <p className="shrink-0 border-t border-[rgba(33,37,41,0.05)] px-4 py-2 text-[12px] text-[#868e96]">
          Couldn’t load more: {error}
        </p>
      ) : null}
    </section>
  );
}
