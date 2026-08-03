/**
 * Platform display timezone — Nepal (Kathmandu, UTC+5:45).
 * All wall-clock formatting for LeadFlow should go through these helpers.
 */
export const DISPLAY_TIME_ZONE = "Asia/Kathmandu" as const;

function asDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw || raw === "—") return null;

  // Date-only calendar day (no timezone shift to previous/next day).
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // Naive "YYYY-MM-DDTHH:mm" — treat as Kathmandu wall clock.
  const naive = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (naive && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const [, ys, ms, ds, hs, mins, ss] = naive;
    const asUtcGuess = Date.UTC(
      Number(ys),
      Number(ms) - 1,
      Number(ds),
      Number(hs),
      Number(mins),
      Number(ss || 0),
    );
    // Convert "wall clock in Kathmandu" → instant: format via Intl parts offset.
    // Kathmandu is fixed UTC+5:45 (no DST).
    const ktmOffsetMs = (5 * 60 + 45) * 60 * 1000;
    const dt = new Date(asUtcGuess - ktmOffsetMs);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const dateOpts: Intl.DateTimeFormatOptions = {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
};

const dateTimeOpts: Intl.DateTimeFormatOptions = {
  ...dateOpts,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const dateTimeShortOpts: Intl.DateTimeFormatOptions = {
  timeZone: DISPLAY_TIME_ZONE,
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

/** Calendar date only (e.g. lead Added date). */
export function formatDate(
  value: string | number | Date | null | undefined,
): string {
  const dt = asDate(value);
  if (!dt) return "—";
  // Pure YYYY-MM-DD: format that calendar day in Kathmandu without TZ skew.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(dt);
  }
  return new Intl.DateTimeFormat("en-US", dateOpts).format(dt);
}

/** Full datetime in Kathmandu (qualification history, notifications, etc.). */
export function formatDateTime(
  value: string | number | Date | null | undefined,
): string | null {
  const dt = asDate(value);
  if (!dt) return null;
  return new Intl.DateTimeFormat("en-US", dateTimeOpts).format(dt);
}

/** Compact datetime for dense tables. */
export function formatDateTimeShort(
  value: string | number | Date | null | undefined,
): string {
  const dt = asDate(value);
  if (!dt) return "—";
  // Legacy preformatted server strings like "8/3/2026, 12:00 AM" — if it's
  // clearly a date-only midnight display, show date only.
  if (
    typeof value === "string" &&
    /,\s*12:00\s*AM$/i.test(value.trim()) &&
    !value.includes("T")
  ) {
    return formatDate(value.split(",")[0]?.trim() || value);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return formatDate(value);
  }
  return new Intl.DateTimeFormat("en-US", dateTimeShortOpts).format(dt);
}

/** Compact duration from whole minutes (e.g. 45m, 2h 15m, 4d 2h). */
export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 1) return "<1m";
  if (whole < 60) return `${whole}m`;
  const d = Math.floor(whole / (60 * 24));
  const h = Math.floor((whole % (60 * 24)) / 60);
  const m = whole % 60;
  if (d > 0) {
    if (h <= 0) return `${d}d`;
    return `${d}d ${h}h`;
  }
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Prefer ISO raw instant when present; fall back to display string. */
export function formatLeadAddedAt(
  createdAt: string | null | undefined,
  createdAtRaw?: string | null,
): string {
  if (createdAtRaw?.trim()) {
    // Lead createdAt is a calendar date product field — show date only.
    return formatDate(createdAtRaw);
  }
  if (!createdAt?.trim() || createdAt === "—") return "—";
  // Strip bogus midnight from legacy "M/D/YYYY, 12:00 AM" list formatting.
  if (/,\s*12:00\s*AM$/i.test(createdAt.trim())) {
    return formatDate(createdAt.split(",")[0]?.trim() || createdAt);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(createdAt.trim())) {
    return formatDate(createdAt);
  }
  return formatDateTimeShort(createdAt);
}
