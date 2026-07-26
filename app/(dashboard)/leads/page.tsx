import { Suspense } from "react";
import { LeadDataGate } from "@/components/auth/lead-data-gate";
import { LeadsContent } from "@/components/dashboard/leads-content";

function LeadsFallback() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <div className="flex h-10 shrink-0 items-center gap-2">
        <div className="h-8 w-28 rounded-lg bg-[rgba(33,37,41,0.06)]" />
        <div className="h-8 w-24 rounded-lg bg-[rgba(33,37,41,0.06)]" />
        <div className="ml-auto h-8 w-20 rounded-lg bg-[rgba(33,37,41,0.06)]" />
      </div>
      <div className="min-h-0 flex-1 rounded-xl border border-[rgba(33,37,41,0.06)] bg-white" />
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<LeadsFallback />}>
      <LeadDataGate>
        <LeadsContent />
      </LeadDataGate>
    </Suspense>
  );
}
