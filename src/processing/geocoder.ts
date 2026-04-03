import type { NormalizedEventInput } from "./normalizer";
import { findVenueCoordinates } from "@/lib/venue-registry";
import knownVenuesData from "@/config/known-venues.json";

export interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  source: "scraper" | "lookup" | "google" | "none";
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

  // 3. Try Google Geocoding API
  const googleResult = await geocodeWithGoogle(normalized);

  if (!googleResult) {
    const result = { latitude: null, longitude: null, source: "none" as const };
    options?.cache?.set(cacheKey, result);
    return result;
  }

  const result: GeocodeResult = {
    latitude: googleResult.latitude,
    longitude: googleResult.longitude,
    source: "google",
  };

  options?.cache?.set(cacheKey, result);
  return result;
}

type GoogleGeocodeResponse = {
  status?: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

function getGoogleGeocodingApiKey(): string | null {
  return (
    process.env.GOOGLE_GEOCODING_API_KEY ??
    process.env.GOOGLE_MAPS_SERVER_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    null
  );
}

async function geocodeWithGoogle(normalized: NormalizedEventInput): Promise<{ latitude: number; longitude: number } | null> {
  const apiKey = getGoogleGeocodingApiKey();
  if (!apiKey) return null;

  const queryParts = [
    normalized.venueAddress,
    normalized.venueName,
    normalized.city || "Uruguay",
  ].filter(Boolean);

  if (queryParts.length === 0) return null;

  const params = new URLSearchParams({
    address: queryParts.join(", "),
    components: "country:UY",
    region: "uy",
    language: "es",
    key: apiKey,
  });

  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const body = (await response.json()) as GoogleGeocodeResponse;
    if (body.status !== "OK") return null;

    const location = body.results?.[0]?.geometry?.location;
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!isWithinUruguayBounds(lat, lng)) return null;

    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
}

function isWithinUruguayBounds(latitude: number, longitude: number): boolean {
  return latitude >= -36 && latitude <= -30 && longitude >= -59 && longitude <= -53;
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
