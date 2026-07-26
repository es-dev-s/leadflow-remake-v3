"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, fetchMe } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-token";
import { readCachedUser, writeCachedUser } from "@/lib/auth-user-cache";
import { isAbortError } from "@/lib/reset-client-state";
import { useAuthStore } from "@/store/auth-store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const hydrateToken = useAuthStore((s) => s.hydrateToken);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const markBootstrapped = useAuthStore((s) => s.markBootstrapped);
  const [ready, setReady] = useState(() => Boolean(useAuthStore.getState().user));

  useEffect(() => {
    const existing = hydrateToken();
    if (!existing) {
      writeCachedUser(null);
      markBootstrapped();
      router.replace("/login");
      return;
    }

    // Instant shell: restore last known user so we never flash the full loader.
    let hadUser = Boolean(useAuthStore.getState().user);
    if (!hadUser) {
      const cached = readCachedUser();
      if (cached) {
        setUser(cached);
        hadUser = true;
      }
    }
    if (hadUser) {
      markBootstrapped();
      setReady(true);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    void fetchMe(controller.signal)
      .then((me) => {
        if (controller.signal.aborted) return;
        if (getAuthToken() !== existing) return;
        writeCachedUser(me);
        setUser(me);
        markBootstrapped();
        setReady(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) {
          if (useAuthStore.getState().user) {
            markBootstrapped();
            setReady(true);
            return;
          }
          if (getAuthToken() !== existing) return;
          markBootstrapped();
          writeCachedUser(null);
          clearSession();
          router.replace("/login");
          return;
        }
        if (getAuthToken() !== existing) return;

        const isUnauthorized =
          err instanceof ApiError && err.status === 401;

        if (!isUnauthorized && useAuthStore.getState().user) {
          markBootstrapped();
          setReady(true);
          return;
        }

        markBootstrapped();
        writeCachedUser(null);
        clearSession();
        router.replace("/login");
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    hydrateToken,
    setUser,
    clearSession,
    markBootstrapped,
    router,
  ]);

  // Only block the whole shell when we have nothing to show yet.
  if (!bootstrapped || !token || !user || !ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#f8f9fa]">
        <div className="inline-flex items-center gap-2 text-[13px] text-[#6c757d]">
          <LoaderCircle size={16} className="animate-spin text-[#212529]" />
          Checking session…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
