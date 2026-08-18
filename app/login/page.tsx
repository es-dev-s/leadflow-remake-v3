"use client";

import { ApiError, fetchMe, loginRequest } from "@/lib/api";
import { COOKIE_SESSION, clearAuthToken, getAuthToken } from "@/lib/auth-token";
import { isAbortError } from "@/lib/reset-client-state";
import { useAuthStore } from "@/store/auth-store";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const bootstrapAbortRef = useRef<AbortController | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next") || "/";
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
    if (raw.startsWith("/login")) return "/";
    return raw;
  }, [searchParams]);

  useEffect(() => {
    // Always probe the HttpOnly cookie — no JWT in JS storage.
    const controller = new AbortController();
    bootstrapAbortRef.current = controller;
    void fetchMe(controller.signal)
      .then((user) => {
        if (controller.signal.aborted) return;
        setSession(COOKIE_SESSION, "", user);
        (document.activeElement as HTMLElement | null)?.blur?.();
        router.replace(nextPath);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        if (getAuthToken()) clearAuthToken();
      });
    return () => {
      controller.abort();
      if (bootstrapAbortRef.current === controller) {
        bootstrapAbortRef.current = null;
      }
    };
  }, [nextPath, router, setSession]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const cleanEmail = email.trim().replace(/^["']+|["']+$/g, "").trim().toLowerCase();
    const cleanPassword = password.replace(/^["']+|["']+$/g, "");

    bootstrapAbortRef.current?.abort();
    bootstrapAbortRef.current = null;

    try {
      const result = await loginRequest(cleanEmail, cleanPassword);
      setSession(COOKIE_SESSION, result.expiresAt, result.user);
      (document.activeElement as HTMLElement | null)?.blur?.();
      router.replace(nextPath);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,#fff7ef_0%,#f8f9fa_42%,#ffffff_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-[rgba(232,104,18,0.12)] blur-3xl"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#212529] text-[13px] font-semibold tracking-tight text-white">
            Lf
          </div>
          <h1 className="mt-4 text-[24px] font-medium tracking-[-0.05em] text-[#212529] sm:text-[28px]">
            LeadFlow
          </h1>
          <p className="mt-1.5 text-[13px] text-[#868e96]">
            Sign in with your work account
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-[rgba(33,37,41,0.08)] bg-white/95 p-6 shadow-[0_24px_64px_rgba(15,17,20,0.08)] backdrop-blur-sm"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] px-3.5 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow] placeholder:text-[#adb5bd] focus:border-[rgba(232,104,18,0.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(232,104,18,0.1)]"
                placeholder="you@company.com"
              />
              {fieldErrors.email ? (
                <p className="mt-1 text-[11px] text-[#c92a2a]">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-[rgba(33,37,41,0.1)] bg-[#fbfbfc] px-3.5 text-[13px] text-[#212529] outline-none transition-[border-color,box-shadow] placeholder:text-[#adb5bd] focus:border-[rgba(232,104,18,0.5)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(232,104,18,0.1)]"
                placeholder="••••••••"
              />
              {fieldErrors.password ? (
                <p className="mt-1 text-[11px] text-[#c92a2a]">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-[rgba(201,42,42,0.18)] bg-[#fff5f5] px-3 py-2 text-[12px] text-[#c92a2a]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-[#212529] text-[13px] font-medium text-white outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[#e86812]/35 focus-visible:ring-offset-2 disabled:opacity-70"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-[#f8f9fa] text-[13px] text-[#868e96]">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
