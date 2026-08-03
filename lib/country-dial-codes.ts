/**
 * Country ↔ dial-code helpers for the lead form.
 * Matching always uses the longest dial prefix so NANP territories
 * (e.g. +1242 Bahamas) win over bare +1.
 */

export type CountryDial = {
  name: string;
  iso2: string;
  /** Digits only, no leading + */
  dial: string;
};

/** Preferred country when several share the same dial (e.g. +1, +7). */
const DIAL_PREFERRED_NAME: Record<string, string> = {
  "1": "United States",
  "7": "Russia",
  "44": "United Kingdom",
  "212": "Morocco",
  "262": "Réunion",
  "290": "Saint Helena",
  "358": "Finland",
  "590": "Guadeloupe",
  "596": "Martinique",
  "599": "Curaçao",
};

export const COUNTRY_DIAL_CODES: CountryDial[] = [
  { name: "Afghanistan", iso2: "AF", dial: "93" },
  { name: "Albania", iso2: "AL", dial: "355" },
  { name: "Algeria", iso2: "DZ", dial: "213" },
  { name: "American Samoa", iso2: "AS", dial: "1684" },
  { name: "Andorra", iso2: "AD", dial: "376" },
  { name: "Angola", iso2: "AO", dial: "244" },
  { name: "Anguilla", iso2: "AI", dial: "1264" },
  { name: "Antigua and Barbuda", iso2: "AG", dial: "1268" },
  { name: "Argentina", iso2: "AR", dial: "54" },
  { name: "Armenia", iso2: "AM", dial: "374" },
  { name: "Aruba", iso2: "AW", dial: "297" },
  { name: "Australia", iso2: "AU", dial: "61" },
  { name: "Austria", iso2: "AT", dial: "43" },
  { name: "Azerbaijan", iso2: "AZ", dial: "994" },
  { name: "Bahamas", iso2: "BS", dial: "1242" },
  { name: "Bahrain", iso2: "BH", dial: "973" },
  { name: "Bangladesh", iso2: "BD", dial: "880" },
  { name: "Barbados", iso2: "BB", dial: "1246" },
  { name: "Belarus", iso2: "BY", dial: "375" },
  { name: "Belgium", iso2: "BE", dial: "32" },
  { name: "Belize", iso2: "BZ", dial: "501" },
  { name: "Benin", iso2: "BJ", dial: "229" },
  { name: "Bermuda", iso2: "BM", dial: "1441" },
  { name: "Bhutan", iso2: "BT", dial: "975" },
  { name: "Bolivia", iso2: "BO", dial: "591" },
  { name: "Bosnia and Herzegovina", iso2: "BA", dial: "387" },
  { name: "Botswana", iso2: "BW", dial: "267" },
  { name: "Brazil", iso2: "BR", dial: "55" },
  { name: "British Virgin Islands", iso2: "VG", dial: "1284" },
  { name: "Brunei", iso2: "BN", dial: "673" },
  { name: "Bulgaria", iso2: "BG", dial: "359" },
  { name: "Burkina Faso", iso2: "BF", dial: "226" },
  { name: "Burundi", iso2: "BI", dial: "257" },
  { name: "Cambodia", iso2: "KH", dial: "855" },
  { name: "Cameroon", iso2: "CM", dial: "237" },
  { name: "Canada", iso2: "CA", dial: "1" },
  { name: "Cape Verde", iso2: "CV", dial: "238" },
  { name: "Cayman Islands", iso2: "KY", dial: "1345" },
  { name: "Central African Republic", iso2: "CF", dial: "236" },
  { name: "Chad", iso2: "TD", dial: "235" },
  { name: "Chile", iso2: "CL", dial: "56" },
  { name: "China", iso2: "CN", dial: "86" },
  { name: "Colombia", iso2: "CO", dial: "57" },
  { name: "Comoros", iso2: "KM", dial: "269" },
  { name: "Congo", iso2: "CG", dial: "242" },
  { name: "Costa Rica", iso2: "CR", dial: "506" },
  { name: "Croatia", iso2: "HR", dial: "385" },
  { name: "Cuba", iso2: "CU", dial: "53" },
  { name: "Curaçao", iso2: "CW", dial: "599" },
  { name: "Cyprus", iso2: "CY", dial: "357" },
  { name: "Czechia", iso2: "CZ", dial: "420" },
  { name: "Denmark", iso2: "DK", dial: "45" },
  { name: "Djibouti", iso2: "DJ", dial: "253" },
  { name: "Dominica", iso2: "DM", dial: "1767" },
  { name: "Dominican Republic", iso2: "DO", dial: "1809" },
  { name: "DR Congo", iso2: "CD", dial: "243" },
  { name: "Ecuador", iso2: "EC", dial: "593" },
  { name: "Egypt", iso2: "EG", dial: "20" },
  { name: "El Salvador", iso2: "SV", dial: "503" },
  { name: "Equatorial Guinea", iso2: "GQ", dial: "240" },
  { name: "Eritrea", iso2: "ER", dial: "291" },
  { name: "Estonia", iso2: "EE", dial: "372" },
  { name: "Eswatini", iso2: "SZ", dial: "268" },
  { name: "Ethiopia", iso2: "ET", dial: "251" },
  { name: "Fiji", iso2: "FJ", dial: "679" },
  { name: "Finland", iso2: "FI", dial: "358" },
  { name: "France", iso2: "FR", dial: "33" },
  { name: "French Guiana", iso2: "GF", dial: "594" },
  { name: "French Polynesia", iso2: "PF", dial: "689" },
  { name: "Gabon", iso2: "GA", dial: "241" },
  { name: "Gambia", iso2: "GM", dial: "220" },
  { name: "Georgia", iso2: "GE", dial: "995" },
  { name: "Germany", iso2: "DE", dial: "49" },
  { name: "Ghana", iso2: "GH", dial: "233" },
  { name: "Gibraltar", iso2: "GI", dial: "350" },
  { name: "Greece", iso2: "GR", dial: "30" },
  { name: "Greenland", iso2: "GL", dial: "299" },
  { name: "Grenada", iso2: "GD", dial: "1473" },
  { name: "Guadeloupe", iso2: "GP", dial: "590" },
  { name: "Guam", iso2: "GU", dial: "1671" },
  { name: "Guatemala", iso2: "GT", dial: "502" },
  { name: "Guernsey", iso2: "GG", dial: "44" },
  { name: "Guinea", iso2: "GN", dial: "224" },
  { name: "Guinea-Bissau", iso2: "GW", dial: "245" },
  { name: "Guyana", iso2: "GY", dial: "592" },
  { name: "Haiti", iso2: "HT", dial: "509" },
  { name: "Honduras", iso2: "HN", dial: "504" },
  { name: "Hong Kong", iso2: "HK", dial: "852" },
  { name: "Hungary", iso2: "HU", dial: "36" },
  { name: "Iceland", iso2: "IS", dial: "354" },
  { name: "India", iso2: "IN", dial: "91" },
  { name: "Indonesia", iso2: "ID", dial: "62" },
  { name: "Iran", iso2: "IR", dial: "98" },
  { name: "Iraq", iso2: "IQ", dial: "964" },
  { name: "Ireland", iso2: "IE", dial: "353" },
  { name: "Isle of Man", iso2: "IM", dial: "44" },
  { name: "Israel", iso2: "IL", dial: "972" },
  { name: "Italy", iso2: "IT", dial: "39" },
  { name: "Ivory Coast", iso2: "CI", dial: "225" },
  { name: "Jamaica", iso2: "JM", dial: "1876" },
  { name: "Japan", iso2: "JP", dial: "81" },
  { name: "Jersey", iso2: "JE", dial: "44" },
  { name: "Jordan", iso2: "JO", dial: "962" },
  { name: "Kazakhstan", iso2: "KZ", dial: "7" },
  { name: "Kenya", iso2: "KE", dial: "254" },
  { name: "Kiribati", iso2: "KI", dial: "686" },
  { name: "Kosovo", iso2: "XK", dial: "383" },
  { name: "Kuwait", iso2: "KW", dial: "965" },
  { name: "Kyrgyzstan", iso2: "KG", dial: "996" },
  { name: "Laos", iso2: "LA", dial: "856" },
  { name: "Latvia", iso2: "LV", dial: "371" },
  { name: "Lebanon", iso2: "LB", dial: "961" },
  { name: "Lesotho", iso2: "LS", dial: "266" },
  { name: "Liberia", iso2: "LR", dial: "231" },
  { name: "Libya", iso2: "LY", dial: "218" },
  { name: "Liechtenstein", iso2: "LI", dial: "423" },
  { name: "Lithuania", iso2: "LT", dial: "370" },
  { name: "Luxembourg", iso2: "LU", dial: "352" },
  { name: "Macao", iso2: "MO", dial: "853" },
  { name: "Madagascar", iso2: "MG", dial: "261" },
  { name: "Malawi", iso2: "MW", dial: "265" },
  { name: "Malaysia", iso2: "MY", dial: "60" },
  { name: "Maldives", iso2: "MV", dial: "960" },
  { name: "Mali", iso2: "ML", dial: "223" },
  { name: "Malta", iso2: "MT", dial: "356" },
  { name: "Marshall Islands", iso2: "MH", dial: "692" },
  { name: "Martinique", iso2: "MQ", dial: "596" },
  { name: "Mauritania", iso2: "MR", dial: "222" },
  { name: "Mauritius", iso2: "MU", dial: "230" },
  { name: "Mexico", iso2: "MX", dial: "52" },
  { name: "Micronesia", iso2: "FM", dial: "691" },
  { name: "Moldova", iso2: "MD", dial: "373" },
  { name: "Monaco", iso2: "MC", dial: "377" },
  { name: "Mongolia", iso2: "MN", dial: "976" },
  { name: "Montenegro", iso2: "ME", dial: "382" },
  { name: "Montserrat", iso2: "MS", dial: "1664" },
  { name: "Morocco", iso2: "MA", dial: "212" },
  { name: "Mozambique", iso2: "MZ", dial: "258" },
  { name: "Myanmar", iso2: "MM", dial: "95" },
  { name: "Namibia", iso2: "NA", dial: "264" },
  { name: "Nauru", iso2: "NR", dial: "674" },
  { name: "Nepal", iso2: "NP", dial: "977" },
  { name: "Netherlands", iso2: "NL", dial: "31" },
  { name: "New Caledonia", iso2: "NC", dial: "687" },
  { name: "New Zealand", iso2: "NZ", dial: "64" },
  { name: "Nicaragua", iso2: "NI", dial: "505" },
  { name: "Niger", iso2: "NE", dial: "227" },
  { name: "Nigeria", iso2: "NG", dial: "234" },
  { name: "North Korea", iso2: "KP", dial: "850" },
  { name: "North Macedonia", iso2: "MK", dial: "389" },
  { name: "Northern Mariana Islands", iso2: "MP", dial: "1670" },
  { name: "Norway", iso2: "NO", dial: "47" },
  { name: "Oman", iso2: "OM", dial: "968" },
  { name: "Pakistan", iso2: "PK", dial: "92" },
  { name: "Palau", iso2: "PW", dial: "680" },
  { name: "Palestine", iso2: "PS", dial: "970" },
  { name: "Panama", iso2: "PA", dial: "507" },
  { name: "Papua New Guinea", iso2: "PG", dial: "675" },
  { name: "Paraguay", iso2: "PY", dial: "595" },
  { name: "Peru", iso2: "PE", dial: "51" },
  { name: "Philippines", iso2: "PH", dial: "63" },
  { name: "Poland", iso2: "PL", dial: "48" },
  { name: "Portugal", iso2: "PT", dial: "351" },
  { name: "Puerto Rico", iso2: "PR", dial: "1787" },
  { name: "Qatar", iso2: "QA", dial: "974" },
  { name: "Réunion", iso2: "RE", dial: "262" },
  { name: "Romania", iso2: "RO", dial: "40" },
  { name: "Russia", iso2: "RU", dial: "7" },
  { name: "Rwanda", iso2: "RW", dial: "250" },
  { name: "Saint Kitts and Nevis", iso2: "KN", dial: "1869" },
  { name: "Saint Lucia", iso2: "LC", dial: "1758" },
  { name: "Saint Vincent and the Grenadines", iso2: "VC", dial: "1784" },
  { name: "Samoa", iso2: "WS", dial: "685" },
  { name: "San Marino", iso2: "SM", dial: "378" },
  { name: "Saudi Arabia", iso2: "SA", dial: "966" },
  { name: "Senegal", iso2: "SN", dial: "221" },
  { name: "Serbia", iso2: "RS", dial: "381" },
  { name: "Seychelles", iso2: "SC", dial: "248" },
  { name: "Sierra Leone", iso2: "SL", dial: "232" },
  { name: "Singapore", iso2: "SG", dial: "65" },
  { name: "Slovakia", iso2: "SK", dial: "421" },
  { name: "Slovenia", iso2: "SI", dial: "386" },
  { name: "Solomon Islands", iso2: "SB", dial: "677" },
  { name: "Somalia", iso2: "SO", dial: "252" },
  { name: "South Africa", iso2: "ZA", dial: "27" },
  { name: "South Korea", iso2: "KR", dial: "82" },
  { name: "South Sudan", iso2: "SS", dial: "211" },
  { name: "Spain", iso2: "ES", dial: "34" },
  { name: "Sri Lanka", iso2: "LK", dial: "94" },
  { name: "Sudan", iso2: "SD", dial: "249" },
  { name: "Suriname", iso2: "SR", dial: "597" },
  { name: "Sweden", iso2: "SE", dial: "46" },
  { name: "Switzerland", iso2: "CH", dial: "41" },
  { name: "Syria", iso2: "SY", dial: "963" },
  { name: "Taiwan", iso2: "TW", dial: "886" },
  { name: "Tajikistan", iso2: "TJ", dial: "992" },
  { name: "Tanzania", iso2: "TZ", dial: "255" },
  { name: "Thailand", iso2: "TH", dial: "66" },
  { name: "Timor-Leste", iso2: "TL", dial: "670" },
  { name: "Togo", iso2: "TG", dial: "228" },
  { name: "Tonga", iso2: "TO", dial: "676" },
  { name: "Trinidad and Tobago", iso2: "TT", dial: "1868" },
  { name: "Tunisia", iso2: "TN", dial: "216" },
  { name: "Turkey", iso2: "TR", dial: "90" },
  { name: "Turkmenistan", iso2: "TM", dial: "993" },
  { name: "Turks and Caicos Islands", iso2: "TC", dial: "1649" },
  { name: "Tuvalu", iso2: "TV", dial: "688" },
  { name: "Uganda", iso2: "UG", dial: "256" },
  { name: "Ukraine", iso2: "UA", dial: "380" },
  { name: "United Arab Emirates", iso2: "AE", dial: "971" },
  { name: "United Kingdom", iso2: "GB", dial: "44" },
  { name: "United States", iso2: "US", dial: "1" },
  { name: "United States Virgin Islands", iso2: "VI", dial: "1340" },
  { name: "Uruguay", iso2: "UY", dial: "598" },
  { name: "Uzbekistan", iso2: "UZ", dial: "998" },
  { name: "Vanuatu", iso2: "VU", dial: "678" },
  { name: "Vatican City", iso2: "VA", dial: "379" },
  { name: "Venezuela", iso2: "VE", dial: "58" },
  { name: "Vietnam", iso2: "VN", dial: "84" },
  { name: "Yemen", iso2: "YE", dial: "967" },
  { name: "Zambia", iso2: "ZM", dial: "260" },
  { name: "Zimbabwe", iso2: "ZW", dial: "263" },
];

