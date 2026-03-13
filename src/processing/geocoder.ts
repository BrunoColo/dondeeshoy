import type { NormalizedEventInput } from "./normalizer";
import { findVenueCoordinates } from "@/lib/venue-registry";
import knownVenuesData from "@/config/known-venues.json";

export interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  source: "scraper" | "lookup" | "mapbox" | "none";
}

export type GeocodeCache = Map<string, GeocodeResult>;

type KnownVenue = {
  keys: string[];
  latitude: number;
  longitude: number;
};

/**
 * Expanded known venue database for Uruguay.
 * Keys are lowercase, accent-stripped substrings to match against venue name + address.
 */
const KNOWN_VENUES: KnownVenue[] = knownVenuesData as KnownVenue[];

export async function geocodeVenue(
  normalized: NormalizedEventInput,
  options?: { cache?: GeocodeCache },
): Promise<GeocodeResult> {
  const cacheKey = buildGeocodeCacheKey(normalized);
  const cached = options?.cache?.get(cacheKey);

  if (cached) {
    return cached;
  }

  // 1. Try the DB-backed venue registry first (cross-source cache)
  const registryMatch = await findVenueCoordinates(normalized.venueName, normalized.city);

  if (registryMatch) {
    const result: GeocodeResult = {
      latitude: registryMatch.latitude,
      longitude: registryMatch.longitude,
      source: "lookup",
    };

    options?.cache?.set(cacheKey, result);
    return result;
  }

  // 2. Try known venue lookup next
  const lookup = lookupKnownVenue(normalized.venueName, normalized.venueAddress);

  if (lookup) {
    const result: GeocodeResult = {
      latitude: lookup.latitude,
      longitude: lookup.longitude,
      source: "lookup",
    };

    options?.cache?.set(cacheKey, result);
    return result;
  }

  // 3. Try Mapbox geocoding
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    const result = { latitude: null, longitude: null, source: "none" as const };
    options?.cache?.set(cacheKey, result);
    return result;
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
      const result = { latitude: null, longitude: null, source: "none" as const };
      options?.cache?.set(cacheKey, result);
      return result;
    }

    const body = (await response.json()) as {
      features?: Array<{ center?: [number, number]; relevance?: number }>;
    };

    const feature = body.features?.[0];
    const center = feature?.center;

    if (!center || center.length < 2) {
      const result = { latitude: null, longitude: null, source: "none" as const };
      options?.cache?.set(cacheKey, result);
      return result;
    }

    // Sanity check: must be within Uruguay bounding box (roughly)
    const [lng, lat] = center;
    if (lat < -36 || lat > -30 || lng < -59 || lng > -53) {
      const result = { latitude: null, longitude: null, source: "none" as const };
      options?.cache?.set(cacheKey, result);
      return result;
    }

    const result: GeocodeResult = {
      latitude: lat,
      longitude: lng,
      source: "mapbox",
    };

    options?.cache?.set(cacheKey, result);
    return result;
  } catch {
    const result = { latitude: null, longitude: null, source: "none" as const };
    options?.cache?.set(cacheKey, result);
    return result;
  }
}

function buildGeocodeCacheKey(normalized: Pick<NormalizedEventInput, "venueName" | "venueAddress" | "city">): string {
  return [normalized.venueName, normalized.venueAddress ?? "", normalized.city]
    .map(normalize)
    .join("::");
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
