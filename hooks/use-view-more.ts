"use client";

import { useMemo, useState } from "react";
import { DASHBOARD_PREVIEW_LIMIT } from "@/components/dashboard/view-more-footer";

export function useViewMore<T>(items: T[], limit = DASHBOARD_PREVIEW_LIMIT) {
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(
    () => (expanded ? items : items.slice(0, limit)),
    [expanded, items, limit],
  );
  return {
    visible,
    expanded,
    expand: () => setExpanded(true),
    collapse: () => setExpanded(false),
    total: items.length,
    canExpand: items.length > limit,
  };
}