const BY_NAME = new Map(
  COUNTRY_DIAL_CODES.map((c) => [c.name.toLowerCase(), c]),
);

/** Longest dial first for unambiguous prefix matching. */
const BY_DIAL_LENGTH = [...COUNTRY_DIAL_CODES].sort(
  (a, b) => b.dial.length - a.dial.length || a.name.localeCompare(b.name),
);

const DIAL_GROUPS = (() => {
  const map = new Map<string, CountryDial[]>();
  for (const c of COUNTRY_DIAL_CODES) {
    const list = map.get(c.dial) ?? [];
    list.push(c);
    map.set(c.dial, list);
  }
  return map;
})();

export function flagEmoji(iso2: string): string {
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code].map((ch) => 127397 + ch.charCodeAt(0)),
  );
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united states of america": "United States",
  america: "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "great britain": "United Kingdom",
  britain: "United Kingdom",
  england: "United Kingdom",
  uae: "United Arab Emirates",
  emirates: "United Arab Emirates",
  russia: "Russia",
  "russian federation": "Russia",
  "south korea": "South Korea",
  "korea, south": "South Korea",
  "north korea": "North Korea",
  "korea, north": "North Korea",
  vietnam: "Vietnam",
  "viet nam": "Vietnam",
  iran: "Iran",
  syria: "Syria",
  moldova: "Moldova",
  bolivia: "Bolivia",
  venezuela: "Venezuela",
  tanzania: "Tanzania",
  czechia: "Czechia",
  "czech republic": "Czechia",
  turkey: "Turkey",
  türkiye: "Turkey",
  "cote d'ivoire": "Ivory Coast",
  "côte d'ivoire": "Ivory Coast",
  "ivory coast": "Ivory Coast",
  "hong kong sar": "Hong Kong",
  "hong kong sar china": "Hong Kong",
  macau: "Macao",
  "dr congo": "DR Congo",
  "democratic republic of the congo": "DR Congo",
  "congo-kinshasa": "DR Congo",
  "republic of the congo": "Congo",
  "congo-brazzaville": "Congo",
  brunei: "Brunei",
  laos: "Laos",
  myanmar: "Myanmar",
  burma: "Myanmar",
  swaziland: "Eswatini",
  "timor leste": "Timor-Leste",
  "east timor": "Timor-Leste",
  "cape verde": "Cape Verde",
  palestine: "Palestine",
  "palestinian territories": "Palestine",
};

