/**
 * Uruguay department detector.
 *
 * Given venue name, venue address, city field from scraper, and event name,
 * returns the canonical department name (e.g. "Maldonado", "Canelones", etc.)
 * or "Montevideo" as the default.
 *
 * Uruguay has 19 departments. We map cities/towns/keywords to their department.
 * The `city` field stored in the DB is the DEPARTMENT name (not the city),
 * so filters work at department level.
 */

export type UruguayDepartment =
  | "Montevideo"
  | "Canelones"
  | "Maldonado"
  | "Colonia"
  | "San José"
  | "Soriano"
  | "Río Negro"
  | "Paysandú"
  | "Salto"
  | "Artigas"
  | "Rivera"
  | "Tacuarembó"
  | "Cerro Largo"
  | "Treinta y Tres"
  | "Durazno"
  | "Florida"
  | "Flores"
  | "Lavalleja"
  | "Rocha";

/**
 * Each entry maps a set of lowercase/accent-stripped keywords to a department.
 * Keywords are matched as substrings against the combined text of:
 *   venue name + venue address + scraper city field + event name
 *
 * Order matters: more specific entries should come first.
 */
const DEPARTMENT_RULES: Array<{ keywords: string[]; department: UruguayDepartment }> = [
  // ── Maldonado ──────────────────────────────────────────────────────────────
  {
    keywords: [
      "punta del este",
      "punta shopping",
      "jose ignacio",
      "josé ignacio",
      "la barra",
      "manantiales",
      "maldonado",
      "piriapolis",
      "piriápolis",
      "pan de azucar",
      "pan de azúcar",
      "aiguá",
      "aigua",
      "garzón",
      "garzon",
      "solanas",
      "parador 31",
      "costero beach club",
      "isla de lobos",
      "isla gorriti",
      "torre punta del este",
      "puerto punta del este",
      "puerto, punta del este",
      "rambla mansa",
      "rambla brava",
      "playa brava",
      "playa mansa",
      "san carlos",          // San Carlos, Maldonado
      "balneario buenos aires",
      "balneario buenos aires, maldonado",
    ],
    department: "Maldonado",
  },

  // ── Canelones ──────────────────────────────────────────────────────────────
  {
    keywords: [
      "canelones",
      "atlantida",
      "atlántida",
      "la paz",
      "las piedras",
      "progreso",
      "pando",
      "ciudad de la costa",
      "solymar",
      "el pinar",
      "salinas",
      "santa lucia",
      "santa lucía",
      "tala",
      "sauce",
      "migues",
      "parque del plata",
      "cam. de los horneros",
      "camino de los horneros",
      "camino mainumby",
      "jardín cervecero",
      "jardin cervecero",
    ],
    department: "Canelones",
  },

  // ── Colonia ────────────────────────────────────────────────────────────────
  {
    keywords: [
      "colonia del sacramento",
      "colonia del sacrament",
      "carmelo",
      "nueva helvecia",
      "nueva palmira",
      "rosario",
      "juan lacaze",
      "colonia",
      "plaza de toros real de san carlos",
      "real de san carlos",
      "av. rodó esq. tabaré, 70100",  // Carmelo address pattern
    ],
    department: "Colonia",
  },

  // ── San José ───────────────────────────────────────────────────────────────
  {
    keywords: [
      "san jose de mayo",
      "san josé de mayo",
      "ciudad del plata",
      "libertad",
      "genoves beer",
      "genovés beer",
    ],
    department: "San José",
  },

  // ── Soriano ────────────────────────────────────────────────────────────────
  {
    keywords: [
      "mercedes",
      "dolores",
      "cardona",
      "soriano",
    ],
    department: "Soriano",
  },

  // ── Río Negro ──────────────────────────────────────────────────────────────
  {
    keywords: [
      "fray bentos",
      "young",
      "rio negro",
      "río negro",
    ],
    department: "Río Negro",
  },

  // ── Paysandú ───────────────────────────────────────────────────────────────
  {
    keywords: [
      "paysandu",
      "paysandú",
      "guichon",
      "guichón",
    ],
    department: "Paysandú",
  },

  // ── Salto ──────────────────────────────────────────────────────────────────
  {
    keywords: [
      "salto",
      "costanera norte",   // Salto's costanera
      "termas del dayman",
      "termas de arapey",
      "5000 salto",
      "costanera nte., 5000",
    ],
    department: "Salto",
  },

  // ── Artigas ────────────────────────────────────────────────────────────────
  // NOTE: "artigas" alone is too generic (it's a common street name in Montevideo).
  // We require more specific patterns: city name with context, or known venues.
  {
    keywords: [
      "bella union",
      "bella unión",
      "carnaval de artigas",
      "ciudad de artigas",
      "departamento de artigas",
      "dep. artigas",
      "artigas, uruguay",
      // Postal code prefix for Artigas city
      "55000",
    ],
    department: "Artigas",
  },

  // ── Rivera ─────────────────────────────────────────────────────────────────
  {
    keywords: [
      "rivera",
      "tranqueras",
    ],
    department: "Rivera",
  },

  // ── Tacuarembó ─────────────────────────────────────────────────────────────
  {
    keywords: [
      "tacuarembo",
      "tacuarembó",
      "paso de los toros",
    ],
    department: "Tacuarembó",
  },

  // ── Cerro Largo ────────────────────────────────────────────────────────────
  {
    keywords: [
      "melo",
      "cerro largo",
      "rio branco",
      "río branco",
    ],
    department: "Cerro Largo",
  },

  // ── Treinta y Tres ─────────────────────────────────────────────────────────
  {
    keywords: [
      "treinta y tres",
      "vergara",
    ],
    department: "Treinta y Tres",
  },

  // ── Durazno ────────────────────────────────────────────────────────────────
  {
    keywords: [
      "durazno",
      "villa del carmen",
      "sarand",
    ],
    department: "Durazno",
  },

  // ── Florida ────────────────────────────────────────────────────────────────
  {
    keywords: [
      "florida shopping",
      "centro de aviacion civil de florida",
      "aviación civil florida",
      "aviacion civil florida",
      "alberto heber usher",   // Florida address
      "florida, dep",
      ", florida",
    ],
    department: "Florida",
  },

  // ── Flores ─────────────────────────────────────────────────────────────────
  {
    keywords: [
      "trinidad",
      "flores",
    ],
    department: "Flores",
  },

  // ── Lavalleja ──────────────────────────────────────────────────────────────
  {
    keywords: [
      "minas",
      "lavalleja",
      "aguas blancas",
      "camping aguas blancas",
      "valle de los vientos",
      "dtectival",
      "la peña blanca",
      "castillo de cesar batlle",
    ],
    department: "Lavalleja",
  },

  // ── Rocha ──────────────────────────────────────────────────────────────────
  {
    keywords: [
      "la paloma",
      "rocha",
      "chuy",
      "la pedrera",
      "punta del diablo",
      "cabo polonio",
      "aguas dulces",
      "valizas",
      "puerto de la paloma",
    ],
    department: "Rocha",
  },
];

