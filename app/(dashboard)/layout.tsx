import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TelemetryHeartbeat } from "@/components/telemetry/telemetry-heartbeat";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <TelemetryHeartbeat />
      <DashboardShell>{children}</DashboardShell>
    </AuthGate>
  );
}
