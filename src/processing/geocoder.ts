import type { NormalizedEventInput } from "./normalizer";
import { findVenueCoordinates } from "@/lib/venue-registry";

export interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  source: "scraper" | "lookup" | "mapbox" | "none";
}

type KnownVenue = {
  keys: string[];
  latitude: number;
  longitude: number;
};

/**
 * Expanded known venue database for Uruguay.
 * Keys are lowercase, accent-stripped substrings to match against venue name + address.
 */
const KNOWN_VENUES: KnownVenue[] = [
  // ── Montevideo ──────────────────────────────────────────
  { keys: ["antel arena"], latitude: -34.8944, longitude: -56.1328 },
  { keys: ["teatro solis", "teatro solís"], latitude: -34.9077, longitude: -56.2006 },
  { keys: ["sodre", "auditorio nacional", "auditorio adela reta"], latitude: -34.9059, longitude: -56.1893 },
  { keys: ["cloud 7", "cloud7"], latitude: -34.9016, longitude: -56.1788 },
  { keys: ["sala del museo"], latitude: -34.9054, longitude: -56.2081 },
  { keys: ["radisson montevideo", "radisson victoria plaza", "victoria plaza hotel"], latitude: -34.9065, longitude: -56.1935 },
  { keys: ["plaza mateo"], latitude: -34.8823, longitude: -56.1677 },
  { keys: ["lotus, wtc", "lotus club", "lotus wtc", "world trade center montevideo"], latitude: -34.9042, longitude: -56.1358 },
  { keys: ["parque roosevelt", "parque franklin roosevelt"], latitude: -34.8763, longitude: -56.0494 },
  { keys: ["plaza italia shopping"], latitude: -34.8846, longitude: -56.2155 },
  { keys: ["mvd shopping"], latitude: -34.8750, longitude: -56.1417 },
  { keys: ["punta carretas shopping"], latitude: -34.9278, longitude: -56.1578 },
  { keys: ["tres cruces"], latitude: -34.8933, longitude: -56.1703 },
  { keys: ["montevideo shopping"], latitude: -34.8804, longitude: -56.1359 },
  { keys: ["portones shopping"], latitude: -34.8648, longitude: -56.0856 },
  { keys: ["nuevocentro shopping", "nuevo centro"], latitude: -34.8721, longitude: -56.1973 },
  { keys: ["fun fun"], latitude: -34.9078, longitude: -56.1994 },
  { keys: ["sala zitarrosa"], latitude: -34.9060, longitude: -56.1993 },
  { keys: ["bluzz live"], latitude: -34.9044, longitude: -56.1894 },
  { keys: ["la trastienda"], latitude: -34.9053, longitude: -56.1923 },
  { keys: ["sala lazaroff"], latitude: -34.8997, longitude: -56.1716 },
  { keys: ["museo del carnaval"], latitude: -34.9068, longitude: -56.2117 },
  { keys: ["teatro de verano"], latitude: -34.9204, longitude: -56.1617 },
  { keys: ["estadio centenario"], latitude: -34.8946, longitude: -56.1527 },
  { keys: ["palacio peñarol"], latitude: -34.8734, longitude: -56.1925 },
  { keys: ["velódromo", "velodromo"], latitude: -34.8941, longitude: -56.1463 },
  { keys: ["aero club del uruguay", "aero club"], latitude: -34.8442, longitude: -56.0311 },
  { keys: ["mapi", "museo de arte precolombino"], latitude: -34.9067, longitude: -56.1993 },
  { keys: ["museo oceanografico", "museo oceanográfico"], latitude: -34.9272, longitude: -56.1586 },
  { keys: ["atlantico shopping", "atlántico shopping"], latitude: -34.9240, longitude: -56.1552 },
  { keys: ["car one center"], latitude: -34.8880, longitude: -56.1760 },
  { keys: ["el muelle paintball"], latitude: -34.8600, longitude: -56.0500 },
  { keys: ["futvolt"], latitude: -34.8700, longitude: -56.1400 },
  { keys: ["ludus tactical"], latitude: -34.8700, longitude: -56.1200 },
  { keys: ["polo 33 paintball"], latitude: -34.8550, longitude: -56.0700 },
  { keys: ["tabare", "tabaré"], latitude: -34.9050, longitude: -56.2000 },
  { keys: ["jardin de eventos", "camino conde"], latitude: -34.8400, longitude: -56.1500 },
  { keys: ["museo el juguetero"], latitude: -34.9100, longitude: -56.1900 },
  { keys: ["la martina"], latitude: -34.8900, longitude: -56.1700 },
  { keys: ["magma futura"], latitude: -34.9058, longitude: -56.1882 },
  { keys: ["espacio odeón", "espacio odeon"], latitude: -34.9060, longitude: -56.1950 },
  { keys: ["papacho"], latitude: -34.9050, longitude: -56.1900 },
  { keys: ["teatro metro"], latitude: -34.9065, longitude: -56.1940 },
  { keys: ["teatro florencio sanchez", "teatro florencio sánchez"], latitude: -34.9072, longitude: -56.1930 },
  { keys: ["teatro del notariado"], latitude: -34.9080, longitude: -56.1960 },
  { keys: ["teatro del anglo"], latitude: -34.9070, longitude: -56.1920 },
  { keys: ["teatro 18 de julio"], latitude: -34.9060, longitude: -56.1870 },
  { keys: ["teatro camara"], latitude: -34.9055, longitude: -56.1910 },
  // NOTE: "espacio cultural" was removed — too generic, would match any venue
  // containing those words and assign arbitrary Montevideo coordinates.
  // ── Teatros Montevideo (cartelera.montevideo.com.uy) ────
  { keys: ["teatro circular", "circular de montevideo"], latitude: -34.9076, longitude: -56.1923 },
  { keys: ["la gringa teatro", "la gringa"], latitude: -34.9102, longitude: -56.1886 },
  { keys: ["la incorrecta"], latitude: -34.9080, longitude: -56.1969 },
  { keys: ["castillo pittamiglio"], latitude: -34.9198, longitude: -56.1543 },
  { keys: ["teatro el galpon", "teatro el galpón", "el galpon"], latitude: -34.9044, longitude: -56.1844 },
  { keys: ["teatro stella"], latitude: -34.9071, longitude: -56.1926 },
  { keys: ["espacio teatro"], latitude: -34.9072, longitude: -56.1880 },
  { keys: ["sala verdi", "teatro verdi"], latitude: -34.9091, longitude: -56.1907 },
  { keys: ["teatro victoria"], latitude: -34.8846, longitude: -56.1677 },
  { keys: ["teatro alianza"], latitude: -34.9144, longitude: -56.1603 },
  { keys: ["teatro el tinglado", "el tinglado"], latitude: -34.9018, longitude: -56.1808 },
  { keys: ["teatro nelly goitiño", "nelly goitino", "nelly goitiño"], latitude: -34.9039, longitude: -56.1874 },
  { keys: ["socio espectacular"], latitude: -34.9095, longitude: -56.1894 },
  { keys: ["amc punta carretas", "movie montevideo"], latitude: -34.9278, longitude: -56.1578 },
  { keys: ["movie portones"], latitude: -34.8648, longitude: -56.0856 },
  { keys: ["life cinemas"], latitude: -34.8750, longitude: -56.1417 },
  { keys: ["cinemateca"], latitude: -34.9076, longitude: -56.1934 },
  { keys: ["sala pocitos", "pocitos sala"], latitude: -34.9144, longitude: -56.1583 },
  { keys: ["teatro politeama"], latitude: -34.8620, longitude: -56.1830 },
  { keys: ["auditorio del sodre", "auditorio dra. adela reta"], latitude: -34.9059, longitude: -56.1893 },
  { keys: ["sala hugo balzo"], latitude: -34.9059, longitude: -56.1893 },
  { keys: ["asociación cristiana de jóvenes", "asociacion cristiana de jovenes", "ymca montevideo"], latitude: -34.9065, longitude: -56.1908 },
  // ── MVD Eventos venues ─────────────────────────────────
  { keys: ["parque maua", "parque mauá"], latitude: -34.8818, longitude: -56.2220 },
  { keys: ["teatro de verano ramon collazo", "ramón collazo"], latitude: -34.9204, longitude: -56.1617 },
  // ── Punta del Este / Maldonado ──────────────────────────
  { keys: ["punta shopping"], latitude: -34.9418, longitude: -54.9418 },
  { keys: ["solanas vacation", "solanas crystal", "solanas beach"], latitude: -34.8780, longitude: -55.0650 },
  { keys: ["parador 31", "costero beach club"], latitude: -34.9397, longitude: -54.9444 },
  { keys: ["torre punta del este"], latitude: -34.9380, longitude: -54.9415 },
  { keys: ["isla de lobos"], latitude: -35.0158, longitude: -54.8767 },
  { keys: ["pueblo arriba", "punta del diablo"], latitude: -34.0432, longitude: -53.8717 },
  { keys: ["plaza de toros real de san carlos"], latitude: -34.4696, longitude: -57.8576 },
  // ── Interior ────────────────────────────────────────────
  { keys: ["florida shopping"], latitude: -34.0979, longitude: -56.2149 },
  { keys: ["centro de aviacion civil de florida", "aviación civil florida"], latitude: -34.1000, longitude: -56.2200 },
  { keys: ["genoves beer", "genovés beer", "san jose de mayo"], latitude: -34.3370, longitude: -56.7130 },
  { keys: ["camino mainumby"], latitude: -34.8420, longitude: -55.9880 },
  // ── Tacuarembó ──────────────────────────────────────────
  { keys: ["teatro 25 de mayo", "25 de mayo tacuarembo"], latitude: -31.7100, longitude: -55.9800 },
  { keys: ["simon bolivar 61", "simón bolívar 61"], latitude: -31.7137, longitude: -55.9832 },
  { keys: ["el mono tacuarembo", "mono tacuarembó", "reapertura del mono"], latitude: -31.7137, longitude: -55.9832 },
  // ── Rivera ──────────────────────────────────────────────
  { keys: ["rivera, rivera", "ciudad de rivera"], latitude: -30.9054, longitude: -55.5508 },
  // ── Salto ───────────────────────────────────────────────
  { keys: ["teatro larrañaga", "teatro larranaga"], latitude: -31.3883, longitude: -57.9611 },
  { keys: ["acuamania", "acuamanía"], latitude: -31.2600, longitude: -57.9500 },
  { keys: ["termas del dayman", "termas del daymán"], latitude: -31.2667, longitude: -57.9667 },
  { keys: ["termas de arapey"], latitude: -30.9167, longitude: -57.4333 },
  // ── Paysandú ────────────────────────────────────────────
  { keys: ["teatro florencio sanchez paysandu", "teatro florencio sánchez paysandú"], latitude: -32.3214, longitude: -58.0756 },
  // ── Colonia ─────────────────────────────────────────────
  { keys: ["teatro bastion del carmen", "bastión del carmen"], latitude: -34.4712, longitude: -57.8440 },
  { keys: ["plaza de toros colonia"], latitude: -34.4696, longitude: -57.8576 },
  // ── Durazno ─────────────────────────────────────────────
  { keys: ["anfiteatro del rio yi", "anfiteatro del río yi"], latitude: -33.3833, longitude: -56.5167 },
  { keys: ["pilsen rock durazno", "durazno rock"], latitude: -33.3833, longitude: -56.5167 },
  // ── Lavalleja ───────────────────────────────────────────
  { keys: ["camping aguas blancas"], latitude: -34.2300, longitude: -55.0300 },
  { keys: ["catedral de minas"], latitude: -34.3761, longitude: -55.2372 },
  // ── Rocha ───────────────────────────────────────────────
  { keys: ["la paloma rocha", "puerto la paloma"], latitude: -34.6547, longitude: -54.1533 },
  { keys: ["cabo polonio"], latitude: -34.3981, longitude: -53.7871 },
];

