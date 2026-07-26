"use client";

import { ThinLeadMixSection } from "@/components/dashboard/thin-lead-mix-section";
import type { TeamLeadCount } from "@/lib/api";

type Props = {
  mix: TeamLeadCount[];
  total: number;
  loading?: boolean;
};

export function SalesExecMixChart({ mix, total, loading = false }: Props) {
  return (
    <ThinLeadMixSection
      title="Leads by Sales Executive"
      entityLabel="Executive"
      emptyLabel="sales executive assignments"
      keyPrefix="exec"
      barTone="#495057"
      mix={mix}
      total={total}
      loading={loading}
    />
  );
}
