"use client";

import { ChevronDown, MapPin, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type FilterOption = {
  name: string;
  count: number;
};

type Props = {
  label: string;
  placeholder: string;
  value: string;
  options: FilterOption[];
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
};

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

export function GeoFilterSelect({
  label,
  placeholder,
  value,
  options,
  disabled = false,
  loading = false,
  onChange,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.name.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={rootRef} className="relative min-w-[168px] flex-1 sm:min-w-[200px] sm:flex-none">
      <label className="mb-1 block text-[11px] font-medium tracking-[0.04em] text-[#868e96] uppercase">
        {label}
      </label>
      <div
        className={`flex h-10 items-center gap-2 rounded-xl border bg-white px-3 transition-[border-color,box-shadow] ${
          disabled
            ? "border-[rgba(33,37,41,0.05)] opacity-55"
            : open
              ? "border-[rgba(33,37,41,0.18)] shadow-[0_0_0_3px_rgba(33,37,41,0.04)]"
              : "border-[rgba(33,37,41,0.08)] hover:border-[rgba(33,37,41,0.14)]"
        }`}
      >
        <MapPin size={14} className="shrink-0 text-[#adb5bd]" strokeWidth={1.75} />
        <input
          ref={inputRef}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={open ? query : value}
          placeholder={loading ? "Loading…" : placeholder}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
              setQuery("");
            }
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) setOpen(true);
          }}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[#212529] outline-none placeholder:text-[#adb5bd]"
        />
        {value ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            disabled={disabled}
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(false);
            }}
            className="rounded-md p-0.5 text-[#adb5bd] transition-colors hover:bg-[#f8f9fa] hover:text-[#495057]"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        ) : (
          <ChevronDown
            size={14}
            className={`shrink-0 text-[#adb5bd] transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={1.75}
          />
        )}
      </div>

      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          className="lf-scroll absolute top-[calc(100%+6px)] z-30 max-h-64 w-full overflow-y-auto rounded-xl border border-[rgba(33,37,41,0.08)] bg-white py-1 shadow-[0_12px_40px_rgba(33,37,41,0.12)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === ""}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors ${
              value === ""
                ? "bg-[#f8f9fa] text-[#212529]"
                : "text-[#6c757d] hover:bg-[#fafbfc]"
            }`}
          >
            <span>All</span>
          </button>
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-[#868e96]">No matches</p>
          ) : (
            filtered.map((item) => {
              const selected = item.name === value;
              return (
                <button
                  key={item.name}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(item.name);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                    selected
                      ? "bg-[#fff7ef] text-[#9a3f00]"
                      : "text-[#212529] hover:bg-[#fafbfc]"
                  }`}
                >
                  <span className="min-w-0 truncate text-[13px] font-medium">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-[#868e96]">
                    {formatCount(item.count)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
