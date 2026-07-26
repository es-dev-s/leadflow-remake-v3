/** Map DB country labels → Natural Earth / world-atlas names. */
const ALIASES: Record<string, string> = {
  "united states": "United States of America",
  usa: "United States of America",
  us: "United States of America",
  "u.s.": "United States of America",
  "u.s.a.": "United States of America",
  "united kingdom": "United Kingdom",
  uk: "United Kingdom",
  "great britain": "United Kingdom",
  russia: "Russia",
  "russian federation": "Russia",
  "south korea": "South Korea",
  "north korea": "North Korea",
  "congo - kinshasa": "Dem. Rep. Congo",
  "democratic republic of the congo": "Dem. Rep. Congo",
  "dr congo": "Dem. Rep. Congo",
  "congo - brazzaville": "Congo",
  "republic of the congo": "Congo",
  "côte d’ivoire": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  "cote d’ivoire": "Côte d'Ivoire",
  turkey: "Turkey",
  türkiye: "Turkey",
  "czechia": "Czechia",
  "czech republic": "Czechia",
  "myanmar (burma)": "Myanmar",
  myanmar: "Myanmar",
  "hong kong sar china": "Hong Kong",
  "hong kong": "Hong Kong",
  "macao sar china": "Macao",
  macau: "Macao",
  "palestinian territories": "Palestine",
  palestine: "Palestine",
  "são tomé & príncipe": "São Tomé and Principe",
  "sao tome & principe": "São Tomé and Principe",
  "trinidad & tobago": "Trinidad and Tobago",
  "bosnia & herzegovina": "Bosnia and Herz.",
  "st. lucia": "Saint Lucia",
  "st. vincent & grenadines": "St. Vin. and Gren.",
  "st. kitts & nevis": "St. Kitts and Nevis",
  "st. pierre & miquelon": "St. Pierre and Miquelon",
  "u.s. virgin islands": "U.S. Virgin Is.",
  "british indian ocean territory": "Br. Indian Ocean Ter.",
  "northern mariana islands": "N. Mariana Is.",
  "wallis & futuna": "Wallis and Futuna Is.",
  "sint maarten": "Sint Maarten",
  eswatini: "eSwatini",
  swaziland: "eSwatini",
  "timor-leste": "Timor-Leste",
  "cape verde": "Cabo Verde",
  "united arab emirates": "United Arab Emirates",
  uae: "United Arab Emirates",
  vietnam: "Vietnam",
  laos: "Laos",
  bolivia: "Bolivia",
  venezuela: "Venezuela",
  tanzania: "Tanzania",
  iran: "Iran",
  syria: "Syria",
  moldova: "Moldova",
  brunei: "Brunei",
  taiwan: "Taiwan",
  "south sudan": "S. Sudan",
  "central african republic": "Central African Rep.",
  "equatorial guinea": "Eq. Guinea",
  "dominican republic": "Dominican Rep.",
  "solomon islands": "Solomon Is.",
  "marshall islands": "Marshall Is.",
  "faroe islands": "Faeroe Is.",
  "cayman islands": "Cayman Is.",
  guam: "Guam",
  aruba: "Aruba",
  fiji: "Fiji",
  samoa: "Samoa",
  tonga: "Tonga",
  vanuatu: "Vanuatu",
  kiribati: "Kiribati",
  nauru: "Nauru",
  "ascension island": "Saint Helena",
  "north macedonia": "North Macedonia",
  "gambia": "Gambia",
  "the gambia": "Gambia",
};

export function normalizeCountryKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function toMapCountryName(dbName: string): string | null {
  const raw = dbName.trim();
  if (!raw || normalizeCountryKey(raw) === "unknown") return null;
  const key = normalizeCountryKey(raw);
  return ALIASES[key] ?? raw;
}

export function buildLeadCountryLookup(
  mix: { name: string; count: number }[],
): Map<string, { label: string; count: number }> {
  const map = new Map<string, { label: string; count: number }>();
  for (const item of mix) {
    const mapped = toMapCountryName(item.name);
    if (!mapped) continue;
    const key = normalizeCountryKey(mapped);
    const prev = map.get(key);
    map.set(key, {
      // Keep DB country label so list filters match exactly.
      label: item.name,
      count: (prev?.count ?? 0) + item.count,
    });
  }
  return map;
}
