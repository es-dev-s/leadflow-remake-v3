"use client";

import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  computeFlyoutPos,
  findFlyoutLayer,
  flyoutEnterClass,
  flyoutShellClass,
  type FlyoutPos,
} from "@/lib/flyout-position";

type PickerMode = "date" | "datetime";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** `date` → YYYY-MM-DD (lead Date). `datetime` → YYYY-MM-DDTHH:mm. */
  mode?: PickerMode;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function pickerMetrics(vw: number, vh: number, mode: PickerMode) {
  const preferredWidth =
    mode === "date"
      ? vw >= 1100
        ? 360
        : 320
      : vw >= 1400
        ? 480
        : vw >= 1100
          ? 430
          : vw >= 860
            ? 380
            : 320;
  const maxWidth =
    mode === "date" ? 380 : vw >= 1400 ? 520 : vw >= 1100 ? 460 : 400;
  const itemH = vw >= 1100 ? 44 : 40;
  const wheelVisible = vh >= 900 ? 7 : vh >= 740 ? 6 : 5;
  const wheelBlock = 28 + itemH * wheelVisible;
  const preferredHeight =
    mode === "date"
      ? 72 + 48 + 300 + 64
      : preferredWidth >= 380
        ? 72 + 48 + Math.max(280, wheelBlock) + 64
        : 72 + 48 + 280 + 16 + wheelBlock + 64;
  return { preferredWidth, maxWidth, preferredHeight, itemH, wheelVisible };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseValue(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const dt = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(trimmed);
  if (dt) {
    const d = new Date(
      Number(dt[1]),
      Number(dt[2]) - 1,
      Number(dt[3]),
      Number(dt[4]),
      Number(dt[5]),
      0,
      0,
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (day) {
    const d = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toDateTimeValue(date: Date) {
  return `${toDateValue(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDisplay(raw: string, mode: PickerMode) {
  const d = parseValue(raw);
  if (!d) return null;
  if (mode === "date") {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDraftParts(date: Date, hour: number, minute: number) {
  const day = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    minute,
  );
  return {
    dateLabel: day.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    timeLabel: `${pad2(hour)}:${pad2(minute)}`,
  };
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; inMonth: boolean; date: Date }> = [];
  const prevDays = new Date(year, month, 0).getDate();

  for (let i = startPad - 1; i >= 0; i -= 1) {
    const day = prevDays - i;
    cells.push({ day, inMonth: false, date: new Date(year, month - 1, day) });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, inMonth: true, date: new Date(year, month, day) });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: nextDay,
      inMonth: false,
      date: new Date(year, month + 1, nextDay),
    });
    nextDay += 1;
  }
  return cells;
}

/** Vertical iOS-style wheel — selection band sits behind the numbers. */
function TimeWheel({
  label,
  items,
  value,
  onChange,
  layoutKey,
  itemH,
  visible,
}: {
  label: string;
  items: number[];
  value: number;
  onChange: (value: number) => void;
  layoutKey: string;
  itemH: number;
  visible: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(false);
  const settleTimerRef = useRef(0);
  const scrollRafRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const wheelH = itemH * visible;
  const padY = (wheelH - itemH) / 2;

  const scrollToValue = useCallback(
    (next: number, behavior: ScrollBehavior) => {
      const el = scrollerRef.current;
      if (!el) return;
      const idx = items.indexOf(next);
      if (idx < 0) return;
      const target = idx * itemH;
      suppressRef.current = true;
      el.scrollTo({ top: Math.max(0, target), behavior });
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = window.setTimeout(
        () => {
          suppressRef.current = false;
        },
        behavior === "smooth" ? 260 : 40,
      );
    },
    [items, itemH],
  );

  useLayoutEffect(() => {
    scrollToValue(valueRef.current, "auto");
  }, [layoutKey, scrollToValue]);

  useEffect(() => {
    return () => {
      window.clearTimeout(settleTimerRef.current);
      window.cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-center text-[10px] font-medium tracking-[0.14em] text-[#adb5bd] uppercase">
        {label}
      </p>
      <div
        className="relative overflow-hidden rounded-xl bg-[#f4f5f6]"
        style={{ height: wheelH }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-1/2 z-0 -translate-y-1/2 rounded-lg bg-white shadow-[0_1px_3px_rgba(15,17,20,0.06)] ring-1 ring-[rgba(33,37,41,0.07)]"
          style={{ height: itemH }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-[linear-gradient(to_bottom,#f4f5f6_18%,rgba(244,245,246,0))]"
          style={{ height: padY + 8 }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-[linear-gradient(to_top,#f4f5f6_18%,rgba(244,245,246,0))]"
          style={{ height: padY + 8 }}
        />

        <div
          ref={scrollerRef}
          className="relative z-10 h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingTop: padY, paddingBottom: padY }}
          onScroll={() => {
            if (suppressRef.current) return;
            window.cancelAnimationFrame(scrollRafRef.current);
            scrollRafRef.current = window.requestAnimationFrame(() => {
              if (suppressRef.current || !scrollerRef.current) return;
              const el = scrollerRef.current;
              const idx = Math.round(el.scrollTop / itemH);
              const next = items[Math.max(0, Math.min(items.length - 1, idx))];
              if (next !== valueRef.current) onChange(next);
            });
          }}
        >
          {items.map((item) => {
            const active = item === value;
            return (
              <button
                key={item}
                type="button"
                tabIndex={-1}
                onClick={() => {
                  onChange(item);
                  scrollToValue(item, "smooth");
                }}
                style={{ height: itemH }}
                className={[
                  "flex w-full shrink-0 snap-center items-center justify-center tabular-nums transition-colors duration-100",
                  itemH >= 44 ? "text-[18px]" : "text-[16px]",
                  active
                    ? "font-semibold text-[#212529]"
                    : "font-medium text-[#868e96]",
                ].join(" ")}
              >
                {pad2(item)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ScreenAwareDateTimePicker({
  id,
  value,
  onChange,
  disabled = false,
  placeholder,
  className = "",
  mode = "datetime",
}: Props) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openGenRef = useRef(0);
  const rafRef = useRef(0);
  const aliveRef = useRef(true);
  const freezePosRef = useRef(false);

  const resolvedPlaceholder =
    placeholder ?? (mode === "date" ? "Select date" : "Select date & time");

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [pos, setPos] = useState<FlyoutPos | null>(null);
  const [openToken, setOpenToken] = useState(0);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [metrics, setMetrics] = useState(() =>
    typeof window === "undefined"
      ? {
          preferredWidth: 360,
          maxWidth: 400,
          preferredHeight: 480,
          itemH: 42,
          wheelVisible: 6,
        }
      : pickerMetrics(window.innerWidth, window.innerHeight, mode),
  );
  const [viewCursor, setViewCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [draftDate, setDraftDate] = useState<Date>(() => startOfDay(new Date()));
  const [draftHour, setDraftHour] = useState(() => new Date().getHours());
  const [draftMinute, setDraftMinute] = useState(() => new Date().getMinutes());

  useEffect(() => {
    aliveRef.current = true;
    setMounted(true);
    const onResize = () => {
      freezePosRef.current = false;
      setMetrics(pickerMetrics(window.innerWidth, window.innerHeight, mode));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      aliveRef.current = false;
      window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [mode]);

  const display = useMemo(() => formatDisplay(value, mode), [value, mode]);
  const today = useMemo(() => startOfDay(new Date()), []);
  const cells = useMemo(
    () => buildMonthCells(viewCursor.year, viewCursor.month),
    [viewCursor.year, viewCursor.month],
  );
  const draftParts = useMemo(
    () => formatDraftParts(draftDate, draftHour, draftMinute),
    [draftDate, draftHour, draftMinute],
  );

  const draftValue = useMemo(() => {
    if (mode === "date") return toDateValue(draftDate);
    return toDateTimeValue(
      new Date(
        draftDate.getFullYear(),
        draftDate.getMonth(),
        draftDate.getDate(),
        draftHour,
        draftMinute,
        0,
        0,
      ),
    );
  }, [draftDate, draftHour, draftMinute, mode]);

  const syncDraftFromValue = useCallback((raw: string) => {
    const parsed = parseValue(raw) ?? new Date();
    setDraftDate(startOfDay(parsed));
    setDraftHour(parsed.getHours());
    setDraftMinute(parsed.getMinutes());
    setViewCursor({
      year: parsed.getFullYear(),
      month: parsed.getMonth(),
    });
  }, []);

  const updatePos = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || !aliveRef.current) return;
    const next = computeFlyoutPos(trigger, {
      preferredWidth: metrics.preferredWidth,
      preferredHeight: metrics.preferredHeight,
      minWidth: mode === "date" ? 300 : 300,
      maxWidth: metrics.maxWidth,
      verticalAlign: "center",
      panelEl: panelRef.current,
    });
    setPos((prev) => {
      if (
        prev &&
        freezePosRef.current &&
        prev.placement === next.placement &&
        prev.docked === next.docked &&
        Math.abs(prev.left - next.left) < 2 &&
        Math.abs(prev.width - next.width) < 2
      ) {
        // Keep top locked after open so centering/measure does not flicker.
        return prev.maxHeight === next.maxHeight
          ? prev
          : { ...prev, maxHeight: next.maxHeight };
      }
      if (
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.maxHeight === next.maxHeight &&
        prev.placement === next.placement &&
        prev.docked === next.docked
      ) {
        return prev;
      }
      return next;
    });
  }, [metrics, mode]);

  const schedulePos = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(updatePos);
  }, [updatePos]);

  const close = useCallback(() => {
    const gen = openGenRef.current;
    freezePosRef.current = false;
    setEntered(false);
    window.setTimeout(() => {
      if (!aliveRef.current || openGenRef.current !== gen) return;
      setOpen(false);
      setPos(null);
    }, 200);
  }, []);

  const openPicker = useCallback(() => {
    if (disabled) return;
    openGenRef.current += 1;
    freezePosRef.current = false;
    syncDraftFromValue(value);
    setPortalEl(findFlyoutLayer(triggerRef.current) ?? document.body);
    setOpenToken(openGenRef.current);
    setOpen(true);
    setEntered(false);
  }, [disabled, syncDraftFromValue, value]);

  const shiftMonth = useCallback((delta: number) => {
    setViewCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    freezePosRef.current = false;
    updatePos();
    let enterId = 0;
    const measureId = window.requestAnimationFrame(() => {
      if (!aliveRef.current) return;
      updatePos();
      // Second frame: position is stable, then slide in from the form.
      enterId = window.requestAnimationFrame(() => {
        if (!aliveRef.current) return;
        freezePosRef.current = true;
        setEntered(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(measureId);
      window.cancelAnimationFrame(enterId);
    };
  }, [open, openToken, updatePos]);

  useEffect(() => {
    if (!open) return;
    const gen = openGenRef.current;
    const onWindowResize = () => {
      if (openGenRef.current !== gen) return;
      freezePosRef.current = false;
      schedulePos();
      window.requestAnimationFrame(() => {
        if (openGenRef.current !== gen) return;
        freezePosRef.current = true;
      });
    };
    const onPointer = (event: MouseEvent) => {
      if (openGenRef.current !== gen) return;
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (openGenRef.current !== gen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    // Centered docked panels stay put while the form scrolls — only reflow on viewport resize.
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, schedulePos]);

  const layoutKey = `${openToken}:${pos?.width ?? 0}:${pos?.placement ?? ""}:${metrics.itemH}:${metrics.wheelVisible}`;
  const wideLayout = (pos?.width ?? 0) >= 390;
  const emergeBehindDrawer = Boolean(
    portalEl && portalEl !== document.body && (pos?.docked || pos?.placement === "left"),
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open) close();
          else openPicker();
        }}
        className={[
          "lf-pressable flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-[13px] outline-none transition-[border-color,box-shadow,background-color]",
          disabled
            ? "cursor-not-allowed border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] text-[#adb5bd]"
            : open
              ? "border-[rgba(232,104,18,0.45)] bg-white shadow-[0_0_0_3px_rgba(232,104,18,0.1)]"
              : "border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] hover:border-[rgba(33,37,41,0.16)]",
        ].join(" ")}
      >
        <span
          className={`min-w-0 truncate ${display ? "text-[#212529]" : "text-[#adb5bd]"}`}
        >
          {display ?? resolvedPlaceholder}
        </span>
        <CalendarDays
          size={15}
          strokeWidth={1.75}
          className={open ? "shrink-0 text-[#e86812]" : "shrink-0 text-[#adb5bd]"}
        />
      </button>

      {mounted && open && pos && portalEl
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={mode === "date" ? "Choose date" : "Choose date and time"}
              data-flyout-panel={mode === "date" ? "date" : "datetime"}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
                height: "fit-content",
                zIndex: emergeBehindDrawer ? 1 : 140,
                pointerEvents: "auto",
              }}
              className={[
                "relative flex flex-col overflow-hidden transition-transform duration-280 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                flyoutShellClass(pos),
                flyoutEnterClass(pos, entered, emergeBehindDrawer),
              ].join(" ")}
            >
              {/* Seam cue when docked to the form drawer */}
              {pos.docked ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 z-30 w-px bg-[rgba(33,37,41,0.06)]"
                />
              ) : null}

              <div className="shrink-0 px-4 pt-3.5 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => shiftMonth(-1)}
                    className="lf-pressable flex h-8 w-8 items-center justify-center rounded-lg text-[#6c757d] transition-colors hover:bg-[#f1f3f5] hover:text-[#212529]"
                  >
                    <ChevronLeft size={16} strokeWidth={1.75} />
                  </button>
                  <p className="text-[13px] font-semibold tracking-[-0.02em] text-[#212529]">
                    {monthLabel(viewCursor.year, viewCursor.month)}
                  </p>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => shiftMonth(1)}
                    className="lf-pressable flex h-8 w-8 items-center justify-center rounded-lg text-[#6c757d] transition-colors hover:bg-[#f1f3f5] hover:text-[#212529]"
                  >
                    <ChevronRight size={16} strokeWidth={1.75} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#f8f9fa] px-3.5 py-2.5">
                  <span className="min-w-0 truncate text-[12px] font-medium text-[#495057]">
                    {draftParts.dateLabel}
                  </span>
                  {mode === "datetime" ? (
                    <span className="shrink-0 text-[20px] font-semibold tracking-[-0.04em] tabular-nums text-[#212529]">
                      {draftParts.timeLabel}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="lf-flyout-scroll min-h-0 flex-[1_1_auto] overflow-y-auto overscroll-contain px-4 pb-3">
                <div
                  className={
                    mode === "datetime" && wideLayout
                      ? "grid grid-cols-[minmax(0,1.15fr)_minmax(140px,0.85fr)] gap-4"
                      : "space-y-4"
                  }
                >
                  <div className="min-w-0">
                    <div className="grid grid-cols-7 gap-y-1">
                      {WEEKDAYS.map((day) => (
                        <div
                          key={day}
                          className="flex h-8 items-center justify-center text-[10px] font-medium tracking-[0.04em] text-[#adb5bd]"
                        >
                          {day}
                        </div>
                      ))}
                      {cells.map((cell) => {
                        const selected = sameDay(cell.date, draftDate);
                        const isToday = sameDay(cell.date, today);
                        const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}-${cell.inMonth ? "m" : "o"}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setDraftDate(startOfDay(cell.date));
                              if (!cell.inMonth) {
                                setViewCursor({
                                  year: cell.date.getFullYear(),
                                  month: cell.date.getMonth(),
                                });
                              }
                            }}
                            className={[
                              "lf-pressable mx-auto flex items-center justify-center rounded-full text-[13px] tabular-nums transition-colors",
                              mode === "datetime" && wideLayout
                                ? "h-10 w-10"
                                : "h-9 w-9",
                              selected
                                ? "bg-[#212529] font-semibold text-white"
                                : cell.inMonth
                                  ? "font-medium text-[#343a40] hover:bg-[#f1f3f5]"
                                  : "font-medium text-[#ced4da] hover:bg-[#f8f9fa]",
                              !selected && isToday
                                ? "ring-1 ring-[rgba(232,104,18,0.5)]"
                                : "",
                            ].join(" ")}
                          >
                            {cell.day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {mode === "datetime" ? (
                    <div
                      className={[
                        "min-w-0",
                        wideLayout
                          ? "border-l border-[rgba(33,37,41,0.05)] pl-4"
                          : "border-t border-[rgba(33,37,41,0.05)] pt-4",
                      ].join(" ")}
                    >
                      <div className="flex items-stretch gap-2.5">
                        <TimeWheel
                          label="Hour"
                          items={HOURS}
                          value={draftHour}
                          onChange={setDraftHour}
                          layoutKey={`${layoutKey}:h`}
                          itemH={metrics.itemH}
                          visible={metrics.wheelVisible}
                        />
                        <div className="flex shrink-0 items-center pt-6">
                          <span
                            aria-hidden
                            className="text-[22px] font-semibold text-[#ced4da]"
                          >
                            :
                          </span>
                        </div>
                        <TimeWheel
                          label="Minute"
                          items={MINUTES}
                          value={draftMinute}
                          onChange={setDraftMinute}
                          layoutKey={`${layoutKey}:m`}
                          itemH={metrics.itemH}
                          visible={metrics.wheelVisible}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 border-t border-[rgba(33,37,41,0.05)] px-3 py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      close();
                    }}
                    className="lf-pressable inline-flex h-10 flex-1 items-center justify-center gap-1 rounded-xl text-[13px] font-medium text-[#868e96] transition-colors hover:bg-[#f8f9fa] hover:text-[#495057]"
                  >
                    <X size={14} strokeWidth={1.75} />
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(draftValue);
                      close();
                    }}
                    className="lf-pressable inline-flex h-10 flex-[1.35] items-center justify-center gap-1.5 rounded-xl bg-[#212529] text-[13px] font-medium text-white transition-colors hover:bg-[#343a40]"
                  >
                    <Check size={14} strokeWidth={2} />
                    Done
                  </button>
                </div>
              </div>
            </div>,
            portalEl,
          )
        : null}
    </div>
  );
}
