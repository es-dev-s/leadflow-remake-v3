"use client";

import { Suspense } from "react";
import { LeadDataGate } from "@/components/auth/lead-data-gate";
import { PipelineContent } from "@/components/dashboard/pipeline-content";

export default function PipelinePage() {
  return (
    <Suspense fallback={null}>
      <LeadDataGate>
        <PipelineContent />
      </LeadDataGate>
    </Suspense>
  );
}
