"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isAbortError } from "@/lib/reset-client-state";
import { fetchLeads } from "@/lib/api";
import type { LeadRecord } from "@/lib/leads-data";
import {
  DEFAULT_VISIBLE_COLUMNS,
  type LeadColumnId,
} from "@/lib/leads-columns";
import {
  deepLinkKey,
  type LeadsDeepLink,
} from "@/lib/leads-href";
import { normalizeDateRange } from "@/lib/lead-filter-labels";
import { useLeadsScrollStore } from "@/store/leads-scroll-store";

type SelectedMap = Record<string, true>;
type VisibleColumns = Record<LeadColumnId, boolean>;

export type LeadFacets = {
  country: string;
  city: string;
  teamId: string;
  analystId: string;
  salesExecId: string;
  source: string;
  portal: string;
  metaProfile: string;
  status: string;
  stage: string;
  /** Report brand scope: CDR | CCL | PTE | ACS. */
  serviceLine: string;
  /** Exact extracted qualification reason. */
  reason: string;
  addedFrom: string;
  addedTo: string;
};

const EMPTY_FACETS: LeadFacets = {
  country: "",
  city: "",
  teamId: "",
  analystId: "",
  salesExecId: "",
  source: "",
  portal: "",
  metaProfile: "",
  status: "",
  stage: "",
  serviceLine: "",
  reason: "",
  addedFrom: "",
  addedTo: "",
};

type LeadsState = {
  filterValue: string;
  sortValue: string;
  searchQuery: string;
  /** Empty = global search; otherwise a LeadColumnId scope. */
  searchField: string;
  searchBarOpen: boolean;
  facets: LeadFacets;
  /** Last applied deep-link key (avoids re-applying identical URL). */
  appliedDeepLinkKey: string;
  visibleColumns: VisibleColumns;
  selectedById: SelectedMap;
  selectedCount: number;
  pageSize: number;
  /** Bumps on filter/sort reset — stale fetches no-op. */
  queryEpoch: number;
  items: LeadRecord[];
  totalAvailable: number;
  nextCursor: string;
  hasMore: boolean;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  isQueryPending: boolean;
  error: string | null;
  showStatistics: boolean;
  flashAssignedById: Record<string, true>;

  setFilterValue: (value: string) => void;
  setSortValue: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setSearchField: (field: string | null) => void;
  setSearchBarOpen: (open: boolean) => void;
  clearSearchQuery: () => void;
  clearFacets: () => void;
  /** Apply filter preset + facets together (filter sidebar). */
  applyFilters: (next: {
    filterValue: string;
    facets: LeadFacets;
  }) => void;
  applyDeepLink: (link: LeadsDeepLink) => void;
  toggleStatistics: () => void;
  toggleColumnVisibility: (columnId: LeadColumnId) => void;
  setColumnVisibility: (columnId: LeadColumnId, visible: boolean) => void;
  showAllColumns: () => void;
  hideOptionalColumns: () => void;
  resetColumns: () => void;
  refreshLeads: () => Promise<void>;
  /**
   * Soft reload that keeps the loaded window tall enough for `scrollTop`
   * so the table does not jump to page 1 after edit/create/delete sync.
   */
  refreshLeadsPreservingWindow: (opts?: {
    scrollTop?: number;
    clientHeight?: number;
    anchorId?: string;
    rowHeight?: number;
  }) => Promise<{ scrollTop: number; anchorId?: string }>;
  loadMore: (requestEpoch: number) => Promise<boolean>;
  toggleLeadSelection: (id: string) => void;
  setLeadSelected: (id: string, selected: boolean) => void;
  selectPageLeads: (ids: readonly string[]) => void;
  clearPageLeads: (ids: readonly string[]) => void;
  clearLeadSelection: () => void;
  patchLead: (id: string, patch: Partial<LeadRecord>) => void;
  /** Soft-remove rows after delete without blanking the table. */
  removeLeads: (ids: readonly string[]) => void;
  /** Soft-update rows after assign without blanking the table. */
  applyAssignments: (
    assignments: ReadonlyArray<{
      leadId: string;
      team: string;
      salesExecutive: string;
      handoff: string;
    }>,
  ) => void;
  clearFlashAssigned: (ids?: readonly string[]) => void;
  resetSession: () => void;
};

