"use client";

/**
 * Compatibility barrel — prefer the isolated stores directly:
 * - `useUiStore` for overlays/menus
 * - `useLeadsStore` for table query/selection/columns
 * - `useBackendStatusStore` for health
 */
export { useUiStore } from "@/store/ui-store";
export {
  useLeadsStore,
  countSelectedOnPage,
  selectIsLeadSelected,
} from "@/store/leads-store";
export {
  useBackendStatusStore,
  subscribeBackendStatusPolling,
} from "@/store/backend-status-store";