export async function geocodeVenue(normalized: NormalizedEventInput): Promise<GeocodeResult> {
  // 1. Try the DB-backed venue registry first (cross-source cache)
  const registryMatch = await findVenueCoordinates(normalized.venueName, normalized.city);

  if (registryMatch) {
    return {
      latitude: registryMatch.latitude,
      longitude: registryMatch.longitude,
      source: "lookup",
    };
  }

  // 2. Try known venue lookup next
  const lookup = lookupKnownVenue(normalized.venueName, normalized.venueAddress);

  if (lookup) {
    return {
      latitude: lookup.latitude,
      longitude: lookup.longitude,
      source: "lookup",
    };
  }

  // 3. Try Mapbox geocoding
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return { latitude: null, longitude: null, source: "none" };
  }

  // Build a good geocoding query — try address first, then venue name
  const queryParts = [
    normalized.venueAddress,
    normalized.venueName,
    normalized.city || "Uruguay",
  ].filter(Boolean);

  const query = encodeURIComponent(queryParts.join(", "));

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?limit=1&country=uy&access_token=${mapboxToken}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return { latitude: null, longitude: null, source: "none" };
    }

    const body = (await response.json()) as {
      features?: Array<{ center?: [number, number]; relevance?: number }>;
    };

    const feature = body.features?.[0];
    const center = feature?.center;

    if (!center || center.length < 2) {
      return { latitude: null, longitude: null, source: "none" };
    }

    // Sanity check: must be within Uruguay bounding box (roughly)
    const [lng, lat] = center;
    if (lat < -36 || lat > -30 || lng < -59 || lng > -53) {
      return { latitude: null, longitude: null, source: "none" };
    }

    return {
      latitude: lat,
      longitude: lng,
      source: "mapbox",
    };
  } catch {
    return { latitude: null, longitude: null, source: "none" };
  }
}

function lookupKnownVenue(venueName: string, venueAddress: string | null): { latitude: number; longitude: number } | null {
  const text = normalize([venueName, venueAddress ?? ""].join(" "));

  for (const venue of KNOWN_VENUES) {
    if (venue.keys.some((key) => text.includes(normalize(key)))) {
      return { latitude: venue.latitude, longitude: venue.longitude };
    }
  }

  return null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