let flashAssignedTimer: ReturnType<typeof setTimeout> | null = null;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let committedSearchKey = "";

const MIN_VISIBLE_COLUMNS = 2;
const DEFAULT_PAGE_SIZE = 40;
// Default to newest — uses createdAt index. "name" forces ORDER BY LOWER(leadName)
// which is a full sort over multi-million rows and feels frozen on large DBs.
const DEFAULT_SORT = "newest";
const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 320;

function searchKey(query: string, field: string) {
  const q =
    query.trim().length >= SEARCH_MIN_CHARS ? query.trim() : "";
  return `${field}|${q}`;
}

let pageAbort: AbortController | null = null;
let moreAbort: AbortController | null = null;

function abortAllFetches() {
  pageAbort?.abort();
  moreAbort?.abort();
  pageAbort = null;
  moreAbort = null;
}

function countVisible(columns: VisibleColumns) {
  return Object.values(columns).filter(Boolean).length;
}

function withQueryReset(
  state: LeadsState,
  patch: Partial<
    Pick<
      LeadsState,
      "filterValue" | "sortValue" | "searchQuery" | "searchField" | "facets"
    >
  >,
): Partial<LeadsState> {
  // Filter/sort/search must not restore a deep scroll into a new result set.
  try {
    useLeadsScrollStore.getState().resetSession();
  } catch {
    /* SSR / store not ready */
  }
  // Soft keep previous rows until the first page lands — avoids empty-table flash
  // and scroll-container height collapse that feels like UI "jumping".
  const soft = state.items.length > 0;
  return {
    ...patch,
    queryEpoch: state.queryEpoch + 1,
    items: soft ? state.items : [],
    totalAvailable: soft ? state.totalAvailable : 0,
    nextCursor: "",
    hasMore: false,
    isInitialLoading: !soft,
    isLoadingMore: false,
    isQueryPending: true,
    error: null,
    selectedById: {},
    selectedCount: 0,
  };
}

function facetParams(facets: LeadFacets) {
  return {
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
  };
}

export function facetsToDeepLink(filterValue: string, facets: LeadFacets): LeadsDeepLink {
  return {
    filter: filterValue !== "all" ? filterValue : undefined,
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
  };
}

