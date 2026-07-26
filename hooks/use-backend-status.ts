"use client";

import { useEffect } from "react";
import {
  subscribeBackendStatusPolling,
  useBackendStatusStore,
  type BackendStatus,
} from "@/store/backend-status-store";

export type { BackendStatus };

export function useBackendStatus() {
  const status = useBackendStatusStore((s) => s.status);
  const database = useBackendStatusStore((s) => s.database);

  useEffect(() => subscribeBackendStatusPolling(), []);

  return { status, database };
}
