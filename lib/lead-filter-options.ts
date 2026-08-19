import {
  fetchAssignableUsers,
  fetchGeoOptions,
  fetchSummaryBuckets,
  fetchTeams,
  type AssignableUser,
  type AnalystLeadStats,
  type NamedCount,
} from "@/lib/api";
import { LEAD_SOURCES, PORTAL_WEBSITES } from "@/lib/lead-form-options";
import { isAbortError } from "@/lib/reset-client-state";

export type FilterOption = { id: string; name: string };

export type LeadFilterOptions = {
  countries: NamedCount[];
  teams: FilterOption[];
  analysts: FilterOption[];
  salesExecs: AssignableUser[];
  sources: string[];
  portals: string[];
};

function uniqueSortedNames(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    if (key === "unassigned" || key === "unknown" || key === "none") continue;
    seen.add(key);
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

async function safe<T>(fn: () => Promise<T>, fallback: T, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return fallback;
  try {
    return await fn();
  } catch (err) {
    if (isAbortError(err) || signal.aborted) return fallback;
    console.error(err);
    return fallback;
  }
}

/** Load sidebar option lists independently so one 403 cannot blank the panel. */
export async function loadLeadFilterOptions(input: {
  hideTeam?: boolean;
  hideAnalyst?: boolean;
  hideSalesExec?: boolean;
  signal: AbortSignal;
}): Promise<LeadFilterOptions> {
  const { signal } = input;
  const emptyUsers: AssignableUser[] = [];
  const emptyAnalysts = { items: [] as AnalystLeadStats[] };
  const emptyNamed = { items: [] as Array<{ name: string }> };

  const [geo, teams, members, analystsPage, sourcesPage, portalsPage] =
    await Promise.all([
      safe(
        () => fetchGeoOptions({ type: "countries", signal }),
        { type: "countries" as const, items: [] as NamedCount[] },
        signal,
      ),
      input.hideTeam
        ? Promise.resolve([] as FilterOption[])
        : safe(
            async () =>
              (await fetchTeams(signal)).map((row) => ({
                id: row.id,
                name: row.name,
              })),
            [],
            signal,
          ),
      input.hideSalesExec
        ? Promise.resolve(emptyUsers)
        : safe(() => fetchAssignableUsers("members", signal), emptyUsers, signal),
      input.hideAnalyst
        ? Promise.resolve(emptyAnalysts)
        : safe(
            () =>
              fetchSummaryBuckets<AnalystLeadStats>({
                dimension: "analyst",
                limit: 200,
                signal,
              }),
            emptyAnalysts,
            signal,
          ),
      safe(
        () =>
          fetchSummaryBuckets<{ name: string }>({
            dimension: "source",
            limit: 200,
            signal,
          }),
        emptyNamed,
        signal,
      ),
      safe(
        () =>
          fetchSummaryBuckets<{ name: string }>({
            dimension: "portal",
            limit: 200,
            signal,
          }),
        emptyNamed,
        signal,
      ),
    ]);

  return {
    countries: geo.items ?? [],
    teams: [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    salesExecs: [...members].sort((a, b) => a.name.localeCompare(b.name)),
    analysts: (analystsPage.items ?? [])
      .filter((row) => row.id)
      .map((row) => ({
        id: row.id,
        name: row.name || row.email || row.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    sources: uniqueSortedNames([
      ...LEAD_SOURCES,
      ...(sourcesPage.items ?? []).map((row) => row.name),
    ]),
    portals: uniqueSortedNames([
      ...PORTAL_WEBSITES,
      ...(portalsPage.items ?? []).map((row) => row.name),
    ]),
  };
}
