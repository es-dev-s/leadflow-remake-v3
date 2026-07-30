/** Shared screen-aware flyout placement for form dropdowns / pickers. */

export type FlyoutPlacement = "left" | "right" | "bottom" | "top";

export type FlyoutPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: FlyoutPlacement;
  /** Flush against the host drawer so the panel reads as part of the form. */
  docked: boolean;
};

const VIEW_PAD = 12;
const FREE_GAP = 8;
const DOCK_OVERLAP = 1;

/** Walk ancestors to find a right-side drawer / dialog edge. */
export function findHostDrawerLeft(el: HTMLElement | null): number | null {
  let node: HTMLElement | null = el;
  while (node) {
    if (node.dataset.flyoutHost === "drawer") {
      const rect = node.getBoundingClientRect();
      if (rect.width >= 240) return rect.left;
    }
    const role = node.getAttribute("role");
    if (role === "dialog" || node.tagName === "ASIDE") {
      const rect = node.getBoundingClientRect();
      if (rect.right >= window.innerWidth - 24 && rect.width >= 280) {
        return rect.left;
      }
    }
    node = node.parentElement;
  }
  return null;
}

function clampTop(preferredTop: number, height: number, vh: number) {
  const maxTop = vh - VIEW_PAD - Math.min(height, vh - VIEW_PAD * 2);
  return Math.min(Math.max(VIEW_PAD, preferredTop), Math.max(VIEW_PAD, maxTop));
}

/**
 * Classic in-form dropdown: open below / above the field, same width as trigger.
 */
export function computeDropdownPos(
  trigger: HTMLElement,
  opts: {
    preferredHeight: number;
    panelEl?: HTMLElement | null;
  },
): FlyoutPos {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const measuredH = opts.panelEl?.offsetHeight || opts.preferredHeight;

  const width = Math.min(
    Math.max(rect.width, 160),
    vw - VIEW_PAD * 2,
  );
  let left = rect.left;
  if (left + width > vw - VIEW_PAD) left = vw - VIEW_PAD - width;
  if (left < VIEW_PAD) left = VIEW_PAD;

  const spaceBelow = Math.max(0, vh - rect.bottom - VIEW_PAD - FREE_GAP);
  const spaceAbove = Math.max(0, rect.top - VIEW_PAD - FREE_GAP);
  const placeBottom = spaceBelow >= 140 || spaceBelow >= spaceAbove;
  const available = placeBottom ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(140, Math.min(measuredH, available));

  if (placeBottom) {
    const top = rect.bottom + FREE_GAP;
    return {
      top,
      left,
      width,
      maxHeight: Math.min(maxHeight, vh - VIEW_PAD - top),
      placement: "bottom",
      docked: false,
    };
  }

  const top = Math.max(VIEW_PAD, rect.top - FREE_GAP - maxHeight);
  return {
    top,
    left,
    width,
    maxHeight: Math.min(maxHeight, rect.top - FREE_GAP - top),
    placement: "top",
    docked: false,
  };
}

/**
 * Prefer floating flush to the LEFT of a right sidebar so the form stays
 * readable and the panel feels joined to the drawer.
 */
