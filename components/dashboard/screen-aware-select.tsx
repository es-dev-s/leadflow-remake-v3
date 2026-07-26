"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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

type MenuPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
};

const GAP = 6;
const VIEW_PAD = 8;

function computeMenuPos(trigger: HTMLElement): MenuPos {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceBelow = Math.max(0, vh - rect.bottom - VIEW_PAD - GAP);
  const spaceAbove = Math.max(0, rect.top - VIEW_PAD - GAP);
  const preferred = 280;
  const placeBottom = spaceBelow >= 140 || spaceBelow >= spaceAbove;
  const available = placeBottom ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(120, Math.min(preferred, available));
  const width = Math.min(rect.width, vw - VIEW_PAD * 2);
  let left = rect.left;
  if (left + width > vw - VIEW_PAD) left = vw - VIEW_PAD - width;
  if (left < VIEW_PAD) left = VIEW_PAD;

  if (placeBottom) {
    return {
      top: Math.min(rect.bottom + GAP, vh - VIEW_PAD - 80),
      left,
      width,
      maxHeight,
      placement: "bottom",
    };
  }

  const top = Math.max(VIEW_PAD, rect.top - GAP - maxHeight);
  return {
    top,
    left,
    width,
    maxHeight: Math.min(maxHeight, rect.top - GAP - top),
    placement: "top",
  };
}

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  const updatePos = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPos(computeMenuPos(trigger));
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const onReposition = () => updatePos();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
          if (!disabled) setOpen((v) => !v);
        }}
        className={[
          "lf-pressable flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-[13px] outline-none transition-[border-color,box-shadow,background-color]",
          disabled
            ? "cursor-not-allowed border-[rgba(33,37,41,0.06)] bg-[#f8f9fa] text-[#adb5bd]"
            : open
              ? "border-[rgba(232,104,18,0.5)] bg-white shadow-[0_0_0_3px_rgba(232,104,18,0.1)]"
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
          className={`shrink-0 text-[#adb5bd] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {mounted && open && pos
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
                zIndex: 120,
              }}
              className="flex flex-col overflow-hidden rounded-xl border border-[rgba(33,37,41,0.1)] bg-white shadow-[0_16px_48px_rgba(15,17,20,0.16)]"
            >
              {searchable ? (
                <div className="shrink-0 border-b border-[rgba(33,37,41,0.06)] p-2">
                  <input
                    autoFocus
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="h-9 w-full rounded-lg border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] px-2.5 text-[13px] text-[#212529] outline-none placeholder:text-[#adb5bd] focus:border-[rgba(232,104,18,0.4)] focus:bg-white"
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
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-[#868e96] hover:bg-[#f8f9fa]"
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
                          setOpen(false);
                        }}
                        className={[
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors",
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
