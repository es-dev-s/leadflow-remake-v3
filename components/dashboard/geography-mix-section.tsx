"use client";

import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { GeoFilterSelect } from "@/components/dashboard/geo-filter-select";
import {
  dashboardCardListClass,
  ViewMoreFooter,
} from "@/components/dashboard/view-more-footer";
import { useNavigateToLeads } from "@/hooks/use-navigate-to-leads";
import { useViewMore } from "@/hooks/use-view-more";
import {
  buildLeadCountryLookup,
  normalizeCountryKey,
  toMapCountryName,
} from "@/lib/country-map";
import { filterCityGeoOptions } from "@/lib/lead-filter-labels";
import {
  fetchGeoOptions,
  fetchGeographyMix,
  type NamedCount,
} from "@/lib/api";
import { useDashboardFilterStore } from "@/store/dashboard-filter-store";

const WORLD_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type CountryFeature = GeoJSON.Feature<
  GeoJSON.Geometry,
  { name?: string }
>;

type Props = {
  /** When set, geography follows the dashboard filter sidebar. */
  country?: string;
  city?: string;
};

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function fillForCount(count: number, max: number) {
  if (count <= 0 || max <= 0) return "#ffffff";
  const t = Math.min(1, Math.log10(count + 1) / Math.log10(max + 1));
  const lightness = 96 - t * 42;
  return `hsl(24 92% ${lightness}%)`;
}

