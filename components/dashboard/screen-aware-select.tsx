"use client";

import { Check, ChevronDown } from "lucide-react";
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
  computeDropdownPos,
  dropdownShellClass,
  flyoutEnterClass,
  type FlyoutPos,
} from "@/lib/flyout-position";

export type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  id?: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  onChange: (value: string) => void;
  className?: string;
};

export function ScreenAwareSelect({
  id,
  value,
  options,
  placeholder = "Select…",
  disabled = false,
  required = false,
  searchable = false,
  onChange,
  className = "",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openGenRef = useRef(0);
  const rafRef = useRef(0);
  const aliveRef = useRef(true);

  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<FlyoutPos | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    aliveRef.current = true;
    setMounted(true);
    return () => {
      aliveRef.current = false;
      window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const selected = useMemo(
    () => options.find((item) => item.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const updatePos = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || !aliveRef.current) return;
    const next = computeDropdownPos(trigger, {
      preferredHeight: searchable ? 300 : 260,
      panelEl: menuRef.current,
    });
    setPos((prev) => {
      if (
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.maxHeight === next.maxHeight &&
        prev.placement === next.placement
      ) {
        return prev;
      }
      return next;
    });
  }, [searchable]);

  const schedulePos = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(updatePos);
  }, [updatePos]);

  const close = useCallback(() => {
    const gen = openGenRef.current;
    setEntered(false);
    window.setTimeout(() => {
      if (!aliveRef.current || openGenRef.current !== gen) return;
      setOpen(false);
      setPos(null);
      setQuery("");
    }, 140);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    openGenRef.current += 1;
    setOpen(true);
    setEntered(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const id = window.requestAnimationFrame(() => {
      if (!aliveRef.current) return;
      updatePos();
      setEntered(true);
      const selectedEl = menuRef.current?.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      );
      selectedEl?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, filtered.length, updatePos]);

  useEffect(() => {
    if (!open) return;
    const gen = openGenRef.current;
    const onReposition = () => {
      if (openGenRef.current !== gen) return;
      schedulePos();
    };
    const onPointer = (event: MouseEvent) => {
      if (openGenRef.current !== gen) return;
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (openGenRef.current !== gen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const ro =
      typeof ResizeObserver !== "undefined" && menuRef.current
        ? new ResizeObserver(onReposition)
        : null;
    if (menuRef.current && ro) ro.observe(menuRef.current);

    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, schedulePos]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-required={required || undefined}
        onClick={() => {
          if (disabled) return;
          if (open) close();
          else openMenu();
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
          className={`min-w-0 truncate ${
            selected ? "text-[#212529]" : "text-[#adb5bd]"
          }`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          strokeWidth={1.75}
          className={`shrink-0 text-[#adb5bd] transition-transform duration-150 ${
            open ? "rotate-180 text-[#e86812]" : ""
          }`}
        />
      </button>

      {mounted && open && pos
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              data-flyout-panel="select"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
                zIndex: 140,
              }}
              className={[
                "flex flex-col overflow-hidden transition-[opacity,transform] duration-150 ease-out",
                dropdownShellClass(),
                flyoutEnterClass(pos, entered),
              ].join(" ")}
            >
              {searchable ? (
                <div className="shrink-0 border-b border-[rgba(33,37,41,0.05)] p-2">
                  <input
                    autoFocus
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="h-9 w-full rounded-lg border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] px-2.5 text-[13px] text-[#212529] outline-none placeholder:text-[#adb5bd] focus:border-[rgba(232,104,18,0.35)] focus:bg-white"
                  />
                </div>
              ) : null}

              <div className="lf-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
                {!required ? (
                  <button
                    type="button"
                    role="option"
                    aria-selected={!value}
                    onClick={() => {
                      onChange("");
                      close();
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] text-[#868e96] hover:bg-[#f8f9fa]"
                  >
                    <span>{placeholder}</span>
                  </button>
                ) : null}

                {filtered.length === 0 ? (
                  <p className="px-3 py-3 text-[12px] text-[#868e96]">
                    No matches
                  </p>
                ) : (
                  filtered.map((option) => {
                    const active = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange(option.value);
                          close();
                        }}
                        className={[
                          "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] transition-colors",
                          active
                            ? "bg-[#fff7ef] font-medium text-[#9a3f00]"
                            : "text-[#212529] hover:bg-[#f8f9fa]",
                        ].join(" ")}
                      >
                        <span className="min-w-0 truncate">{option.label}</span>
                        {active ? (
                          <Check
                            size={14}
                            strokeWidth={2}
                            className="shrink-0 text-[#e86812]"
                          />
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
