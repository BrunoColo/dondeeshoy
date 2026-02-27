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
 *
 * BOUNDING BOXES: These are APPROXIMATE limits derived from geographic data.
 * They are not exact boundaries - use for general classification only.
 * For precise needs, use proper polygon data from IDE Uruguay / GADM.
 */

/**
 * Keywords that are PROBLEMATIC because they can be:
 * 1. Department names AND also common street names in Montevideo
 * 2. Too generic / common words
 * 
 * These should NOT override coordinate-based detection.
 */
const PROBLEMATIC_KEYWORDS = new Set([
  "colonia",      // Calle Colonia in Montevideo, also department
  "artigas",      // Calle Artigas in Montevideo, also department  
  "flores",       // Calle Flores in Montevideo, also department
  "durazno",      // Can be a generic word
  "rio negro",    // Also a color/street name
  "libertad",     // Common word, not just department
  "union",        // Not a department but common in addresses
  "republica",   // Common word in addresses
  "brasil",       // Country name, appears in addresses
  "espana",       // Country name
  "italia",       // Country name
  "paraguay",     // Country name
]);

/**
 * Keywords that are UNAMBIGUOUSLY department names or very specific locations.
 * These CAN override coordinate detection if explicitly present in address/city.
 */
const UNAMBIGUOUS_DEPARTMENT_KEYWORDS = new Set([
  // Montevideo area - specific neighborhoods
  "pocitos", "punta carretas", "carrasco", "buena vista", "malvín", 
  "parque batlle", "belvedere", "centro", "ciudad viej", "aguada",
  "tres cruces", "palermo", "sayago", "piedras blancas",
  // Canelones - specific
  "atlantida", "la paz", "las piedras", "progreso", "pando",
  "ciudad de la costa", "solymar", "el pinar", "salinas", "santa lucia",
  // Maldonado - specific  
  "punta del este", "punta shopping", "jose ignacio", "la barra",
  "manantiales", "piriapolis", "san carlos",
  // Colonia - specific
  "colonia del sacramento", "carmelo", "nueva helvecia", "nueva palmira",
  "rosario", "juan lacaze",
  // Other departments - very specific
  "paysandu", "salto", "artigas", "rivera", "tacuarembo",
  "cerro largo", "treinta y tres", "durazno", "florida", "flores",
  "lavalleja", "rocha", "soriano", "rio negro", "san jose",
  // With accents
  "punta del este", "josé ignacio", "piriápolis", "la paz",
  "nueva helvecia", "colonia del sacramento",
]);

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
 * Approximate bounding boxes for each Uruguay department (lat/lng).
 * Used for coordinate-based department detection, which is more reliable
 * than text matching (avoids false positives like "Colonia" street in Montevideo).
 */