export function GeographyMixSection({
  country: countryProp,
  city: cityProp,
}: Props) {
  const navigateToLeads = useNavigateToLeads();
  const setDashboardFilters = useDashboardFilterStore((s) => s.setFilters);
  const dashboardFilters = useDashboardFilterStore((s) => s.filters);
  const [mix, setMix] = useState<NamedCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mixError, setMixError] = useState<string | null>(null);

  const controlled = countryProp !== undefined || cityProp !== undefined;
  const [localCountry, setLocalCountry] = useState("");
  const [localCity, setLocalCity] = useState("");
  const country = controlled ? (countryProp ?? "") : localCountry;
  const city = controlled ? (cityProp ?? "") : localCity;
  const [countries, setCountries] = useState<NamedCount[]>([]);
  const [cities, setCities] = useState<NamedCount[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const [geographies, setGeographies] = useState<CountryFeature[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchGeoOptions({ type: "countries", signal: controller.signal })
      .then((countryData) => {
        if (controller.signal.aborted) return;
        if (countryData.type !== "countries") return;
        setCountries(countryData.items ?? []);
      })
      .catch(() => {
        /* options are non-blocking */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const scopedCountry = country.trim();
    if (!scopedCountry) {
      setCities([]);
      setCitiesLoading(false);
      return;
    }

    const controller = new AbortController();
    setCitiesLoading(true);
    void fetchGeoOptions({
      type: "cities",
      country: scopedCountry,
      signal: controller.signal,
    })
      .then((cityData) => {
        if (controller.signal.aborted) return;
        if (cityData.type !== "cities") return;
        setCities(
          filterCityGeoOptions(
            cityData.items ?? [],
            countries,
            scopedCountry,
          ),
        );
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCities([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCitiesLoading(false);
      });
    return () => controller.abort();
  }, [country, countries]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(WORLD_URL, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Map load failed (${res.status})`);
        return res.json() as Promise<Topology>;
      })
      .then((topology) => {
        if (controller.signal.aborted) return;
        const countriesObj = topology.objects.countries;
        if (!countriesObj) throw new Error("World atlas missing countries");
        const collection = feature(
          topology,
          countriesObj,
        ) as GeoJSON.FeatureCollection<GeoJSON.Geometry, { name?: string }>;
        setGeographies(collection.features as CountryFeature[]);
        setMapError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setMapError(err instanceof Error ? err.message : "Failed to load map");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const hasData = mix.length > 0;
    if (!hasData) setLoading(true);
    else setRefreshing(true);

    const timer = window.setTimeout(() => {
      void fetchGeographyMix({
        country: country || undefined,
        city: city || undefined,
        signal: controller.signal,
      })
        .then((data) => {
          if (controller.signal.aborted) return;
          setMix(Array.isArray(data.items) ? data.items : []);
          setMixError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setMixError(
            err instanceof Error ? err.message : "Failed to load geography",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
            setRefreshing(false);
          }
        });
    }, hasData ? 160 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, city]);

  const rows = useMemo(
    () => (Array.isArray(mix) ? mix.filter((item) => item.count > 0) : []),
    [mix],
  );
  const more = useViewMore(rows);
  const lookup = useMemo(() => buildLeadCountryLookup(rows), [rows]);
  const total = useMemo(
    () => rows.reduce((acc, row) => acc + row.count, 0),
    [rows],
  );
  const maxCount = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.count), 0) || 1,
    [rows],
  );
  const countryCount = useMemo(() => {
    return rows.length
  }, [rows]);

  const activeRow = useMemo(() => {
    if (!active) return null;
    return lookup.get(normalizeCountryKey(active)) ?? null;
  }, [active, lookup]);

  const openCountry = (dbCountry: string) => {
    const name = dbCountry.trim();
    if (!name) return;
    navigateToLeads({ country: name });
  };

  const width = 960;
  const height = 420;
  const projection = useMemo(
    () =>
      geoMercator()
        .scale(140)
        .translate([width / 2, height / 1.55])
        .clipExtent([
          [0, 0],
          [width, height],
        ]),
    [],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const busy = loading || refreshing;

  return (
    <section className="@container flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[rgba(33,37,41,0.06)] bg-white">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[rgba(33,37,41,0.05)] px-3.5 py-3 @[40rem]:px-5">
        <div className="flex flex-col gap-3 @[56rem]:flex-row @[56rem]:items-end @[56rem]:justify-between">
          <div className="min-w-0">
            <h2 className="text-[16px] font-medium tracking-[-0.03em] text-[#212529] @[28rem]:text-[17px]">
              Leads by Geography
            </h2>
            <p className="mt-0.5 text-[12px] text-[#868e96]">
              Click a country on the map or list to open matching leads
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end @[56rem]:w-auto">
            <GeoFilterSelect
              label="Filter by country"
              placeholder="All countries"
              value={country}
              options={countries}
              onChange={(next) => {
                if (controlled) {
                  setDashboardFilters({
                    ...dashboardFilters,
                    country: next,
                    city: "",
                  });
                  return;
                }
                setLocalCountry(next);
                if (next) setLocalCity("");
              }}
            />
            <GeoFilterSelect
              label="Filter by city"
              placeholder={country.trim() ? "All cities" : "Select a country first"}
              value={city}
              options={cities}
              disabled={!country.trim()}
              loading={citiesLoading}
              onChange={(next) => {
                if (controlled) {
                  setDashboardFilters({
                    ...dashboardFilters,
                    city: next,
                    // Keep country when picking a city from the scoped list.
                    country: dashboardFilters.country,
                  });
                  return;
                }
                setLocalCity(next);
                if (next) setLocalCountry("");
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-[#f8f9fa] px-2.5 py-1 text-[11px] tabular-nums text-[#212529]">
            <span className="text-[#868e96]">Countries</span>
            <span className="font-medium">{formatCount(countryCount)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(33,37,41,0.1)] bg-white px-2.5 py-1 text-[11px] tabular-nums text-[#212529]">
            <span className="text-[#868e96]">Leads</span>
            <span className="font-medium">{formatCount(total)}</span>
          </span>
          {activeRow ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(233,136,18,0.28)] bg-[#fff7ef] px-2.5 py-1 text-[11px] tabular-nums text-[#9a3f00]">
              <span className="opacity-80">{activeRow.label}</span>
              <span className="font-medium">
                {formatCount(activeRow.count)}
              </span>
            </span>
          ) : null}
          {country || city ? (
            <button
              type="button"
              onClick={() =>
                navigateToLeads({
                  country: country || undefined,
                  city: city || undefined,
                })
              }
              className="lf-pressable inline-flex items-center rounded-lg border border-[rgba(233,136,18,0.28)] bg-[#fff7ef] px-2.5 py-1 text-[11px] font-medium text-[#9a3f00] hover:bg-[#ffefdf]"
            >
              Open filtered leads
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1.15fr)_minmax(0,0.85fr)] transition-opacity duration-200 @[64rem]:grid-cols-[minmax(0,1.6fr)_minmax(240px,0.9fr)] @[64rem]:grid-rows-1 ${
          busy && rows.length > 0 ? "opacity-70" : "opacity-100"
        }`}
      >
        <div className="relative min-h-0 overflow-hidden bg-white p-2 @[40rem]:p-3">
          {mapError ? (
            <div className="flex h-full items-center justify-center px-4 text-center">
              <p className="text-[13px] text-[#868e96]">{mapError}</p>
            </div>
          ) : geographies.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center">
              <p className="text-[13px] text-[#868e96]">Loading world map…</p>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-full w-full"
              role="img"
              aria-label="World map of lead geography"
            >
              <rect width={width} height={height} fill="#ffffff" />
              {geographies.map((geo) => {
                const name = geo.properties?.name ?? "";
                const hit = lookup.get(normalizeCountryKey(name));
                const count = hit?.count ?? 0;
                const highlighted = count > 0;
                const isActive =
                  active != null &&
                  normalizeCountryKey(active) === normalizeCountryKey(name);
                const d = path(geo as GeoPermissibleObjects);
                if (!d) return null;
                return (
                  <path
                    key={geo.id ?? name}
                    d={d}
                    fill={
                      highlighted
                        ? isActive
                          ? "#e86812"
                          : fillForCount(count, maxCount)
                        : "#ffffff"
                    }
                    stroke={highlighted ? "#9a3f00" : "#ced4da"}
                    strokeWidth={highlighted ? (isActive ? 1.1 : 0.7) : 0.45}
                    className={
                      highlighted
                        ? "cursor-pointer transition-[fill,stroke-width] duration-150"
                        : undefined
                    }
                    onMouseEnter={() => {
                      if (highlighted) setActive(name);
                    }}
                    onMouseLeave={() => setActive(null)}
                    onClick={() => {
                      if (highlighted && hit?.label) openCountry(hit.label);
                    }}
                  >
                    {highlighted ? (
                      <title>{`${hit?.label ?? name}: ${formatCount(count)} · Open leads`}</title>
                    ) : null}
                  </path>
                );
              })}
            </svg>
          )}
        </div>

        <div className="flex min-h-0 flex-col border-t border-[rgba(33,37,41,0.05)] @[64rem]:border-t-0 @[64rem]:border-l">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[rgba(33,37,41,0.05)] bg-[#f8f9fa] px-3.5 py-2">
            <span className="text-[10px] font-medium tracking-[0.06em] text-[#adb5bd] uppercase">
              All countries
            </span>
            {!busy && rows.length > 0 ? (
              <span className="text-[10px] tabular-nums text-[#adb5bd]">
                {formatCount(rows.length)}
              </span>
            ) : null}
          </div>
          <div className={dashboardCardListClass(more.expanded)}>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-[#6c757d]">
                {busy
                  ? "Loading geography…"
                  : mixError
                    ? mixError
                    : "No country data yet."}
              </p>
            ) : (
              <ul className="divide-y divide-[rgba(33,37,41,0.04)]" role="list">
                {more.visible.map((row, index) => {
                  const pct = (row.count / Math.max(total, 1)) * 100;
                  const isUnknown =
                    normalizeCountryKey(row.name) === "unknown";
                  const atlasName = toMapCountryName(row.name);
                  const hoverKey = atlasName ?? row.name;
                  const isActive =
                    active != null &&
                    normalizeCountryKey(active) ===
                      normalizeCountryKey(hoverKey);
                  return (
                    <li key={`${row.name}:${index}`}>
                      <button
                        type="button"
                        onMouseEnter={() => {
                          if (atlasName) setActive(atlasName);
                          else setActive(row.name);
                        }}
                        onMouseLeave={() => setActive(null)}
                        onClick={() => openCountry(row.name)}
                        className={`grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 px-3.5 py-2 text-left transition-colors ${
                          isActive
                            ? "bg-[#fff7ef]"
                            : "bg-white hover:bg-[#fafbfc]"
                        } ${isUnknown ? "opacity-90" : ""}`}
                      >
                        <span className="text-[11px] tabular-nums text-[#adb5bd]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={`block truncate text-[13px] font-medium ${
                              isUnknown ? "text-[#9a3f00]" : "text-[#212529]"
                            }`}
                          >
                            {row.name}
                          </span>
                          <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-[rgba(33,37,41,0.06)]">
                            <span
                              className="block h-full rounded-full bg-[#e86812]"
                              style={{
                                width: `${Math.min(100, Math.max(pct, 2))}%`,
                              }}
                            />
                          </span>
                        </span>
                        <span className="text-right text-[12px] font-medium tabular-nums text-[#212529]">
                          {formatCount(row.count)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <ViewMoreFooter
            total={more.total}
            expanded={more.expanded}
            onExpand={more.expand}
            onCollapse={more.collapse}
            noun="countries"
          />
        </div>
      </div>
    </section>
  );
}