const BY_ISO2 = new Map(
  COUNTRY_DIAL_CODES.map((c) => [c.iso2.toLowerCase(), c]),
);

function stripIntlExitPrefix(digits: string): string {
  if (digits.startsWith("00") && digits.length > 2) return digits.slice(2);
  // North American international exit code.
  if (digits.startsWith("011") && digits.length > 3) return digits.slice(3);
  return digits;
}

function stripTrunkZeroAfterDial(digits: string, dial: string): string {
  if (!digits.startsWith(dial)) return digits;
  const rest = digits.slice(dial.length);
  if (rest.startsWith("0") && rest.length > 1) {
    return dial + rest.replace(/^0+/, "");
  }
  return digits;
}

/** National number length that makes a dial-prefix match look real. */
function isPlausibleNationalRest(dial: string, restLen: number): boolean {
  if (restLen < 4) return false;
  if (dial === "1") return restLen >= 10; // NANP
  if (dial.length >= 3) return restLen >= 5;
  return restLen >= 6;
}

/**
 * Insert a single space between a recognized country dial code and the
 * national number: "+977 9812345678". Keeps a trailing space once the dial
 * is known so typing the local digits feels natural.
 */
export function formatPhoneWithDialSpace(
  phone: string,
  countryHint = "",
): string {
  let digits = phoneDigits(phone);
  if (!digits) return "+";
  digits = stripIntlExitPrefix(digits);

  const matched =
    matchCountryFromPhone(`+${digits}`, countryHint) ??
    findCountryByName(countryHint);

  if (matched && digits.startsWith(matched.dial)) {
    const rest = digits.slice(matched.dial.length);
    return rest ? `+${matched.dial} ${rest}` : `+${matched.dial} `;
  }

  return `+${digits}`;
}

