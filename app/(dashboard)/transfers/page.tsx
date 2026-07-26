"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LeadDataGate } from "@/components/auth/lead-data-gate";
import { TransfersContent } from "@/components/dashboard/transfers-content";
import { isLeadAnalyst, isSalesExecutive } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

function TransfersGate() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const blocked = isLeadAnalyst(role) || isSalesExecutive(role);

  useEffect(() => {
    if (blocked) router.replace("/");
  }, [blocked, router]);

  if (blocked) return null;

  return <TransfersContent />;
}

export default function TransfersPage() {
  return (
    <Suspense fallback={null}>
      <LeadDataGate>
        <TransfersGate />
      </LeadDataGate>
    </Suspense>
  );
}
