import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PresenceBridge } from "@/components/dashboard/presence-bridge";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <PresenceBridge />
      <DashboardShell>{children}</DashboardShell>
    </AuthGate>
  );
}