/**
 * Live typing / paste normalization.
 * Always keeps a leading +, converts 00… / 011… exit prefixes, and
 * inserts a space after the country dial code when recognized.
 */
export function normalizePhoneInput(raw: string, countryHint = ""): string {
  const trimmed = raw.trim();
  if (!trimmed) return "+";

  const hadPlus = trimmed.includes("+");
  let digits = phoneDigits(trimmed);
  if (!digits) return "+";

  if (!hadPlus) {
    digits = stripIntlExitPrefix(digits);
  } else if (digits.startsWith("00")) {
    digits = stripIntlExitPrefix(digits);
  }

  return formatPhoneWithDialSpace(`+${digits}`, countryHint);
}

/**
 * Stronger cleanup for stored / pasted legacy numbers.
 * Handles: missing +, 00/011 prefixes, dial+trunk-0, and local numbers
 * when a country hint is available.
 */
export function normalizeStoredPhone(
  raw: string | null | undefined,
  countryHint = "",
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "+";

  const hadPlus = /(?:^\+|00|011)/.test(trimmed.replace(/\s/g, ""));
  let digits = phoneDigits(trimmed);
  if (!digits) return "+";

  digits = stripIntlExitPrefix(digits);

  const hinted = findCountryByName(countryHint);

  // Already looks international (explicit marker or long dial prefix).
  const matched = matchDialFromDigits(digits, countryHint, {
    requirePlausible: !hadPlus,
  });
  if (matched) {
    digits = stripTrunkZeroAfterDial(digits, matched.dial);
    return formatPhoneWithDialSpace(`+${digits}`, countryHint);
  }

  // Local / national number with a known country on the lead.
  if (hinted) {
    let national = digits;
    if (national.startsWith("0")) national = national.replace(/^0+/, "");
    if (national.startsWith(hinted.dial)) {
      digits = stripTrunkZeroAfterDial(national, hinted.dial);
      return formatPhoneWithDialSpace(`+${digits}`, countryHint);
    }
    return formatPhoneWithDialSpace(`+${hinted.dial}${national}`, countryHint);
  }

  return formatPhoneWithDialSpace(`+${digits}`, countryHint);
}

