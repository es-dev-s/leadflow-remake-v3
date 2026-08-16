"use client";

export const DASHBOARD_PREVIEW_LIMIT = 10;

/** Collapsed cards stay a fixed height. Expanded cards scroll inside that same frame. */
export function dashboardCardListClass(expanded: boolean) {
  return expanded
    ? "lf-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain"
    : "min-h-0 flex-1 overflow-x-auto overflow-y-hidden";
}

type Props = {
  total: number;
  preview?: number;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  loading?: boolean;
  noun: string;
};

export function ViewMoreFooter({
  total,
  preview = DASHBOARD_PREVIEW_LIMIT,
  expanded,
  onExpand,
  onCollapse,
  loading = false,
  noun,
}: Props) {
  if (total <= preview) return null;
  const hidden = total - preview;
  return (
    <div className="flex shrink-0 justify-center border-t border-[rgba(33,37,41,0.05)] px-3 py-2.5">
      <button
        type="button"
        onClick={expanded ? onCollapse : onExpand}
        disabled={loading}
        className="lf-pressable rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#495057] hover:bg-[#f8f9fa] hover:text-[#212529] disabled:opacity-60"
      >
        {loading
          ? "Loading…"
          : expanded
            ? "Show less"
            : `View more · ${hidden.toLocaleString("en-US")} ${noun}`}
      </button>
    </div>
  );
}
