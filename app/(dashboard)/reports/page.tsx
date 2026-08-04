"use client";

import { Suspense } from "react";
import { LeadDataGate } from "@/components/auth/lead-data-gate";
import { ReportContent } from "@/components/dashboard/report-content";

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <LeadDataGate>
        <ReportContent />
      </LeadDataGate>
    </Suspense>
  );
}