/**
 * Normalize a string for matching: lowercase + strip accents + collapse spaces.
 */
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect the Uruguay department from event location data.
 *
 * @param venueName  - Venue name from scraper
 * @param venueAddress - Venue address from scraper
 * @param scraperCity - City/location string from scraper (e.g. CobraTicket's city field)
 * @param eventName  - Event title (sometimes contains location like "Carnaval Salto")
 * @returns Canonical department name, defaults to "Montevideo"
 */
export function detectDepartment(
  venueName: string | null,
  venueAddress: string | null,
  scraperCity: string | null,
  eventName: string | null,
): UruguayDepartment {
  // Build combined search text — prioritize address and city over name
  // (event names can have false positives like "Colonia de vacaciones")
  const parts = [
    scraperCity,
    venueAddress,
    venueName,
  ].filter(Boolean) as string[];

  const combinedPrimary = normalizeForMatch(parts.join(" "));

  // Also check event name but with lower priority (only if primary has no match)
  const combinedWithName = normalizeForMatch([...parts, eventName ?? ""].join(" "));

  // Check primary text first (venue + address + scraperCity)
  for (const rule of DEPARTMENT_RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = normalizeForMatch(keyword);
      if (combinedPrimary.includes(normalizedKeyword)) {
        return rule.department;
      }
    }
  }

  // Check with event name as fallback (more prone to false positives)
  for (const rule of DEPARTMENT_RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = normalizeForMatch(keyword);
      if (combinedWithName.includes(normalizedKeyword)) {
        return rule.department;
      }
    }
  }

  return "Montevideo";
}

/**
 * Normalize a department name from a scraper's raw city string.
 * CobraTicket returns strings like "Punta del Este, Maldonado" or "Carmelo, Dep. Colonia".
 * This extracts the canonical department name.
 */
export function normalizeDepartmentFromCity(rawCity: string | null): UruguayDepartment | null {
  if (!rawCity || !rawCity.trim()) return null;

  const normalized = normalizeForMatch(rawCity);

  // Check each department rule
  for (const rule of DEPARTMENT_RULES) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(normalizeForMatch(keyword))) {
        return rule.department;
      }
    }
  }

  // Direct department name match
  const DEPT_NAMES: UruguayDepartment[] = [
    "Montevideo", "Canelones", "Maldonado", "Colonia", "San José",
    "Soriano", "Río Negro", "Paysandú", "Salto", "Artigas", "Rivera",
    "Tacuarembó", "Cerro Largo", "Treinta y Tres", "Durazno", "Florida",
    "Flores", "Lavalleja", "Rocha",
  ];

  for (const dept of DEPT_NAMES) {
    if (normalized.includes(normalizeForMatch(dept))) {
      return dept;
    }
  }

  return null;
}
