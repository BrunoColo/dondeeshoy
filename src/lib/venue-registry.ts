import { eq } from "drizzle-orm";

import type { NormalizedEventInput } from "@/processing/normalizer";

import { db } from "./db";
import { venues } from "./db/schema";

const PLACEHOLDER_VENUES = new Set([
  "venue por confirmar",
  "por confirmar",
  "tba",
]);

function normalizeVenueText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRealVenueName(value: string | null | undefined): value is string {
  if (!value) return false;
  return !PLACEHOLDER_VENUES.has(normalizeVenueText(value));
}

export function buildVenueSlug(name: string, department: string | null | undefined): string {
  return [name, department ?? "Montevideo"]
    .map((part) => normalizeVenueText(part))
    .filter(Boolean)
    .join("-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 255);
}

export async function findVenueCoordinates(
  venueName: string,
  department: string | null | undefined,
): Promise<{ latitude: number; longitude: number } | null> {
  if (!isRealVenueName(venueName)) {
    return null;
  }

  const slug = buildVenueSlug(venueName, department);
  if (!slug) {
    return null;
  }

  try {
    const rows = await db
      .select({
        latitude: venues.latitude,
        longitude: venues.longitude,
      })
      .from(venues)
      .where(eq(venues.slug, slug))
      .limit(1);

    const match = rows[0];
    if (!match) {
      return null;
    }

    const latitude = Number.parseFloat(String(match.latitude));
    const longitude = Number.parseFloat(String(match.longitude));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  } catch {
    return null;
  }
}

export async function syncVenueRegistry(normalized: NormalizedEventInput): Promise<void> {
  if (
    !isRealVenueName(normalized.venueName) ||
    normalized.latitude == null ||
    normalized.longitude == null
  ) {
    return;
  }

  const department = normalized.city || "Montevideo";
  const slug = buildVenueSlug(normalized.venueName, department);

  if (!slug) {
    return;
  }

  // `venues.city` still mirrors the department for compatibility with the
  // existing venues schema, even though events now have a dedicated column.
  await db
    .insert(venues)
    .values({
      name: normalized.venueName,
      slug,
      address: normalized.venueAddress ?? department,
      latitude: normalized.latitude.toString(),
      longitude: normalized.longitude.toString(),
      city: department,
    })
    .onConflictDoUpdate({
      target: venues.slug,
      set: {
        name: normalized.venueName,
        address: normalized.venueAddress ?? department,
        latitude: normalized.latitude.toString(),
        longitude: normalized.longitude.toString(),
        city: department,
      },
    });
}