"use client";

import { Suspense } from "react";
import { LeadDataGate } from "@/components/auth/lead-data-gate";
import { PagePanel } from "@/components/dashboard/page-panel";

function ReportPageInner() {
  return (
    <PagePanel
      title="Report"
      description="Performance summaries and exports"
    />
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <LeadDataGate>
        <ReportPageInner />
      </LeadDataGate>
    </Suspense>
  );
}