export function computeFlyoutPos(
  trigger: HTMLElement,
  opts: {
    preferredWidth: number;
    preferredHeight: number;
    minWidth?: number;
    maxWidth?: number;
    /** Vertically center the panel in the viewport (datetime picker). */
    verticalAlign?: "center" | "trigger";
    panelEl?: HTMLElement | null;
  },
): FlyoutPos {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const measuredH = opts.panelEl?.offsetHeight || opts.preferredHeight;
  const minW = opts.minWidth ?? 300;
  const maxW = opts.maxWidth ?? opts.preferredWidth;
  const align = opts.verticalAlign ?? "trigger";
  const viewportCap = vh - VIEW_PAD * 2;

  const drawerLeft = findHostDrawerLeft(trigger);
  const spaceLeftOfDrawer =
    drawerLeft != null ? Math.max(0, drawerLeft - VIEW_PAD + DOCK_OVERLAP) : 0;
  const spaceLeftOfTrigger = Math.max(0, rect.left - VIEW_PAD - FREE_GAP);
  const spaceBelow = Math.max(0, vh - rect.bottom - VIEW_PAD - FREE_GAP);
  const spaceAbove = Math.max(0, rect.top - VIEW_PAD - FREE_GAP);

  const wantWidth = Math.min(maxW, Math.max(minW, opts.preferredWidth));
  const canDockToDrawer =
    drawerLeft != null && spaceLeftOfDrawer >= Math.min(wantWidth, 280);

  const resolveTop = (contentH: number, maxHeight: number) => {
    const usedH = Math.min(contentH, maxHeight);
    if (align === "center") {
      return clampTop((vh - usedH) / 2, usedH, vh);
    }
    return clampTop(rect.top - 8, usedH, vh);
  };

  // --- Flush left of drawer (joined) ---
  if (canDockToDrawer && drawerLeft != null) {
    const dockWidth = Math.min(
      Math.max(wantWidth, Math.min(spaceLeftOfDrawer, maxW)),
      spaceLeftOfDrawer,
    );
    const left = Math.max(VIEW_PAD, drawerLeft - dockWidth + DOCK_OVERLAP);
    const maxHeight = viewportCap;
    const top = resolveTop(measuredH, maxHeight);

    return {
      top,
      left,
      width: dockWidth,
      maxHeight,
      placement: "left",
      docked: true,
    };
  }

  // --- Left of trigger ---
  if (spaceLeftOfTrigger >= Math.min(wantWidth, 280)) {
    const dockWidth = Math.min(wantWidth, spaceLeftOfTrigger);
    const left = Math.max(VIEW_PAD, rect.left - FREE_GAP - dockWidth);
    const maxHeight = viewportCap;
    const top = resolveTop(measuredH, maxHeight);
    return {
      top,
      left,
      width: dockWidth,
      maxHeight,
      placement: "left",
      docked: false,
    };
  }

  // --- Below / above (narrow / mobile fallback) ---
  let width = Math.min(wantWidth, vw - VIEW_PAD * 2);
  width = Math.max(minW, Math.min(width, vw - VIEW_PAD * 2));
  let left = Math.max(VIEW_PAD, Math.min(rect.left, vw - VIEW_PAD - width));
  // Center under field when possible on small screens
  if (vw < 720) {
    left = Math.max(VIEW_PAD, (vw - width) / 2);
  }

  const placeBottom = spaceBelow >= 180 || spaceBelow >= spaceAbove;
  const available = placeBottom ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(200, Math.min(measuredH, available));

  if (placeBottom) {
    const top = rect.bottom + FREE_GAP;
    return {
      top: Math.min(top, vh - VIEW_PAD - 160),
      left,
      width,
      maxHeight: Math.min(maxHeight, vh - VIEW_PAD - top),
      placement: "bottom",
      docked: false,
    };
  }

  const top = Math.max(VIEW_PAD, rect.top - FREE_GAP - maxHeight);
  return {
    top,
    left,
    width,
    maxHeight: Math.min(maxHeight, rect.top - FREE_GAP - top),
    placement: "top",
    docked: false,
  };
}

/** Shell classes so docked panels feel joined to the form drawer. */
export function flyoutShellClass(pos: FlyoutPos) {
  if (pos.docked && pos.placement === "left") {
    return [
      "rounded-l-2xl rounded-r-none",
      "border border-r-0 border-[rgba(33,37,41,0.08)]",
      "bg-white",
      "shadow-[-18px_12px_48px_rgba(15,17,20,0.14)]",
    ].join(" ");
  }
  return [
    "rounded-2xl",
    "border border-[rgba(33,37,41,0.08)]",
    "bg-white",
    "shadow-[0_20px_52px_rgba(15,17,20,0.16)]",
  ].join(" ");
}

export function dropdownShellClass() {
  return [
    "rounded-xl",
    "border border-[rgba(33,37,41,0.08)]",
    "bg-white",
    "shadow-[0_12px_40px_rgba(15,17,20,0.14)]",
  ].join(" ");
}

export function findFlyoutLayer(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node) {
    const host = node.closest?.('[data-flyout-host="drawer"]') as HTMLElement | null;
    const root = host?.parentElement;
    const layer = root?.querySelector?.(
      "[data-flyout-layer]",
    ) as HTMLElement | null;
    if (layer) return layer;
    node = node.parentElement;
  }
  return null;
}

/**
 * @param emergeBehindDrawer When true, slide fully from under the form (no fade)
 * so the motion is clipped by the drawer edge.
 */
export function flyoutEnterClass(
  pos: FlyoutPos,
  entered: boolean,
  emergeBehindDrawer = false,
) {
  if (emergeBehindDrawer && (pos.docked || pos.placement === "left")) {
    // Keep fully opaque — the drawer covers the tucked portion.
    return entered ? "translate-x-0" : "translate-x-[110%]";
  }
  if (entered) return "translate-x-0 translate-y-0 opacity-100";
  if (pos.docked || pos.placement === "left") {
    return "translate-x-10 opacity-0";
  }
  switch (pos.placement) {
    case "right":
      return "-translate-x-3 opacity-0";
    case "top":
      return "translate-y-2 opacity-0";
    default:
      return "-translate-y-2 opacity-0";
  }
}
