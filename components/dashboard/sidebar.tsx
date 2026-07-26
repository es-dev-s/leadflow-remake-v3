"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  bottomNavItems,
  isNavItemActive,
  mainNavItems,
  type NavItem,
} from "@/lib/navigation";
import { canViewUsers, useAuthStore } from "@/store/auth-store";
import {
  canViewLeadData,
  isAnalystTeamLead,
  isLeadAnalyst,
  isMainTeamLead,
  isSalesExecutive,
  isSuperadmin,
} from "@/lib/roles";

function canSeePipeline(role: string | null | undefined) {
  if (!canViewLeadData(role)) return false;
  return (
    isLeadAnalyst(role) ||
    isAnalystTeamLead(role) ||
    isSuperadmin(role) ||
    isMainTeamLead(role) ||
    isSalesExecutive(role)
  );
}
function NavTooltip({ label }: { label: string }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute top-1/2 left-[calc(100%+10px)] z-50 hidden -translate-y-1/2 translate-x-0.5 opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100 sm:block"
    >
      <div className="whitespace-nowrap rounded-md border border-[rgba(33,37,41,0.08)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#212529] shadow-[0_8px_20px_rgba(33,37,41,0.1)]">
        {label}
      </div>
    </div>
  );
}

function NavIcon({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = isNavItemActive(item, pathname);

  return (
    <div className="group relative shrink-0">
      <Link
        href={item.href}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        title={item.label}
        className={[
          "lf-pressable relative flex h-10 w-10 items-center justify-center rounded-[10px] outline-none transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-[#e86812]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          isActive
            ? "bg-[#fff7ef] text-[#9a3f00]"
            : "text-[#6c757d] hover:bg-[#f8f9fa] hover:text-[#212529]",
        ].join(" ")}
      >
        {isActive ? (
          <span
            aria-hidden
            className="absolute left-0 h-4 w-[2px] rounded-full bg-[#e86812]"
          />
        ) : null}
        <Icon size={18} strokeWidth={isActive ? 1.75 : 1.5} />
      </Link>
      <NavTooltip label={item.label} />
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function ProfileNav({
  item,
  pathname,
  label,
}: {
  item: NavItem;
  pathname: string;
  label: string;
}) {
  const isActive = isNavItemActive(item, pathname);

  return (
    <div className="group relative shrink-0">
      <Link
        href={item.href}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        title={item.label}
        className={[
          "lf-pressable relative flex h-10 w-10 items-center justify-center rounded-full outline-none transition-[box-shadow,opacity] duration-150",
          "focus-visible:ring-2 focus-visible:ring-[#e86812]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          isActive
            ? "ring-2 ring-[#e86812]/40 ring-offset-2 ring-offset-white"
            : "hover:opacity-90",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-medium",
            isActive
              ? "bg-[#212529] text-white"
              : "border border-[rgba(33,37,41,0.08)] bg-[#f8f9fa] text-[#495057] group-hover:border-[rgba(33,37,41,0.16)] group-hover:bg-[#f1f3f5]",
          ].join(" ")}
        >
          {label}
        </span>
      </Link>
      <NavTooltip label={item.label} />
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const settingsItem = bottomNavItems.find((item) => item.id === "settings")!;
  const profileItem = bottomNavItems.find((item) => item.id === "profile")!;
  const avatar = initials(user?.name || "User");
  const visibleMainNav = mainNavItems.filter((item) => {
    if (!canViewLeadData(user?.role) && item.id !== "dashboard") return false;
    if (item.id === "users") return canViewUsers(user);
    if (item.id === "transfers")
      return !isLeadAnalyst(user?.role) && !isSalesExecutive(user?.role);
    if (item.id === "pipeline") return canSeePipeline(user?.role);
    return true;
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex h-dvh w-14 flex-col overflow-visible border-r border-[rgba(33,37,41,0.06)] bg-white sm:w-[68px]">
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-[rgba(33,37,41,0.04)]">
        <Link
          href="/"
          className="lf-pressable flex h-8 w-8 items-center justify-center rounded-lg bg-[#212529] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#e86812]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          aria-label="LeadFlow home"
        >
          <span className="text-[11px] font-semibold tracking-tight text-white">
            Lf
          </span>
        </Link>
      </div>

      <nav
        aria-label="Primary"
        className="flex min-h-0 flex-1 flex-col items-center overflow-visible px-1.5 py-3 sm:px-3"
      >
        <div className="flex shrink-0 flex-col items-center gap-1">
          {visibleMainNav.map((item) => (
            <NavIcon key={item.id} item={item} pathname={pathname} />
          ))}
        </div>

        <div className="min-h-4 flex-1" />

        <div className="flex shrink-0 flex-col items-center gap-1 border-t border-[rgba(33,37,41,0.06)] pt-3">
          <NavIcon item={settingsItem} pathname={pathname} />
          <ProfileNav
            item={profileItem}
            pathname={pathname}
            label={avatar}
          />
          <div className="group relative shrink-0">
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => {
                clearSession();
                router.replace("/login");
              }}
              className="lf-pressable relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[#6c757d] outline-none transition-colors hover:bg-[#fff5f5] hover:text-[#c92a2a] focus-visible:ring-2 focus-visible:ring-[#e86812]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <LogOut size={17} strokeWidth={1.5} />
            </button>
            <NavTooltip label="Sign out" />
          </div>
        </div>
      </nav>
    </aside>
  );
}
