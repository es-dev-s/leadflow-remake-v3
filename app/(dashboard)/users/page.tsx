"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UsersContent } from "@/components/dashboard/users-content";
import { canViewUsers } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

function UsersGate() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const allowed = canViewUsers(role);

  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  if (!allowed) return null;

  return <UsersContent />;
}

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersGate />
    </Suspense>
  );
}
