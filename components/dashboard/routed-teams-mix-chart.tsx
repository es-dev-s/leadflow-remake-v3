"use client";

import { ThinLeadMixSection } from "@/components/dashboard/thin-lead-mix-section";
import type { TeamLeadCount } from "@/lib/api";

type Props = {
  mix: TeamLeadCount[];
  total: number;
  loading?: boolean;
};

export function RoutedTeamsMixChart({ mix, total, loading = false }: Props) {
  return (
    <ThinLeadMixSection
      title="Leads routed to teams"
      entityLabel="Team"
      emptyLabel="team routing data"
      keyPrefix="route"
      barTone="#ff7a1a"
      mix={mix}
      total={total}
      loading={loading}
    />
  );
}
