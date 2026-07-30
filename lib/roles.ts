/** Role IDs mirrored from backend/roles.go */

export const Role = {
  Superadmin: "SUPERADMIN",
  AnalystTeamLead: "ANALYST_TEAM_LEAD",
  LeadAnalyst: "LEAD_ANALYST",
  MainTeamLead: "MAIN_TEAM_LEAD",
  SalesExecutive: "SALES_EXECUTIVE",
  Support: "SUPPORT",
} as const;

export type RoleId = (typeof Role)[keyof typeof Role];

export type RoleOption = {
  value: string;
  label: string;
};

export const ALL_ROLE_OPTIONS: RoleOption[] = [
  { value: Role.Superadmin, label: "Superadmin" },
  { value: Role.AnalystTeamLead, label: "Analyst Team Lead" },
  { value: Role.LeadAnalyst, label: "Lead Analyst" },
  { value: Role.MainTeamLead, label: "Main Team Lead" },
  { value: Role.SalesExecutive, label: "Sales Executive" },
  { value: Role.Support, label: "Support" },
];

const ATL_MANAGED: RoleId[] = [
  Role.LeadAnalyst,
  Role.MainTeamLead,
  Role.SalesExecutive,
];

export function isSuperadmin(role: string | null | undefined) {
  return role === Role.Superadmin;
}

export function isAnalystTeamLead(role: string | null | undefined) {
  return role === Role.AnalystTeamLead;
}

export function isLeadAnalyst(role: string | null | undefined) {
  return role === Role.LeadAnalyst;
}

export function isMainTeamLead(role: string | null | undefined) {
  return role === Role.MainTeamLead;
}

export function isSalesExecutive(role: string | null | undefined) {
  return role === Role.SalesExecutive;
}

export function isSupport(role: string | null | undefined) {
  return role === Role.Support;
}

/** Who may see lead inventory, pipeline, transfers, and lead analytics. */
export function canViewLeadData(role: string | null | undefined) {
  return !isSupport(role) && Boolean(role);
}

/** Operational KPI page — not for Sales Executives (assigned-inventory focus). */
export function canViewKpi(role: string | null | undefined) {
  return canViewLeadData(role) && !isSalesExecutive(role);
}

/** Superadmin may edit dynamic KPI targets / weightages. */
export function canEditKpiTargets(role: string | null | undefined) {
  return isSuperadmin(role);
}

export function canManageUsers(role: string | null | undefined) {
  return isSuperadmin(role) || isAnalystTeamLead(role) || isMainTeamLead(role);
}

/** Who may open the Users page (read). */
export function canViewUsers(role: string | null | undefined) {
  return canManageUsers(role);
}

/** Lead Analysts only see leads they created. */
export function isCreatorScoped(role: string | null | undefined) {
  return isLeadAnalyst(role);
}

/** Sales Executives only see leads assigned to them. */
export function isAssigneeScoped(role: string | null | undefined) {
  return isSalesExecutive(role);
}

/**
 * Personal analytics layout (LA + SE): hide Active users, cross-team tables,
 * and org-wide attribution sections.
 */
export function isAnalyticsScoped(role: string | null | undefined) {
  return isCreatorScoped(role) || isAssigneeScoped(role);
}

/** Main Team Leads only see their team's leads / SEs. */
export function isTeamScoped(role: string | null | undefined) {
  return isMainTeamLead(role);
}

/** Roles this actor may create / edit / delete. */
export function creatableRoles(actorRole: string | null | undefined): RoleId[] {
  if (isSuperadmin(actorRole)) {
    return ALL_ROLE_OPTIONS.map((r) => r.value as RoleId);
  }
  if (isAnalystTeamLead(actorRole)) {
    return [...ATL_MANAGED];
  }
  if (isMainTeamLead(actorRole)) {
    return [Role.SalesExecutive];
  }
  return [];
}

export function creatableRoleOptions(
  actorRole: string | null | undefined,
): RoleOption[] {
  const allowed = new Set(creatableRoles(actorRole));
  return ALL_ROLE_OPTIONS.filter((r) => allowed.has(r.value as RoleId));
}

/** Users-page tabs for the actor. */
export function userManagementTabs(
  actorRole: string | null | undefined,
): Array<{ id: string; label: string }> {
  if (isSuperadmin(actorRole)) {
    return [
      { id: "all", label: "All" },
      ...ALL_ROLE_OPTIONS.map((r) => ({ id: r.value, label: r.label })),
    ];
  }
  if (isAnalystTeamLead(actorRole)) {
    return [
      { id: Role.LeadAnalyst, label: "Lead Analysts" },
      { id: Role.MainTeamLead, label: "Main Team Leads" },
      { id: Role.SalesExecutive, label: "Sales Executives" },
    ];
  }
  if (isMainTeamLead(actorRole)) {
    return [{ id: Role.SalesExecutive, label: "Sales Executives" }];
  }
  return [];
}

export function canActOnUserRole(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
) {
  if (!targetRole) return false;
  if (isSuperadmin(actorRole)) return true;
  return creatableRoles(actorRole).includes(targetRole as RoleId);
}

export function canMutateLeads(role: string | null | undefined) {
  return (
    isSuperadmin(role) ||
    isAnalystTeamLead(role) ||
    isLeadAnalyst(role) ||
    isMainTeamLead(role) ||
    isSalesExecutive(role)
  );
}

/** Who may create new leads (SEs work assigned inventory only). */
export function canCreateLeads(role: string | null | undefined) {
  return canMutateLeads(role) && !isSalesExecutive(role);
}

/** Who may reassign leads to teams / members. */
export function canAssignLeads(role: string | null | undefined) {
  return canMutateLeads(role) && !isSalesExecutive(role);
}

/**
 * Who may assign to team-lead targets. Main Team Leads only assign to
 * members (sales executives) on their team.
 */
export function canAssignToTeamLeads(role: string | null | undefined) {
  return canAssignLeads(role) && !isMainTeamLead(role);
}

/**
 * Who may change qualification status. Main Team Leads assign within the
 * team; qualification stays with analysts. SEs update sales outcome only.
 */
export function canChangeQualification(role: string | null | undefined) {
  return (
    isSuperadmin(role) || isAnalystTeamLead(role) || isLeadAnalyst(role)
  );
}

/**
 * Full lead create/edit (contact, source, analyst notes, etc.).
 * Main Team Leads assign within the team; they do not edit lead profile data.
 * Sales Executives update sales outcome only.
 */
export function canEditLeadProfile(role: string | null | undefined) {
  return (
    isSuperadmin(role) || isAnalystTeamLead(role) || isLeadAnalyst(role)
  );
}

/** Bulk/single lead deletion — Superadmin and ATL only. */
export function canDeleteLeads(role: string | null | undefined) {
  return isSuperadmin(role) || isAnalystTeamLead(role);
}

/** Sales outcome: stage, initial payment, closed revenue, SE notes. */
export function canUpdateSalesOutcome(role: string | null | undefined) {
  return (
    isSuperadmin(role) || isAnalystTeamLead(role) || isSalesExecutive(role)
  );
}

/** Only Sales Executives may flag a lead as not appropriate. */
export function canMarkNotAppropriate(role: string | null | undefined) {
  return isSalesExecutive(role);
}

export function defaultCreateRole(
  actorRole: string | null | undefined,
): string {
  const options = creatableRoles(actorRole);
  if (options.includes(Role.SalesExecutive) && isMainTeamLead(actorRole)) {
    return Role.SalesExecutive;
  }
  if (options.includes(Role.LeadAnalyst)) return Role.LeadAnalyst;
  return options[0] ?? Role.SalesExecutive;
}