async function fetchFirstPage(
  get: () => LeadsState,
  set: (partial: Partial<LeadsState>) => void,
  options?: { soft?: boolean },
) {
  const {
    filterValue,
    sortValue,
    searchQuery,
    searchField,
    facets,
    pageSize,
    queryEpoch,
    items,
  } = get();
  abortAllFetches();
  const controller = new AbortController();
  pageAbort = controller;

  const soft = Boolean(options?.soft) && items.length > 0;
  set({
    isInitialLoading: soft ? false : true,
    isQueryPending: true,
    isLoadingMore: false,
    error: null,
  });

  try {
    const result = await fetchLeads({
      filter: filterValue,
      sort: sortValue,
      q:
        searchQuery.trim().length >= SEARCH_MIN_CHARS
          ? searchQuery.trim()
          : undefined,
      field: searchField || undefined,
      ...facetParams(facets),
      limit: pageSize,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    if (get().queryEpoch !== queryEpoch) return;
    set({
      items: result.items,
      totalAvailable: result.total,
      nextCursor: result.nextCursor ?? "",
      hasMore: result.hasMore,
      isInitialLoading: false,
      isQueryPending: false,
      error: null,
    });
  } catch (err) {
    if (get().queryEpoch !== queryEpoch) return;
    if (pageAbort !== controller) return;
    set({
      items: soft ? get().items : [],
      totalAvailable: soft ? get().totalAvailable : 0,
      nextCursor: "",
      hasMore: false,
      isInitialLoading: false,
      isQueryPending: false,
      error: isAbortError(err)
        ? "Request timed out — try applying the filter again"
        : err instanceof Error
          ? err.message
          : "Failed to load leads",
    });
  }
}

export const useLeadsStore = create<LeadsState>()(
  persist(
    (set, get) => ({
      filterValue: "all",
      sortValue: DEFAULT_SORT,
      searchQuery: "",
      searchField: "",
      searchBarOpen: false,
      facets: { ...EMPTY_FACETS },
      appliedDeepLinkKey: "",
      visibleColumns: { ...DEFAULT_VISIBLE_COLUMNS },
      selectedById: {},
      selectedCount: 0,
      pageSize: DEFAULT_PAGE_SIZE,
      queryEpoch: 0,
      items: [],
      totalAvailable: 0,
      nextCursor: "",
      hasMore: false,
      isInitialLoading: true,
      isLoadingMore: false,
      isQueryPending: true,
      error: null,
      showStatistics: true,
      flashAssignedById: {},

      setFilterValue: (value) => {
        const state = get();
        if (state.filterValue === value) return;
        set(
          withQueryReset(state, {
            filterValue: value,
            facets: { ...EMPTY_FACETS },
          }),
        );
        set({ appliedDeepLinkKey: "" });
        void fetchFirstPage(get, set, { soft: true });
      },

      setSortValue: (value) => {
        const state = get();
        if (state.sortValue === value) return;
        set(withQueryReset(state, { sortValue: value }));
        void fetchFirstPage(get, set, { soft: true });
      },

      setSearchQuery: (value) => {
        set({ searchQuery: value, searchBarOpen: true });
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          searchDebounceTimer = null;
          const state = get();
          const nextKey = searchKey(state.searchQuery, state.searchField);
          if (nextKey === committedSearchKey) {
            set({ isQueryPending: false, isInitialLoading: false });
            return;
          }
          committedSearchKey = nextKey;
          set({
            queryEpoch: state.queryEpoch + 1,
            nextCursor: "",
            hasMore: false,
            isLoadingMore: false,
            isQueryPending: true,
            error: null,
            selectedById: {},
            selectedCount: 0,
            isInitialLoading: state.items.length === 0,
          });
          void fetchFirstPage(get, set, { soft: true });
        }, SEARCH_DEBOUNCE_MS);
      },

      setSearchField: (field) => {
        const next = (field ?? "").trim();
        const state = get();
        const resolved =
          next && state.searchField === next ? "" : next;
        if (resolved === state.searchField) {
          set({ searchBarOpen: true });
          return;
        }
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
          searchDebounceTimer = null;
        }
        committedSearchKey = searchKey(state.searchQuery, resolved);
        set({
          searchField: resolved,
          searchBarOpen: true,
          queryEpoch: state.queryEpoch + 1,
          nextCursor: "",
          hasMore: false,
          isLoadingMore: false,
          isQueryPending: true,
          error: null,
          selectedById: {},
          selectedCount: 0,
          isInitialLoading: state.items.length === 0,
        });
        void fetchFirstPage(get, set, { soft: true });
      },

      setSearchBarOpen: (open) => set({ searchBarOpen: open }),

      clearSearchQuery: () => {
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
          searchDebounceTimer = null;
        }
        const state = get();
        if (
          !state.searchQuery &&
          !state.searchField &&
          committedSearchKey === "|"
        ) {
          return;
        }
        committedSearchKey = "|";
        set(
          withQueryReset(state, {
            searchQuery: "",
            searchField: "",
          }),
        );
        set({ searchBarOpen: false });
        void fetchFirstPage(get, set, { soft: true });
      },

      clearFacets: () => {
        const state = get();
        const empty = Object.values(state.facets).every((v) => !v);
        if (empty && state.filterValue === "all") return;
        set(
          withQueryReset(state, {
            filterValue: "all",
            facets: { ...EMPTY_FACETS },
          }),
        );
        set({
          appliedDeepLinkKey: deepLinkKey(facetsToDeepLink("all", EMPTY_FACETS)),
        });
        void fetchFirstPage(get, set, { soft: true });
      },

      applyFilters: ({ filterValue, facets }) => {
        const state = get();
        const status = facets.status?.trim() ?? "";
        const nextFilter = status
          ? "all"
          : filterValue.trim() || "all";
        const range = normalizeDateRange(
          facets.addedFrom ?? "",
          facets.addedTo ?? "",
        );
        const nextFacets: LeadFacets = {
          ...EMPTY_FACETS,
          ...facets,
          country: facets.country?.trim() ?? "",
          city: facets.city?.trim() ?? "",
          teamId: facets.teamId?.trim() ?? "",
          analystId: facets.analystId?.trim() ?? "",
          salesExecId: facets.salesExecId?.trim() ?? "",
          source: facets.source?.trim() ?? "",
          portal: facets.portal?.trim() ?? "",
          metaProfile: facets.metaProfile?.trim() ?? "",
          status,
          stage: facets.stage?.trim() ?? "",
          serviceLine: facets.serviceLine?.trim() ?? "",
          reason: facets.reason?.trim() ?? "",
          addedFrom: range.addedFrom,
          addedTo: range.addedTo,
        };

        const sameFilter = state.filterValue === nextFilter;
        const sameFacets = (
          Object.keys(EMPTY_FACETS) as (keyof LeadFacets)[]
        ).every((key) => state.facets[key] === nextFacets[key]);
        if (sameFilter && sameFacets) return;

        set({
          ...withQueryReset(state, {
            filterValue: nextFilter,
            facets: nextFacets,
          }),
          appliedDeepLinkKey: deepLinkKey(
            facetsToDeepLink(nextFilter, nextFacets),
          ),
        });
        void fetchFirstPage(get, set, { soft: true });
      },

      applyDeepLink: (link) => {
        const key = deepLinkKey(link);
        const state = get();
        if (key && key === state.appliedDeepLinkKey) return;

        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
          searchDebounceTimer = null;
        }

        const status = link.status?.trim() ?? "";
        const range = normalizeDateRange(
          link.addedFrom ?? "",
          link.addedTo ?? "",
        );
        const nextFacets: LeadFacets = {
          country: link.country?.trim() ?? "",
          city: link.city?.trim() ?? "",
          teamId: link.teamId?.trim() ?? "",
          analystId: link.analystId?.trim() ?? "",
          salesExecId: link.salesExecId?.trim() ?? "",
          source: link.source?.trim() ?? "",
          portal: link.portal?.trim() ?? "",
          metaProfile: link.metaProfile?.trim() ?? "",
          status,
          stage: link.stage?.trim() ?? "",
          serviceLine: link.serviceLine?.trim() ?? "",
          reason: link.reason?.trim() ?? "",
          addedFrom: range.addedFrom,
          addedTo: range.addedTo,
        };
        const nextFilter = status
          ? "all"
          : link.filter?.trim() || "all";
        // Exact reason facet replaces notes substring search.
        const nextQuery = link.reason?.trim()
          ? ""
          : (link.q?.trim() ?? "");
        const nextField = link.reason?.trim()
          ? ""
          : (link.field?.trim() ?? "");
        committedSearchKey = searchKey(nextQuery, nextField);

        set({
          ...withQueryReset(state, {
            filterValue: nextFilter,
            searchQuery: nextQuery,
            searchField: nextField,
            facets: nextFacets,
          }),
          appliedDeepLinkKey: key,
          searchBarOpen: Boolean(nextQuery || nextField),
        });
        void fetchFirstPage(get, set, { soft: true });
      },

      toggleStatistics: () =>
        set((state) => ({ showStatistics: !state.showStatistics })),

      toggleColumnVisibility: (columnId) =>
        set((state) => {
          const currentlyVisible = state.visibleColumns[columnId];
          if (
            currentlyVisible &&
            countVisible(state.visibleColumns) <= MIN_VISIBLE_COLUMNS
          ) {
            return state;
          }
          return {
            visibleColumns: {
              ...state.visibleColumns,
              [columnId]: !currentlyVisible,
            },
          };
        }),

      setColumnVisibility: (columnId, visible) =>
        set((state) => {
          if (
            !visible &&
            state.visibleColumns[columnId] &&
            countVisible(state.visibleColumns) <= MIN_VISIBLE_COLUMNS
          ) {
            return state;
          }
          if (state.visibleColumns[columnId] === visible) return state;
          return {
            visibleColumns: {
              ...state.visibleColumns,
              [columnId]: visible,
            },
          };
        }),

      showAllColumns: () =>
        set({ visibleColumns: { ...DEFAULT_VISIBLE_COLUMNS } }),

      hideOptionalColumns: () =>
        set({
          visibleColumns: {
            ...DEFAULT_VISIBLE_COLUMNS,
            source: true,
            portal: false,
            lead: true,
            analyst: true,
            tag: false,
            phone: true,
            email: false,
            clientProfile: false,
            location: true,
            analystNotes: false,
            status: true,
            score: true,
            stage: true,
            closed: false,
            ip: false,
            executiveNotes: false,
            added: true,
            team: true,
            handoff: false,
            contact: false,
            duplicateCheck: false,
            dealValue: false,
            salesExecutive: false,
          },
        }),

      resetColumns: () =>
        set({ visibleColumns: { ...DEFAULT_VISIBLE_COLUMNS } }),

      refreshLeads: async () => {
        const state = get();
        committedSearchKey = searchKey(state.searchQuery, state.searchField);
        set({
          queryEpoch: state.queryEpoch + 1,
          items: [],
          nextCursor: "",
          hasMore: false,
          isInitialLoading: true,
          isQueryPending: true,
          error: null,
          selectedById: {},
          selectedCount: 0,
        });
        await fetchFirstPage(get, set);
      },

      refreshLeadsPreservingWindow: async (opts) => {
        const state = get();
        const rowHeight = opts?.rowHeight ?? 64;
        const scrollTop = Math.max(0, opts?.scrollTop ?? 0);
        const clientHeight = Math.max(320, opts?.clientHeight ?? 640);
        const anchorId = opts?.anchorId;
        const targetCount = Math.max(
          state.pageSize,
          Math.ceil((scrollTop + clientHeight) / rowHeight) + 12,
        );

        committedSearchKey = searchKey(state.searchQuery, state.searchField);
        const queryEpoch = state.queryEpoch + 1;
        set({
          queryEpoch,
          isQueryPending: true,
          isLoadingMore: false,
          error: null,
          // Keep existing rows visible until the replacement window is ready.
        });

        abortAllFetches();
        const controller = new AbortController();
        pageAbort = controller;

        try {
          let items: LeadRecord[] = [];
          let cursor = "";
          let hasMore = true;
          let totalAvailable = state.totalAvailable;

          while (items.length < targetCount && hasMore) {
            const result = await fetchLeads({
              filter: get().filterValue,
              sort: get().sortValue,
              q:
                get().searchQuery.trim().length >= SEARCH_MIN_CHARS
                  ? get().searchQuery.trim()
                  : undefined,
              field: get().searchField || undefined,
              ...facetParams(get().facets),
              cursor: cursor || undefined,
              limit: get().pageSize,
              signal: controller.signal,
            });
            if (controller.signal.aborted) {
              return { scrollTop, anchorId };
            }
            if (get().queryEpoch !== queryEpoch) {
              return { scrollTop, anchorId };
            }

            const seen = new Set(items.map((item) => item.id));
            const appended = result.items.filter((item) => !seen.has(item.id));
            items = [...items, ...appended];
            cursor = result.nextCursor ?? "";
            hasMore = result.hasMore;
            totalAvailable = result.total;

            if (anchorId && items.some((item) => item.id === anchorId)) {
              // Have the anchor row; still fill a bit past the viewport.
              if (items.length >= Math.ceil((scrollTop + clientHeight) / rowHeight) + 4) {
                break;
              }
            }
            if (!result.hasMore || !result.nextCursor) break;
          }

          if (get().queryEpoch !== queryEpoch) {
            return { scrollTop, anchorId };
          }

          set({
            items,
            totalAvailable,
            nextCursor: cursor,
            hasMore,
            isInitialLoading: false,
            isQueryPending: false,
            error: null,
          });
          return { scrollTop, anchorId };
        } catch (err) {
          if (controller.signal.aborted) {
            return { scrollTop, anchorId };
          }
          if (get().queryEpoch !== queryEpoch) {
            return { scrollTop, anchorId };
          }
          set({
            isInitialLoading: false,
            isQueryPending: false,
            error:
              err instanceof Error ? err.message : "Failed to refresh leads",
          });
          return { scrollTop, anchorId };
        }
      },

      loadMore: async (requestEpoch) => {
        const state = get();
        if (requestEpoch !== state.queryEpoch) return false;
        if (state.isLoadingMore || state.isInitialLoading) return false;
        if (!state.hasMore || !state.nextCursor) return false;

        moreAbort?.abort();
        const controller = new AbortController();
        moreAbort = controller;

        set({ isLoadingMore: true });
        try {
          const result = await fetchLeads({
            filter: state.filterValue,
            sort: state.sortValue,
            q:
              state.searchQuery.trim().length >= SEARCH_MIN_CHARS
                ? state.searchQuery.trim()
                : undefined,
            field: state.searchField || undefined,
            ...facetParams(state.facets),
            cursor: state.nextCursor,
            limit: state.pageSize,
            signal: controller.signal,
          });
          if (controller.signal.aborted) {
            if (get().queryEpoch === requestEpoch) {
              set({ isLoadingMore: false });
            }
            return false;
          }
          const latest = get();
          if (requestEpoch !== latest.queryEpoch) {
            set({ isLoadingMore: false });
            return false;
          }

          const seen = new Set(latest.items.map((item) => item.id));
          const appended = result.items.filter((item) => !seen.has(item.id));
          // No head-trimming: dropping top rows breaks the virtual window's
          // index→offset mapping and froze deep scrolls at the old 500 cap.
          // Rendering is virtualized, so long windows only cost memory
          // (~1KB/row) — the practical bound is how far a human scrolls.
          const merged = [...latest.items, ...appended];
          set({
            items: merged,
            totalAvailable: result.total,
            nextCursor: result.nextCursor ?? "",
            hasMore: result.hasMore,
            isLoadingMore: false,
          });
          return appended.length > 0 || result.hasMore;
        } catch (err) {
          if (controller.signal.aborted) {
            if (get().queryEpoch === requestEpoch) {
              set({ isLoadingMore: false });
            }
            return false;
          }
          if (get().queryEpoch !== requestEpoch) {
            set({ isLoadingMore: false });
            return false;
          }
          set({
            isLoadingMore: false,
            error: err instanceof Error ? err.message : "Failed to load more",
          });
          return false;
        }
      },

      toggleLeadSelection: (id) =>
        set((state) => {
          if (state.selectedById[id]) {
            const next = { ...state.selectedById };
            delete next[id];
            return {
              selectedById: next,
              selectedCount: Math.max(0, state.selectedCount - 1),
            };
          }
          return {
            selectedById: { ...state.selectedById, [id]: true },
            selectedCount: state.selectedCount + 1,
          };
        }),

      setLeadSelected: (id, selected) =>
        set((state) => {
          const currently = Boolean(state.selectedById[id]);
          if (currently === selected) return state;
          if (selected) {
            return {
              selectedById: { ...state.selectedById, [id]: true },
              selectedCount: state.selectedCount + 1,
            };
          }
          const next = { ...state.selectedById };
          delete next[id];
          return {
            selectedById: next,
            selectedCount: Math.max(0, state.selectedCount - 1),
          };
        }),

      selectPageLeads: (ids) =>
        set((state) => {
          let added = 0;
          const next = { ...state.selectedById };
          for (const id of ids) {
            if (!next[id]) {
              next[id] = true;
              added += 1;
            }
          }
          if (added === 0) return state;
          return {
            selectedById: next,
            selectedCount: state.selectedCount + added,
          };
        }),

      clearPageLeads: (ids) =>
        set((state) => {
          let removed = 0;
          const next = { ...state.selectedById };
          for (const id of ids) {
            if (next[id]) {
              delete next[id];
              removed += 1;
            }
          }
          if (removed === 0) return state;
          return {
            selectedById: next,
            selectedCount: Math.max(0, state.selectedCount - removed),
          };
        }),

      clearLeadSelection: () =>
        set((state) =>
          state.selectedCount === 0
            ? state
            : { selectedById: {}, selectedCount: 0 },
        ),

      patchLead: (id, patch) =>
        set((state) => {
          const index = state.items.findIndex((item) => item.id === id);
          if (index < 0) return state;
          const current = state.items[index];
          const nextItem = { ...current, ...patch };
          if (nextItem === current) return state;
          const items = state.items.slice();
          items[index] = nextItem;
          return { items };
        }),

      removeLeads: (ids) => {
        if (ids.length === 0) return;
        const remove = new Set(ids);
        set((state) => {
          const items = state.items.filter((item) => !remove.has(item.id));
          if (items.length === state.items.length) return state;
          const nextSelected = { ...state.selectedById };
          let removedSelected = 0;
          for (const id of remove) {
            if (nextSelected[id]) {
              delete nextSelected[id];
              removedSelected += 1;
            }
          }
          return {
            items,
            totalAvailable: Math.max(
              0,
              state.totalAvailable - (state.items.length - items.length),
            ),
            selectedById: nextSelected,
            selectedCount: Math.max(0, state.selectedCount - removedSelected),
          };
        });
      },

      applyAssignments: (assignments) => {
        if (assignments.length === 0) return;
        set((state) => {
          const byId = new Map(
            assignments.map((row) => [row.leadId, row] as const),
          );
          const items = state.items.map((item) => {
            const next = byId.get(item.id);
            if (!next) return item;
            return {
              ...item,
              team: next.team,
              salesExecutive: next.salesExecutive,
              handoff: next.handoff,
              isNew: false,
              tag:
                item.notAppropriate || item.tag === "Not appropriate"
                  ? "Not appropriate"
                  : "—",
            };
          });
          const flash: Record<string, true> = { ...state.flashAssignedById };
          for (const row of assignments) {
            flash[row.leadId] = true;
          }
          return { items, flashAssignedById: flash };
        });
        if (flashAssignedTimer) clearTimeout(flashAssignedTimer);
        const ids = assignments.map((row) => row.leadId);
        flashAssignedTimer = setTimeout(() => {
          get().clearFlashAssigned(ids);
          flashAssignedTimer = null;
        }, 2400);
      },

      clearFlashAssigned: (ids) =>
        set((state) => {
          if (!ids || ids.length === 0) {
            if (Object.keys(state.flashAssignedById).length === 0) return state;
            return { flashAssignedById: {} };
          }
          const next = { ...state.flashAssignedById };
          let changed = false;
          for (const id of ids) {
            if (next[id]) {
              delete next[id];
              changed = true;
            }
          }
          return changed ? { flashAssignedById: next } : state;
        }),

      resetSession: () => {
        abortAllFetches();
        if (flashAssignedTimer) {
          clearTimeout(flashAssignedTimer);
          flashAssignedTimer = null;
        }
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
          searchDebounceTimer = null;
        }
        committedSearchKey = "";
        set((state) => ({
          queryEpoch: state.queryEpoch + 1,
          items: [],
          totalAvailable: 0,
          nextCursor: "",
          hasMore: false,
          selectedById: {},
          selectedCount: 0,
          flashAssignedById: {},
          searchQuery: "",
          searchField: "",
          searchBarOpen: false,
          facets: { ...EMPTY_FACETS },
          appliedDeepLinkKey: "",
          isInitialLoading: true,
          isLoadingMore: false,
          isQueryPending: true,
          error: null,
        }));
      },
    }),
    {
      name: "leadflow-table-prefs",
      partialize: (state) => ({
        visibleColumns: state.visibleColumns,
        showStatistics: state.showStatistics,
        sortValue: state.sortValue,
        pageSize: state.pageSize,
      }),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<LeadsState>;
        const persistedColumns =
          raw.visibleColumns && typeof raw.visibleColumns === "object"
            ? raw.visibleColumns
            : {};
        const persistedSort =
          typeof raw.sortValue === "string" ? raw.sortValue.trim() : "";
        const sortValue = persistedSort || DEFAULT_SORT;
        return {
          ...current,
          visibleColumns: {
            ...DEFAULT_VISIBLE_COLUMNS,
            ...persistedColumns,
          },
          sortValue,
          pageSize:
            typeof raw.pageSize === "number" && raw.pageSize > 0
              ? raw.pageSize
              : DEFAULT_PAGE_SIZE,
        };
      },
    },
  ),
);

export function countSelectedOnPage(
  selectedById: SelectedMap,
  ids: readonly string[],
): number {
  let count = 0;
  for (const id of ids) {
    if (selectedById[id]) count += 1;
  }
  return count;
}

/** Stable per-row selector — row only re-renders when its own selection flips. */
export function selectIsLeadSelected(id: string) {
  return (state: LeadsState) => Boolean(state.selectedById[id]);
}
