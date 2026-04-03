import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { detectRecurrence } from "./classifier";

import type { NormalizedEventInput } from "./normalizer";

type DuplicateCandidate = {
  id: string;
  name: string;
  venueName: string;
  ticketUrl: string | null;
  startTime: string | null;
  department: string;
};

export type DuplicateLookupCache = {
  sameDayByKey: Map<string, DuplicateCandidate[]>;
  sameDayByDate: Map<string, DuplicateCandidate[]>;
  recurringByDepartment: Map<string, DuplicateCandidate[]>;
};

const PLACEHOLDER_VENUE = "venue por confirmar";

function isPlaceholderVenue(venue: string): boolean {
  const v = venue.toLowerCase().trim();
  return v === PLACEHOLDER_VENUE || v === "por confirmar" || v === "" || v === "tba";
}

function isWeakVenue(venue: string, eventName: string): boolean {
  const normalizedVenue = normalize(venue);
  const normalizedName = normalize(eventName);

  if (isPlaceholderVenue(venue)) {
    return true;
  }

  // Some scrapers fill venue with the event name itself (e.g. "CIRCO FANTASY"),
  // which is too weak for reliable location matching.
  if (normalizedVenue.length > 0 && normalizedVenue === normalizedName) {
    return true;
  }

  return false;
}

function normalizeUrlForDedupe(url: string | null): string | null {
  if (!url) return null;

  const raw = url.trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    parsed.hash = "";

    // Remove tracking noise that can differ between sources
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(gclid|fbclid|mc_cid|mc_eid)$/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }

    let normalized = parsed.toString();
    normalized = normalized.replace(/\/$/, "");
    return normalized.toLowerCase();
  } catch {
    return raw.replace(/\/$/, "").toLowerCase();
  }
}

export async function findDuplicateEventId(
  normalized: NormalizedEventInput,
  options?: { isRecurring?: boolean; cache?: DuplicateLookupCache },
): Promise<string | null> {
  const isRecurring = options?.isRecurring ?? detectRecurrence(normalized);
  const cache = options?.cache;

  if (isRecurring) {
    // Recurring events are not tied to a specific date — match by name + city only
    // so that re-scrapes of the same recurring event merge into the existing row
    // instead of creating a new duplicate for each scrape cycle.
    const recurringDuplicate = await findRecurringDuplicate(normalized, cache);
    if (recurringDuplicate) {
      return recurringDuplicate;
    }

    // Fallback: some sources may hint recurrence while another source publishes
    // the same event as a date-specific listing. Try same-day dedupe before creating.
    const sameDepartmentEvents = await loadSameDayCandidates(normalized, cache);
    if (sameDepartmentEvents.length > 0) {
      const sameDepartmentMatch = scoreBestMatch(normalized, sameDepartmentEvents, {
        department: normalized.city,
        crossDepartmentFallback: false,
      });

      if (sameDepartmentMatch) {
        return sameDepartmentMatch;
      }
    }

    const sameDayEvents = await loadSameDayCandidatesByDate(normalized.date, cache);
    if (sameDayEvents.length === 0) {
      return null;
    }

    return scoreBestMatch(normalized, sameDayEvents, {
      department: normalized.city,
      crossDepartmentFallback: true,
    });
  }

  const sameDepartmentEvents = await loadSameDayCandidates(normalized, cache);

  if (sameDepartmentEvents.length > 0) {
    const sameDepartmentMatch = scoreBestMatch(normalized, sameDepartmentEvents, {
      department: normalized.city,
      crossDepartmentFallback: false,
    });

    if (sameDepartmentMatch) {
      return sameDepartmentMatch;
    }
  }

  // Fallback: detect obvious cross-department duplicates when one source has
  // weak venue/location quality (e.g. venue equals event name).
  const sameDayEvents = await loadSameDayCandidatesByDate(normalized.date, cache);

  if (sameDayEvents.length === 0) {
    return null;
  }

  return scoreBestMatch(normalized, sameDayEvents, {
    department: normalized.city,
    crossDepartmentFallback: true,
  });
}

async function findRecurringDuplicate(
  normalized: NormalizedEventInput,
  cache?: DuplicateLookupCache,
): Promise<string | null> {
  // Search across all dates for the same city — recurring events can be stored
  // under any date (the date of their first scrape) so we can't filter by date.
  const sameCityEvents = await loadRecurringCandidates(normalized, cache);

  if (sameCityEvents.length === 0) {
    return null;
  }

  return scoreBestMatch(normalized, sameCityEvents);
}

export function createDuplicateLookupCache(): DuplicateLookupCache {
  return {
    sameDayByKey: new Map(),
    sameDayByDate: new Map(),
    recurringByDepartment: new Map(),
  };
}

