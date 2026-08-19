"use client";

import { formatDate } from "@/lib/datetime";
import { isAnalystTeamLead, isSuperadmin } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  if (!user) {
    return (
      <section className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
        <p className="text-[13px] text-[#868e96]">Loading profile…</p>
      </section>
    );
  }

  const managerName = user.managerName?.trim();
  const hasManager = Boolean(user.managerId?.trim() || managerName);
  const showTeam =
    !isSuperadmin(user.role) && !isAnalystTeamLead(user.role);

  const rows: Array<{ label: string; value: string }> = [
    { label: "Email", value: user.email || "—" },
    { label: "Role", value: user.roleLabel || user.role || "—" },
    ...(showTeam ? [{ label: "Team", value: user.teamName || "—" }] : []),
    ...(hasManager
      ? [{ label: "Manager", value: managerName || "—" }]
      : []),
    {
      label: "Session",
      value: user.isActiveSession ? "Online" : "Offline",
    },
    {
      label: "Password",
      value: user.hasPassword ? "Set" : "Not set",
    },
    {
      label: "Joined",
      value: formatDate(user.createdAt),
    },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 flex-col gap-1 border-b border-[rgba(33,37,41,0.05)] px-5 py-4">
        <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529]">
          Profile
        </h2>
        <p className="text-[13px] text-[#868e96]">
          Your account and session
        </p>
      </div>

      <div className="lf-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] text-[13px] font-medium text-[#495057]">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-medium tracking-[-0.02em] text-[#212529]">
                {user.name}
              </p>
              <p className="truncate text-[13px] text-[#868e96]">{user.email}</p>
            </div>
          </div>

          <dl className="overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.08)]">
            {rows.map((row, index) => (
              <div
                key={row.label}
                className={[
                  "grid grid-cols-[120px_1fr] gap-3 px-4 py-3 sm:grid-cols-[140px_1fr]",
                  index > 0 ? "border-t border-[rgba(33,37,41,0.06)]" : "",
                ].join(" ")}
              >
                <dt className="text-[11px] font-medium tracking-[0.08em] text-[#868e96] uppercase">
                  {row.label}
                </dt>
                <dd className="text-[13px] text-[#212529]">{row.value}</dd>
              </div>
            ))}
          </dl>

          {user.mustResetPassword ? (
            <p className="rounded-xl border border-[rgba(232,104,18,0.22)] bg-[#fff7ef] px-3.5 py-2.5 text-[12px] text-[#9a3f00]">
              A password reset is required for this account. Ask a superadmin to
              set a new password.
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                clearSession();
                window.location.assign("/login");
              }}
              className="lf-pressable h-10 rounded-xl border border-[rgba(33,37,41,0.1)] bg-white px-4 text-[13px] font-medium text-[#495057] hover:bg-[#f8f9fa]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
