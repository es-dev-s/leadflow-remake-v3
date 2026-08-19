"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DashboardFilterSidebar } from "@/components/dashboard/dashboard-filter-sidebar";
import { LeadFilterSidebar } from "@/components/dashboard/lead-filter-sidebar";
import { canViewLeadData } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";

/** Renders the page-appropriate filter panel inside the dashboard shell. */
export function GlobalFilterHost() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const closeFilterSidebar = useUiStore((s) => s.closeFilterSidebar);
  const onLeads = pathname === "/leads" || pathname.startsWith("/leads/");
  const onProfile = pathname === "/profile" || pathname.startsWith("/profile/");

  // Avoid carrying an open panel across routes with different filter models.
  useEffect(() => {
    closeFilterSidebar();
  }, [pathname, closeFilterSidebar]);

  if (!canViewLeadData(role) || onProfile) {
    return null;
  }

  if (onLeads) {
    return <LeadFilterSidebar />;
  }

  return <DashboardFilterSidebar />;
}