export function rememberDuplicateCandidate(
  cache: DuplicateLookupCache,
  normalized: Pick<NormalizedEventInput, "date" | "city" | "name" | "venueName" | "ticketUrl" | "startTime">,
  eventId: string,
  isRecurring: boolean,
): void {
  const candidate: DuplicateCandidate = {
    id: eventId,
    name: normalized.name,
    venueName: normalized.venueName,
    ticketUrl: normalized.ticketUrl,
    startTime: normalized.startTime,
    department: normalized.city,
  };

  rememberCandidateInCollection(
    cache.sameDayByKey,
    buildSameDayCacheKey(normalized.date, normalized.city),
    candidate,
  );

  rememberCandidateInCollection(
    cache.sameDayByDate,
    buildSameDayDateCacheKey(normalized.date),
    candidate,
  );

  if (isRecurring) {
    rememberCandidateInCollection(
      cache.recurringByDepartment,
      buildRecurringCacheKey(normalized.city),
      candidate,
    );
  }
}

async function loadSameDayCandidates(
  normalized: Pick<NormalizedEventInput, "date" | "city">,
  cache?: DuplicateLookupCache,
): Promise<DuplicateCandidate[]> {
  const cacheKey = buildSameDayCacheKey(normalized.date, normalized.city);

  if (cache?.sameDayByKey.has(cacheKey)) {
    return cache.sameDayByKey.get(cacheKey) ?? [];
  }

  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      venueName: events.venueName,
      ticketUrl: events.ticketUrl,
      startTime: events.startTime,
      department: events.department,
    })
    .from(events)
    .where(and(eq(events.date, normalized.date), eq(events.department, normalized.city)))
    .limit(300);

  cache?.sameDayByKey.set(cacheKey, rows);
  return rows;
}

async function loadSameDayCandidatesByDate(
  date: string,
  cache?: DuplicateLookupCache,
): Promise<DuplicateCandidate[]> {
  const cacheKey = buildSameDayDateCacheKey(date);

  if (cache?.sameDayByDate.has(cacheKey)) {
    return cache.sameDayByDate.get(cacheKey) ?? [];
  }

  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      venueName: events.venueName,
      ticketUrl: events.ticketUrl,
      startTime: events.startTime,
      department: events.department,
    })
    .from(events)
    .where(eq(events.date, date))
    .limit(800);

  cache?.sameDayByDate.set(cacheKey, rows);
  return rows;
}

async function loadRecurringCandidates(
  normalized: Pick<NormalizedEventInput, "city">,
  cache?: DuplicateLookupCache,
): Promise<DuplicateCandidate[]> {
  const cacheKey = buildRecurringCacheKey(normalized.city);

  if (cache?.recurringByDepartment.has(cacheKey)) {
    return cache.recurringByDepartment.get(cacheKey) ?? [];
  }

  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      venueName: events.venueName,
      ticketUrl: events.ticketUrl,
      startTime: events.startTime,
      department: events.department,
    })
    .from(events)
    .where(and(eq(events.department, normalized.city), eq(events.isRecurring, true)))
    .limit(300);

  cache?.recurringByDepartment.set(cacheKey, rows);
  return rows;
}

function buildSameDayCacheKey(date: string, city: string): string {
  return `${date}::${city}`;
}

function buildSameDayDateCacheKey(date: string): string {
  return date;
}

function buildRecurringCacheKey(city: string): string {
  return city;
}

function rememberCandidateInCollection(
  collection: Map<string, DuplicateCandidate[]>,
  key: string,
  candidate: DuplicateCandidate,
): void {
  const existing = collection.get(key);

  if (!existing) {
    collection.set(key, [candidate]);
    return;
  }

  if (!existing.some((item) => item.id === candidate.id)) {
    existing.push(candidate);
  }
}