export function ensurePhonePrefix(
  value: string | null | undefined,
  countryHint = "",
): string {
  return normalizeStoredPhone(value, countryHint);
}

export function findCountryByName(name: string): CountryDial | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const aliased = COUNTRY_ALIASES[key];
  if (aliased) return BY_NAME.get(aliased.toLowerCase()) ?? null;
  const direct = BY_NAME.get(key);
  if (direct) return direct;
  return BY_ISO2.get(key) ?? null;
}

type MatchOpts = {
  requirePlausible?: boolean;
};

function matchDialFromDigits(
  digits: string,
  currentCountry = "",
  opts: MatchOpts = {},
): CountryDial | null {
  if (!digits) return null;
  const requirePlausible = opts.requirePlausible ?? false;

  for (const candidate of BY_DIAL_LENGTH) {
    if (!digits.startsWith(candidate.dial)) continue;
    const restLen = digits.length - candidate.dial.length;
    if (requirePlausible && !isPlausibleNationalRest(candidate.dial, restLen)) {
      continue;
    }

    const group = DIAL_GROUPS.get(candidate.dial) ?? [candidate];
    if (group.length === 1) return group[0]!;

    const current = findCountryByName(currentCountry);
    if (current && group.some((g) => g.name === current.name)) {
      return current;
    }
    const preferredName = DIAL_PREFERRED_NAME[candidate.dial];
    if (preferredName) {
      const preferred = group.find((g) => g.name === preferredName);
      if (preferred) return preferred;
    }
    return group[0]!;
  }
  return null;
}

