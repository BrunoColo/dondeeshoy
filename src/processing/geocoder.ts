import type { NormalizedEventInput } from "./normalizer";

export interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  source: "lookup" | "mapbox" | "none";
}

type KnownVenue = {
  keys: string[];
  latitude: number;
  longitude: number;
};

const KNOWN_VENUES: KnownVenue[] = [
  {
    keys: ["antel arena"],
    latitude: -34.8944,
    longitude: -56.1328,
  },
  {
    keys: ["teatro solis", "teatro solís"],
    latitude: -34.9077,
    longitude: -56.2006,
  },
  {
    keys: ["sodre", "auditorio nacional"],
    latitude: -34.9059,
    longitude: -56.1893,
  },
  {
    keys: ["cloud 7", "cloud7"],
    latitude: -34.9016,
    longitude: -56.1788,
  },
  {
    keys: ["sala del museo"],
    latitude: -34.9054,
    longitude: -56.2081,
  },
];

export async function geocodeVenue(normalized: NormalizedEventInput): Promise<GeocodeResult> {
  const lookup = lookupKnownVenue(normalized.venueName, normalized.venueAddress);

  if (lookup) {
    return {
      latitude: lookup.latitude,
      longitude: lookup.longitude,
      source: "lookup",
    };
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return {
      latitude: null,
      longitude: null,
      source: "none",
    };
  }

  const query = encodeURIComponent(
    [normalized.venueAddress, normalized.venueName, normalized.city, "Uruguay"].filter(Boolean).join(", "),
  );

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?limit=1&country=uy&access_token=${mapboxToken}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        latitude: null,
        longitude: null,
        source: "none",
      };
    }

    const body = (await response.json()) as {
      features?: Array<{ center?: [number, number] }>;
    };

    const center = body.features?.[0]?.center;

    if (!center || center.length < 2) {
      return {
        latitude: null,
        longitude: null,
        source: "none",
      };
    }

    return {
      latitude: center[1],
      longitude: center[0],
      source: "mapbox",
    };
  } catch {
    return {
      latitude: null,
      longitude: null,
      source: "none",
    };
  }
}

function lookupKnownVenue(venueName: string, venueAddress: string | null): { latitude: number; longitude: number } | null {
  const text = normalize([venueName, venueAddress ?? ""].join(" "));

  for (const venue of KNOWN_VENUES) {
    if (venue.keys.some((key) => text.includes(normalize(key)))) {
      return {
        latitude: venue.latitude,
        longitude: venue.longitude,
      };
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
