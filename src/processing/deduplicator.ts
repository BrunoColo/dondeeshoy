import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";

import type { NormalizedEventInput } from "./normalizer";

const PLACEHOLDER_VENUE = "venue por confirmar";

function isPlaceholderVenue(venue: string): boolean {
  const v = venue.toLowerCase().trim();
  return v === PLACEHOLDER_VENUE || v === "por confirmar" || v === "" || v === "tba";
}

export async function findDuplicateEventId(normalized: NormalizedEventInput): Promise<string | null> {
  const sameDayEvents = await db
    .select({
      id: events.id,
      name: events.name,
      venueName: events.venueName,
    })
    .from(events)
    .where(and(eq(events.date, normalized.date), eq(events.city, normalized.city)));

  if (sameDayEvents.length === 0) {
    return null;
  }

  const normalizedName = normalize(normalized.name);
  const normalizedVenue = normalize(normalized.venueName);
  const incomingIsPlaceholder = isPlaceholderVenue(normalized.venueName);

  let bestId: string | null = null;
  let bestScore = 0;

  for (const candidate of sameDayEvents) {
    const nameScore = similarity(normalizedName, normalize(candidate.name));

    // If either venue is a placeholder, venue comparison is irrelevant —
    // rely entirely on name similarity
    const candidateIsPlaceholder = isPlaceholderVenue(candidate.venueName);
    let totalScore: number;

    if (incomingIsPlaceholder || candidateIsPlaceholder) {
      // Name-only: high name match is enough
      totalScore = nameScore;
    } else {
      const venueScore = similarity(normalizedVenue, normalize(candidate.venueName));
      totalScore = nameScore * 0.75 + venueScore * 0.25;
    }

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestId = candidate.id;
    }
  }

  return bestScore >= 0.82 ? bestId : null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const aBigrams = toBigrams(a);
  const bBigrams = toBigrams(b);

  if (aBigrams.size === 0 || bBigrams.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const gram of aBigrams) {
    if (bBigrams.has(gram)) {
      overlap += 1;
    }
  }

  return (2 * overlap) / (aBigrams.size + bBigrams.size);
}

function toBigrams(value: string): Set<string> {
  const compact = value.replace(/\s+/g, " ");

  if (compact.length < 2) {
    return new Set();
  }

  const grams = new Set<string>();

  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.add(compact.slice(index, index + 2));
  }

  return grams;
}