function scoreBestMatch(
  normalized: NormalizedEventInput,
  candidates: Array<{ id: string; name: string; venueName: string; ticketUrl: string | null; startTime: string | null; department: string }>,
  options?: { department?: string; crossDepartmentFallback?: boolean },
): string | null {
  const normalizedName = normalize(normalized.name);
  const normalizedVenue = normalize(normalized.venueName);
  const normalizedTicketUrl = normalizeUrlForDedupe(normalized.ticketUrl);
  const incomingIsPlaceholder = isWeakVenue(normalized.venueName, normalized.name);
  const expectedDepartment = options?.department ?? normalized.city;
  const crossDepartmentFallback = options?.crossDepartmentFallback ?? false;

  let bestId: string | null = null;
  let bestScore = 0;
  let bestHasExactVenue = false;
  let bestHasMatchingStartTime = false;
  let bestHasExactName = false;
  let bestHasPlaceholderVenue = false;
  let bestHasSameTicketUrl = false;

  for (const candidate of candidates) {
    const candidateName = normalize(candidate.name);

    // Combine bigram similarity with token overlap and containment checks
    const bigramScore = similarity(normalizedName, candidateName);
    const tokenScore = tokenOverlap(normalizedName, candidateName);
    const isSubstring = containsSubstring(normalizedName, candidateName);
    const exactName = normalizedName === candidateName && normalizedName.length > 0;
    const sameStartTime =
      normalized.startTime !== null &&
      candidate.startTime !== null &&
      normalized.startTime === candidate.startTime;

    let nameScore = Math.max(bigramScore, tokenScore);
    if (isSubstring) {
      nameScore = Math.max(nameScore, 0.90);
    }
    if (exactName) {
      nameScore = 1;
    }

    // If either venue is a placeholder, venue comparison is irrelevant —
    // rely entirely on name similarity
    const candidateIsPlaceholder = isWeakVenue(candidate.venueName, candidate.name);
    const candidateVenue = normalize(candidate.venueName);
    const candidateTicketUrl = normalizeUrlForDedupe(candidate.ticketUrl);
    const sameTicketUrl =
      normalizedTicketUrl !== null &&
      candidateTicketUrl !== null &&
      normalizedTicketUrl === candidateTicketUrl;
    const venueScore = similarity(normalizedVenue, candidateVenue);
    let totalScore: number;
    let exactVenue = false;

    if (incomingIsPlaceholder || candidateIsPlaceholder) {
      // Name-only: high name match is enough
      totalScore = nameScore;
    } else {
      exactVenue = normalizedVenue === candidateVenue && normalizedVenue.length > 0;
      totalScore = nameScore * 0.75 + venueScore * 0.25;
    }

    if (sameTicketUrl) {
      // Same canonical ticket URL across sources is a very strong duplicate signal.
      totalScore = Math.max(totalScore, 0.99);
    }

    if (crossDepartmentFallback && candidate.department !== expectedDepartment) {
      const strongCrossDepartmentSignal =
        sameTicketUrl ||
        (exactName &&
          sameStartTime &&
          (incomingIsPlaceholder || candidateIsPlaceholder || exactVenue || venueScore >= 0.8));

      if (!strongCrossDepartmentSignal) {
        continue;
      }
    }

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestId = candidate.id;
      bestHasExactVenue = exactVenue;
      bestHasMatchingStartTime = sameStartTime;
      bestHasExactName = exactName;
      bestHasPlaceholderVenue = incomingIsPlaceholder || candidateIsPlaceholder;
      bestHasSameTicketUrl = sameTicketUrl;
    }
  }

  // Lower threshold when venues match exactly — if they're at the same place
  // on the same day with similar names, it's almost certainly a duplicate
  let threshold = 0.82;

  if (bestHasSameTicketUrl) {
    threshold = Math.min(threshold, 0.6);
  }

  if (bestHasExactVenue) {
    threshold = 0.72;
  }

  // Exact title + same start time on the same day is a very strong signal,
  // even when venue aliases differ (e.g. "ACJ Montevideo" vs the full name).
  if (bestHasExactName && bestHasMatchingStartTime) {
    // Only relax heavily if venue matches OR one side has weak/placeholder venue.
    // If both venues are explicit and different, keep a stricter threshold.
    threshold = Math.min(threshold, bestHasExactVenue || bestHasPlaceholderVenue ? 0.68 : 0.78);
  } else if (bestHasMatchingStartTime) {
    threshold = Math.min(threshold, 0.78);
  }

  return bestScore >= threshold ? bestId : null;
}

/**
 * Token overlap: how well the significant words of one name match the other.
 * Uses a containment ratio — if all tokens of the shorter name appear in the
 * longer one, it returns ~0.95 even if the longer has extra words.
 */
function tokenOverlap(a: string, b: string): number {
  const tokensA = a.split(/\s+/).filter((t) => t.length > 2);
  const tokensB = b.split(/\s+/).filter((t) => t.length > 2);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  let shared = 0;
  for (const token of tokensA) {
    if (setB.has(token)) shared += 1;
  }

  const shorter = Math.min(tokensA.length, tokensB.length);
  const containmentRatio = shared / shorter;

  // If all significant words of the shorter name are in the longer, very likely same event
  if (containmentRatio >= 0.8) return 0.95 * containmentRatio;

  // Fallback to Jaccard-like ratio
  const union = new Set([...tokensA, ...tokensB]).size;
  return shared / union;
}

/**
 * Check if one normalized string fully contains the other.
 * Requires the shorter string to be at least 4 characters to avoid
 * false positives on very short names.
 */
function containsSubstring(a: string, b: string): boolean {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 4 && longer.includes(shorter);
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
