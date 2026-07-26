"use client";

import { ActionButton } from "@/components/dashboard/action-button";
import { BackendStatusIndicator } from "@/components/dashboard/backend-status";
import {
  fetchNotifications,
  markNotificationsRead,
  type AppNotification,
} from "@/lib/api";
import { LEAD_COLUMNS } from "@/lib/leads-columns";
import { getNavItemByPath } from "@/lib/navigation";
import { subscribeRealtime } from "@/lib/realtime";
import { canViewLeadData } from "@/lib/roles";
import { useActionPhase } from "@/hooks/use-action-phase";
import {
  hasDashboardFilters,
  useDashboardFilterStore,
} from "@/store/dashboard-filter-store";
import { useAuthStore } from "@/store/auth-store";
import { useLeadsStore } from "@/store/leads-store";
import { useUiStore } from "@/store/ui-store";
import { Bell, Filter, LoaderCircle, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const current = getNavItemByPath(pathname);
  const role = useAuthStore((s) => s.user?.role);
  const showLeadTools = canViewLeadData(role);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const notificationsOpen = useUiStore((s) => s.notificationsOpen);
  const toggleNotifications = useUiStore((s) => s.toggleNotifications);
  const filterSidebarOpen = useUiStore((s) => s.filterSidebarOpen);
  const toggleFilterSidebar = useUiStore((s) => s.toggleFilterSidebar);
  const dashboardFilters = useDashboardFilterStore((s) => s.filters);
  const leadFilterValue = useLeadsStore((s) => s.filterValue);
  const leadFacets = useLeadsStore((s) => s.facets);
  const searchQuery = useLeadsStore((s) => s.searchQuery);
  const searchField = useLeadsStore((s) => s.searchField);
  const searchBarOpen = useLeadsStore((s) => s.searchBarOpen);
  const setSearchQuery = useLeadsStore((s) => s.setSearchQuery);
  const setSearchField = useLeadsStore((s) => s.setSearchField);
  const setSearchBarOpen = useLeadsStore((s) => s.setSearchBarOpen);
  const clearSearchQuery = useLeadsStore((s) => s.clearSearchQuery);
  const isQueryPending = useLeadsStore((s) => s.isQueryPending);

  const [searchOpenLocal, setSearchOpenLocal] = useState(false);
  const searchActive =
    searchBarOpen || searchOpenLocal || searchQuery.trim().length > 0 || Boolean(searchField);

  const searchScopeLabel = LEAD_COLUMNS.find((c) => c.id === searchField)?.label;

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const {
    phase: markAllPhase,
    start: startMarkAll,
    succeed: succeedMarkAll,
    fail: failMarkAll,
    isBusy: markingAll,
  } = useActionPhase(900);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const notifEpochRef = useRef(0);
  const notifAbortRef = useRef<AbortController | null>(null);
  const notifInFlightRef = useRef(false);

  const loadNotifications = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    if (notifInFlightRef.current) return;
    notifAbortRef.current?.abort();
    const controller = new AbortController();
    notifAbortRef.current = controller;
    const epoch = ++notifEpochRef.current;
    notifInFlightRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchNotifications({
        limit: 40,
        signal: controller.signal,
      });
      if (controller.signal.aborted || epoch !== notifEpochRef.current) return;
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch (err: unknown) {
      if (controller.signal.aborted || epoch !== notifEpochRef.current) return;
      setLoadError(
        err instanceof Error ? err.message : "Failed to load notifications",
      );
    } finally {
      if (epoch === notifEpochRef.current) {
        notifInFlightRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    let focusTimer = 0;
    const onFocus = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        void loadNotifications();
      }, 400);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 60000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      notifAbortRef.current?.abort();
      window.clearInterval(interval);
      window.clearTimeout(focusTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!notificationsOpen) return;
    void loadNotifications();
  }, [notificationsOpen, loadNotifications]);

  // Realtime: refresh the bell whenever anything changes anywhere. Coalesced
  // so a burst (bulk assign/import) triggers a single fetch per client.
  useEffect(() => {
    let timer = 0;
    const unsubscribe = subscribeRealtime(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadNotifications();
      }, 400);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inPanel = panelRef.current?.contains(target);
      const onButton = buttonRef.current?.contains(target);
      if (!inPanel && !onButton) {
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
  }, [notificationsOpen]);

  useEffect(() => {
    if (!searchActive) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (searchWrapRef.current?.contains(target)) return;
      if (!searchQuery.trim() && !searchField) {
        setSearchOpenLocal(false);
        setSearchBarOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (searchQuery.trim() || searchField) {
          clearSearchQuery();
        } else {
          setSearchOpenLocal(false);
          setSearchBarOpen(false);
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpenLocal(true);
        setSearchBarOpen(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [searchActive, searchQuery, searchField, clearSearchQuery, setSearchBarOpen]);

  useEffect(() => {
    if (!searchActive) return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchActive, searchField]);

  const onLeads = pathname === "/leads" || pathname.startsWith("/leads/");
  const filtersActive = onLeads
    ? leadFilterValue !== "all" || Object.values(leadFacets).some(Boolean)
    : hasDashboardFilters(dashboardFilters);

  function openSearch() {
    useUiStore.getState().closeOverlays();
    setSearchOpenLocal(true);
    setSearchBarOpen(true);
    if (pathname !== "/leads") {
      router.push("/leads");
    }
  }

  function onSearchChange(value: string) {
    if (pathname !== "/leads") {
      router.push("/leads");
    }
    setSearchQuery(value);
  }

  async function onNotificationClick(item: AppNotification) {
    useUiStore.getState().closeOverlays();
    if (!item.read) {
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, read: true } : row,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      void markNotificationsRead({ ids: [item.id] }).catch(() => {
        /* best-effort */
      });
    }
    router.push(item.href || "/leads");
  }

  async function markAllRead() {
    if (unreadCount === 0 || markingAll) return;
    startMarkAll();
    setItems((prev) => prev.map((row) => ({ ...row, read: true })));
    setUnreadCount(0);
    try {
      await markNotificationsRead({ all: true });
      await succeedMarkAll("Done");
    } catch {
      failMarkAll();
      void loadNotifications();
    }
  }

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex h-14 w-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5 lg:px-6">
        <h1 className="min-w-0 truncate text-[18px] font-medium tracking-[-0.03em] text-[#212529] sm:text-[20px] lg:text-[22px]">
          {current.label}
        </h1>

        <div className="relative flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
          <BackendStatusIndicator />

          {showLeadTools ? (
            <>
          <button
            type="button"
            aria-label="Open filters"
            aria-expanded={filterSidebarOpen}
            aria-controls={
              onLeads ? "lead-filter-sidebar" : "dashboard-filter-sidebar"
            }
            onClick={() => toggleFilterSidebar()}
            className={[
              "lf-pressable inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium transition-colors duration-150 sm:px-2.5",
              filterSidebarOpen || filtersActive
                ? "bg-[#f1f3f5] text-[#212529]"
                : "text-[#6c757d] hover:bg-[#f8f9fa] hover:text-[#212529]",
            ].join(" ")}
          >
            <Filter size={15} strokeWidth={1.5} />
            <span className="hidden sm:inline">Filter</span>
            {filtersActive ? (
              <span className="h-1.5 w-1.5 rounded-full bg-[#212529]" />
            ) : null}
          </button>

          <div
            ref={searchWrapRef}
            className={[
              "flex items-center transition-[background-color,box-shadow] duration-150 ease-out",
              searchActive
                ? "w-[min(420px,calc(100vw-7.5rem))] rounded-xl bg-[#f1f3f5] shadow-[inset_0_0_0_1px_rgba(33,37,41,0.06)] sm:w-[min(420px,46vw)]"
                : "w-9",
            ].join(" ")}
          >
            {searchActive ? (
              <div className="flex h-9 w-full items-center gap-1.5 px-2.5">
                <Search
                  size={15}
                  strokeWidth={1.5}
                  className="shrink-0 text-[#adb5bd]"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={
                    searchScopeLabel
                      ? `Search in ${searchScopeLabel}…`
                      : "Search all columns…"
                  }
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-[#212529] outline-none placeholder:text-[#adb5bd]"
                  aria-label="Search leads"
                />
                {searchScopeLabel ? (
                  <button
                    type="button"
                    onClick={() => setSearchField(null)}
                    className="lf-pressable shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.03em] text-[#9a3f00] uppercase hover:bg-[#fff7ef]"
                    title="Clear column focus"
                  >
                    {searchScopeLabel}
                  </button>
                ) : null}
                {isQueryPending && searchQuery.trim() ? (
                  <span className="shrink-0 text-[10px] tracking-[0.04em] text-[#adb5bd] uppercase">
                    …
                  </span>
                ) : null}
                {searchQuery ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => clearSearchQuery()}
                    className="lf-pressable flex h-6 w-6 items-center justify-center rounded-md text-[#adb5bd] hover:bg-white hover:text-[#495057]"
                  >
                    <X size={13} strokeWidth={1.5} />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Close search"
                    onClick={() => {
                      setSearchOpenLocal(false);
                      setSearchBarOpen(false);
                    }}
                    className="lf-pressable flex h-6 w-6 items-center justify-center rounded-md text-[#adb5bd] hover:bg-white hover:text-[#495057]"
                  >
                    <X size={13} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                aria-label="Search leads"
                onClick={openSearch}
                className="lf-pressable flex h-9 w-9 items-center justify-center rounded-lg text-[#6c757d] hover:bg-[#f8f9fa] hover:text-[#212529]"
              >
                <Search size={17} strokeWidth={1.5} />
              </button>
            )}
          </div>
            </>
          ) : null}

          <button
            ref={buttonRef}
            type="button"
            onClick={toggleNotifications}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            className={[
              "lf-pressable relative flex h-9 w-9 items-center justify-center rounded-lg text-[#6c757d] hover:bg-[#f8f9fa] hover:text-[#212529]",
              notificationsOpen ? "bg-[#f8f9fa] text-[#212529]" : "",
            ].join(" ")}
          >
            <Bell size={17} strokeWidth={1.5} />
            {unreadCount > 0 ? (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#212529] px-1 text-[9px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>

          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            aria-hidden={!notificationsOpen}
            className={[
              "absolute top-[calc(100%+8px)] right-0 w-[min(340px,calc(100vw-1.25rem))] overflow-hidden rounded-xl border border-[rgba(33,37,41,0.08)] bg-white shadow-[0_12px_32px_rgba(33,37,41,0.08)] transition-[opacity,transform,visibility] duration-150 ease-out",
              notificationsOpen
                ? "visible translate-y-0 opacity-100"
                : "invisible -translate-y-1 opacity-0",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(33,37,41,0.06)] px-4 py-3">
              <p className="text-sm font-medium text-[#212529]">Notifications</p>
              {unreadCount > 0 || markAllPhase !== "idle" ? (
                <ActionButton
                  type="button"
                  phase={markAllPhase}
                  onClick={() => void markAllRead()}
                  idleLabel="Mark all read"
                  pendingLabel="Updating…"
                  successLabel="Done"
                  tone="ghost"
                  className="h-auto rounded-md px-1.5 py-0.5 text-[11px]"
                />
              ) : null}
            </div>

            <div className="lf-scroll max-h-[min(420px,70vh)] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-[12px] text-[#adb5bd]">
                  <LoaderCircle size={14} className="animate-spin" />
                  Loading
                </div>
              ) : loadError && items.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-[#c92a2a]">
                  {loadError}
                </p>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-[12px] text-[#adb5bd]">
                  No notifications yet
                </p>
              ) : (
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => void onNotificationClick(item)}
                        className={[
                          "lf-pressable flex w-full items-start gap-3 border-b border-[rgba(33,37,41,0.04)] px-4 py-3 text-left last:border-b-0 transition-colors duration-150 hover:bg-[#f8f9fa]",
                          item.read ? "bg-white" : "bg-[#fffdf8]",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                            item.read ? "bg-transparent" : "bg-[#e86812]",
                          ].join(" ")}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className="truncate text-[13px] font-medium text-[#212529]">
                              {item.title}
                            </span>
                            <span className="shrink-0 text-[11px] text-[#868e96]">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </span>
                          {item.body ? (
                            <span className="mt-0.5 line-clamp-2 text-xs text-[#6c757d]">
                              {item.body}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