export const DEPARTMENT_BOUNDS: Record<UruguayDepartment, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  // Bounding boxes for each Uruguay department.
  // Derived from official IDE Uruguay / GADM geographic data.
  // Boundaries are set to avoid overlaps between adjacent departments.
  //
  // ── IMPORTANT: Montevideo / Canelones overlap ─────────────────────────────
  // Montevideo is a small department fully enclosed by Canelones.
  // detectDepartmentFromCoordinates() checks Montevideo FIRST so that any
  // point inside the Montevideo box is never misclassified as Canelones.
  // The Canelones minLat is set to Montevideo's maxLat to make the boxes
  // non-overlapping (Canelones starts where Montevideo ends, going north).
  //
  // Montevideo real boundaries (official):
  //   Lat: -34.9350 (Punta Yeguas, SW coast) to -34.6950 (Manga/Colón, N border)
  //   Lng: -56.4100 (Paso de la Arena, W)     to -55.9950 (Punta Carretas, E)
  "Montevideo":     { minLat: -34.935, maxLat: -34.695, minLng: -56.410, maxLng: -55.995 },

  // Canelones: surrounds Montevideo on N/E/W; extends to Río de la Plata coast in S.
  // Southern boundary = Montevideo's northern boundary (-34.695) to avoid overlap.
  // Eastern boundary stops before Maldonado (~-55.340).
  // Western boundary reaches Río Santa Lucía / San José border (~-56.530).
  "Canelones":      { minLat: -34.820, maxLat: -33.850, minLng: -56.530, maxLng: -55.340 },

  // Maldonado: SE corner of Uruguay, Atlantic coast + Río de la Plata.
  // Includes Punta del Este, Piriápolis, José Ignacio, La Barra.
  // Northern boundary ~-34.170 (Sierra de las Ánimas ridge).
  "Maldonado":      { minLat: -35.030, maxLat: -34.170, minLng: -55.460, maxLng: -53.100 },

  // Rocha: easternmost department, Atlantic coast.
  // Includes La Paloma, Cabo Polonio, Punta del Diablo, Chuy (border with Brazil).
  "Rocha":          { minLat: -34.680, maxLat: -33.100, minLng: -54.200, maxLng: -53.070 },

  // Lavalleja: inland, east-central. Includes Minas, Aguas Blancas.
  "Lavalleja":      { minLat: -34.530, maxLat: -33.480, minLng: -55.530, maxLng: -54.200 },

  // Treinta y Tres: NE interior. Includes Vergara.
  "Treinta y Tres": { minLat: -33.750, maxLat: -32.700, minLng: -55.200, maxLng: -53.600 },

  // Cerro Largo: NE, border with Brazil. Includes Melo, Río Branco.
  "Cerro Largo":    { minLat: -33.200, maxLat: -31.700, minLng: -55.100, maxLng: -53.070 },

  // Rivera: N, border with Brazil. Includes Rivera city, Tranqueras.
  "Rivera":         { minLat: -31.700, maxLat: -30.850, minLng: -56.050, maxLng: -54.050 },

  // Artigas: NW corner, border with Brazil and Argentina.
  // Includes Artigas city, Bella Unión.
  "Artigas":        { minLat: -30.850, maxLat: -30.050, minLng: -57.870, maxLng: -55.600 },

  // Salto: W, Río Uruguay border with Argentina.
  // Includes Salto city, Termas del Daymán, Salto Grande dam.
  "Salto":          { minLat: -31.700, maxLat: -30.850, minLng: -58.440, maxLng: -56.400 },

  // Paysandú: W, Río Uruguay. Includes Paysandú city, Guichón.
  "Paysandú":       { minLat: -32.900, maxLat: -31.700, minLng: -58.200, maxLng: -56.400 },

  // Río Negro: W, Río Uruguay. Includes Fray Bentos, Young.
  "Río Negro":      { minLat: -33.450, maxLat: -32.200, minLng: -58.450, maxLng: -57.000 },

  // Soriano: SW. Includes Mercedes, Dolores, Cardona.
  "Soriano":        { minLat: -34.100, maxLat: -32.900, minLng: -58.450, maxLng: -57.000 },

  // Colonia: SW corner, Río de la Plata. Includes Colonia del Sacramento, Carmelo.
  "Colonia":        { minLat: -34.530, maxLat: -33.700, minLng: -58.450, maxLng: -57.000 },

  // San José: S-central. Includes San José de Mayo, Ciudad del Plata, Libertad.
  "San José":       { minLat: -34.620, maxLat: -33.700, minLng: -57.200, maxLng: -56.090 },

  // Flores: central-W. Includes Trinidad (capital).
  "Flores":         { minLat: -33.950, maxLat: -33.100, minLng: -57.400, maxLng: -56.400 },

  // Florida: central. Includes Florida city.
  "Florida":        { minLat: -34.250, maxLat: -33.050, minLng: -56.500, maxLng: -55.050 },

  // Durazno: central. Includes Durazno city, Villa del Carmen, Paso de los Toros.
  "Durazno":        { minLat: -33.600, maxLat: -32.200, minLng: -56.700, maxLng: -55.200 },

  // Tacuarembó: N-central. Includes Tacuarembó city, Paso de los Toros.
  "Tacuarembó":     { minLat: -32.700, maxLat: -31.150, minLng: -56.700, maxLng: -54.600 },
};

