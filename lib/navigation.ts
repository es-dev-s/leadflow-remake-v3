import {
  ArrowLeftRight,
  Contact,
  FileBarChart2,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const mainNavItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Live KPIs and pipeline health",
  },
  {
    id: "leads",
    label: "Leads",
    href: "/leads",
    icon: Contact,
    description: "Capture and qualify inbound demand",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    href: "/pipeline",
    icon: GitBranch,
    description: "Sales stages for your leads",
  },
  {
    id: "kpi",
    label: "KPI",
    href: "/kpi",
    icon: Gauge,
    description: "Operational KPI counts and ratios",
  },
  {
    id: "users",
    label: "Users",
    href: "/users",
    icon: Users,
    description: "Team members and access roles",
  },
  {
    id: "transfers",
    label: "Transfer logs",
    href: "/transfers",
    icon: ArrowLeftRight,
    description: "Lead handoff and reassignment history",
  },
  {
    id: "report",
    label: "Report",
    href: "/report",
    icon: FileBarChart2,
    description: "Performance summaries and exports",
  },
];

export const bottomNavItems: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Workspace and account preferences",
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    icon: UserRound,
    description: "Your account and session",
  },
];

export const navItems: NavItem[] = [...mainNavItems, ...bottomNavItems];

export function getNavItemByPath(pathname: string): NavItem {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact;
  return (
    navItems.find(
      (item) => item.href !== "/" && pathname.startsWith(item.href),
    ) ?? navItems[0]
  );
}

export function isNavItemActive(item: NavItem, pathname: string) {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
