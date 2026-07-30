"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LeadDataGate } from "@/components/auth/lead-data-gate";
import { KpiContent } from "@/components/dashboard/kpi-content";
import { canViewKpi } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

function KpiPageInner() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const allowed = canViewKpi(role);

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  if (!allowed) return null;
  return <KpiContent />;
}

export default function KpiPage() {
  return (
    <Suspense fallback={null}>
      <LeadDataGate>
        <KpiPageInner />
      </LeadDataGate>
    </Suspense>
  );
}