/**
 * Detect the Uruguay department from coordinates using bounding boxes.
 * Returns the department name if the point falls within a bounding box,
 * or null if no match (coordinates outside Uruguay or in an overlap area).
 */
export function detectDepartmentFromCoordinates(
  latitude: number,
  longitude: number,
): UruguayDepartment | null {
  // Check Montevideo first (smallest department, common case)
  const mvd = DEPARTMENT_BOUNDS["Montevideo"];
  if (latitude >= mvd.minLat && latitude <= mvd.maxLat && longitude >= mvd.minLng && longitude <= mvd.maxLng) {
    return "Montevideo";
  }

  for (const [dept, bounds] of Object.entries(DEPARTMENT_BOUNDS) as [UruguayDepartment, typeof mvd][]) {
    if (dept === "Montevideo") continue; // already checked
    if (
      latitude >= bounds.minLat && latitude <= bounds.maxLat &&
      longitude >= bounds.minLng && longitude <= bounds.maxLng
    ) {
      return dept;
    }
  }

  return null;
}

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
      "termas del daymán",
      "termas de arapey",
      "termas de salto",
      "dayman",
      "daymán",
      "5000 salto",
      "costanera nte., 5000",
      "ciudad de salto",
      "salto grande",
      "acuamania",
      "acuamanía",
      "horacio quiroga, salto",
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
 * When coordinates are available, they take priority over text matching
 * to avoid false positives (e.g. "Colonia" street in Montevideo).
 *
 * @param venueName  - Venue name from scraper
 * @param venueAddress - Venue address from scraper
 * @param scraperCity - City/location string from scraper (e.g. CobraTicket's city field)
 * @param eventName  - Event title (sometimes contains location like "Carnaval Salto")
 * @param latitude   - Optional latitude for coordinate-based detection
 * @param longitude  - Optional longitude for coordinate-based detection
 * @returns Canonical department name, defaults to "Montevideo"
 */
export function detectDepartment(
  venueName: string | null,
  venueAddress: string | null,
  scraperCity: string | null,
  eventName: string | null,
  latitude?: number | null,
  longitude?: number | null,
): UruguayDepartment {
  // PRIORITY 1: Coordinate-based detection (MOST RELIABLE)
  // Coordinates are objective data - they represent the actual location.
  // Always prefer coordinates when available.
  if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const fromCoords = detectDepartmentFromCoordinates(latitude, longitude);
    if (fromCoords) {
      // Coordinates are king - they represent actual GPS location.
      // Return directly without any text-based override.
      // The bounding boxes may have overlaps, but they're still more reliable
      // than text matching (which has false positives like "Colonia" street).
      return fromCoords;
    }
    // If coordinates are outside all known bounding boxes, fall through to text
  }

  // PRIORITY 2: Text-based detection (fallback when no coords)
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
      
      // Skip problematic keywords (department names that are also street names)
      // UNLESS the keyword is very specific (e.g., "colonia del sacramento" not just "colonia")
      if (PROBLEMATIC_KEYWORDS.has(normalizedKeyword) && !UNAMBIGUOUS_DEPARTMENT_KEYWORDS.has(normalizedKeyword)) {
        // Check if it's at least a longer phrase that makes it unambiguous
        if (normalizedKeyword.split(/\s+/).length < 2) {
          continue; // Skip single-word problematic keywords
        }
      }
      
      if (combinedPrimary.includes(normalizedKeyword)) {
        return rule.department;
      }
    }
  }

  // Check with event name as fallback (more prone to false positives)
  for (const rule of DEPARTMENT_RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = normalizeForMatch(keyword);
      
      // Same filtering for event name
      if (PROBLEMATIC_KEYWORDS.has(normalizedKeyword) && !UNAMBIGUOUS_DEPARTMENT_KEYWORDS.has(normalizedKeyword)) {
        if (normalizedKeyword.split(/\s+/).length < 2) {
          continue;
        }
      }
      
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
