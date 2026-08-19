"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { canViewLeadData } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

/** Redirects roles without lead access to the dashboard. */
export function LeadDataGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const allowed = canViewLeadData(role);

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  if (!allowed) return null;

  return children;
}
