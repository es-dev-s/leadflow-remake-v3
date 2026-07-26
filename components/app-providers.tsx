"use client";

import { ActionToastHost } from "@/components/dashboard/action-toast-host";

/** Client chrome mounted from the root layout. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ActionToastHost />
    </>
  );
}