/**
 * Resolve country from phone digits using longest dial match.
 * If several countries share the dial, keep `currentCountry` when it
 * still matches; otherwise use the preferred name for that dial.
 */
export function matchCountryFromPhone(
  phone: string,
  currentCountry = "",
): CountryDial | null {
  let digits = phoneDigits(phone);
  if (!digits) return null;
  digits = stripIntlExitPrefix(digits);

  // Prefer an exact country hint when its dial already prefixes the number
  // (covers old local numbers after we prepended the dial).
  const hinted = findCountryByName(currentCountry);
  if (hinted && digits.startsWith(hinted.dial)) {
    const restLen = digits.length - hinted.dial.length;
    if (isPlausibleNationalRest(hinted.dial, restLen) || restLen >= 4) {
      return hinted;
    }
  }

  return matchDialFromDigits(digits, currentCountry, {
    requirePlausible: false,
  });
}

/** Replace or insert dial code when the user picks a country. */
export function applyCountryToPhone(
  phone: string,
  countryName: string,
): string {
  const country = findCountryByName(countryName);
  if (!country) return ensurePhonePrefix(phone, countryName);

  let digits = phoneDigits(normalizeStoredPhone(phone, countryName));
  digits = stripIntlExitPrefix(digits);

  const matched = matchDialFromDigits(digits, countryName, {
    requirePlausible: false,
  });
  if (matched) {
    let rest = digits.slice(matched.dial.length).replace(/^0+/, "");
    return formatPhoneWithDialSpace(`+${country.dial}${rest}`, countryName);
  }

  let national = digits.replace(/^0+/, "");
  if (!national) return formatPhoneWithDialSpace(`+${country.dial}`, countryName);
  if (national.startsWith(country.dial)) {
    national = national.slice(country.dial.length).replace(/^0+/, "");
  }
  return formatPhoneWithDialSpace(`+${country.dial}${national}`, countryName);
}

export function countrySelectOptions(): { value: string; label: string }[] {
  return [...COUNTRY_DIAL_CODES]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      value: c.name,
      label: `${flagEmoji(c.iso2)}  ${c.name}  ·  +${c.dial}`,
    }));
}

export function isMeaningfulPhone(phone: string): boolean {
  const digits = phoneDigits(phone);
  return digits.length >= 5;
}

/** True when dial code is known and national digits look complete enough to look up. */
export function isCompletePhoneNumber(
  phone: string,
  countryHint = "",
): boolean {
  if (!isMeaningfulPhone(phone)) return false;
  let digits = phoneDigits(phone);
  digits = stripIntlExitPrefix(digits);
  const matched = matchCountryFromPhone(`+${digits}`, countryHint);
  if (!matched || !digits.startsWith(matched.dial)) return false;
  const restLen = digits.length - matched.dial.length;
  return isPlausibleNationalRest(matched.dial, restLen);
}
