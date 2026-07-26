"use client";

import { Fragment, type ReactNode } from "react";

const MARK_CLASS =
  "rounded-[2px] bg-[#ffe566] px-[1px] text-inherit [box-decoration-break:clone]";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Browser Ctrl+F–style text highlight (case-insensitive, all matches). */
export function HighlightText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}): ReactNode {
  const value = text ?? "";
  const q = query.trim();
  if (!q || !value || value === "—") {
    return className ? <span className={className}>{value}</span> : value;
  }

  const pattern = new RegExp(`(${escapeRegExp(q)})`, "gi");
  const parts = value.split(pattern);
  if (parts.length === 1) {
    return className ? <span className={className}>{value}</span> : value;
  }

  const lowerQ = q.toLowerCase();
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.toLowerCase() === lowerQ ? (
          <mark key={index} className={MARK_CLASS}>
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </span>
  );
}

/**
 * Highlight phone matches by digit sequence so "+91 8987-66" still lights up
 * when searching "898766", even if separators sit between digits.
 */
export function HighlightPhone({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}): ReactNode {
  const value = text ?? "";
  const q = query.trim();
  if (!q || !value || value === "—") {
    return className ? <span className={className}>{value}</span> : value;
  }

  const digitQuery = q.replace(/\D/g, "");
  if (digitQuery.length < 2) {
    return <HighlightText text={value} query={q} className={className} />;
  }

  const digitToSource: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    if (/\d/.test(value[i]!)) digitToSource.push(i);
  }
  const digits = digitToSource.map((i) => value[i]).join("");
  const startDigit = digits.indexOf(digitQuery);
  if (startDigit < 0) {
    return <HighlightText text={value} query={q} className={className} />;
  }

  const highlight = new Array<boolean>(value.length).fill(false);
  for (let d = 0; d < digitQuery.length; d += 1) {
    const src = digitToSource[startDigit + d];
    if (src != null) highlight[src] = true;
  }
  // Also paint separators that sit between highlighted digits for a contiguous look.
  for (let i = 0; i < value.length; i += 1) {
    if (highlight[i] || /\d/.test(value[i]!)) continue;
    let left = -1;
    let right = -1;
    for (let L = i - 1; L >= 0; L -= 1) {
      if (/\d/.test(value[L]!)) {
        left = L;
        break;
      }
    }
    for (let R = i + 1; R < value.length; R += 1) {
      if (/\d/.test(value[R]!)) {
        right = R;
        break;
      }
    }
    if (left >= 0 && right >= 0 && highlight[left] && highlight[right]) {
      highlight[i] = true;
    }
  }

  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < value.length) {
    const on = highlight[i] === true;
    let j = i + 1;
    while (j < value.length && highlight[j] === on) j += 1;
    const chunk = value.slice(i, j);
    nodes.push(
      on ? (
        <mark key={i} className={MARK_CLASS}>
          {chunk}
        </mark>
      ) : (
        <Fragment key={i}>{chunk}</Fragment>
      ),
    );
    i = j;
  }

  return <span className={className}>{nodes}</span>;
}
