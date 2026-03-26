import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { bannedEvents, eventSources, events, rawEvents, type RawEvent } from "@/lib/db/schema";

import { classifyEvent, shouldRejectEvent, shouldUseAiClassification } from "./classifier";
import {
  createDuplicateLookupCache,
  findDuplicateEventId,
  rememberDuplicateCandidate,
  type DuplicateLookupCache,
} from "./deduplicator";
import { geocodeVenue, type GeocodeCache } from "./geocoder";
import { classifyEventWithAi } from "./ai-client";
import { calculateConfidenceScore, normalizeRawEvent } from "./normalizer";
import { detectDepartment } from "./department-detector";
import { buildVenueSlug, syncVenueRegistry } from "@/lib/venue-registry";

export interface PipelineResult {
  pending: number;
  processed: number;
  created: number;
  merged: number;
  skipped: number;
  errors: number;
  aiClassified: number;
}

type ClassificationAuthority = "heuristic" | "source" | "ai";

type EventClassification = {
  eventType: ReturnType<typeof classifyEvent>["eventType"];
  musicGenre: string | null;
  typeAuthority: ClassificationAuthority;
};

type LinkedEventCandidate = {
  id: string;
  status: "active" | "cancelled" | "past";
  isRecurring: boolean;
  startTime: string | null;
  updatedAt: Date;
};

type BannedLookup = {
  normalizedNames: Set<string>;
  exactSourceKeys: Set<string>;
};

type PipelineBatchContext = {
  bannedLookup: BannedLookup;
  duplicateLookupCache: DuplicateLookupCache;
  geocodeCache: GeocodeCache;
  syncedVenueSlugs: Set<string>;
};

export async function runProcessingPipeline(batchSize = 50): Promise<PipelineResult> {
  const pendingRawEvents = await withTransientRetry("pending-raw-events", async () =>
    db
      .select()
      .from(rawEvents)
      .where(eq(rawEvents.processed, false))
      .limit(batchSize),
  );

  const context = await createPipelineBatchContext();

  const aiBudget = Number.parseInt(process.env.AI_CLASSIFICATION_MAX_PER_BATCH ?? "25", 10);
  let aiClassified = 0;
  const linkedRawEventIds: string[] = [];

  const result: PipelineResult = {
    // 'pending' will be updated at the end to reflect remaining unprocessed events.
    // Set to the batch size for now as a conservative estimate.
    pending: pendingRawEvents.length,
    processed: 0,
    created: 0,
    merged: 0,
    skipped: 0,
    errors: 0,
    aiClassified: 0,
  };

  for (const rawEvent of pendingRawEvents) {
    try {
      const output = await processRawEvent(rawEvent, {
        aiEnabled: aiClassified < aiBudget,
        context,
      });
      result.processed += 1;

      if (output === "created") {
        result.created += 1;
        linkedRawEventIds.push(rawEvent.id);
      }

      if (output === "merged") {
        result.merged += 1;
        linkedRawEventIds.push(rawEvent.id);
      }

      if (output === "skipped") {
        result.skipped += 1;
      }

      if (output === "ai") {
        aiClassified += 1;
        result.aiClassified = aiClassified;
      }

      if (output === "created+ai") {
        result.created += 1;
        aiClassified += 1;
        result.aiClassified = aiClassified;
        linkedRawEventIds.push(rawEvent.id);
      }

      if (output === "merged+ai") {
        result.merged += 1;
        aiClassified += 1;
        result.aiClassified = aiClassified;
        linkedRawEventIds.push(rawEvent.id);
      }
    } catch (error) {
      result.errors += 1;

      // Redact error: only store message (no stack trace with internal paths)
      const safeMessage = error instanceof Error
        ? error.message.slice(0, 500)
        : "Unknown processing error";

      await withTransientRetry("set-processing-error", async () =>
        db
          .update(rawEvents)
          .set({
            processingError: safeMessage,
          })
          .where(eq(rawEvents.id, rawEvent.id)),
      );

      console.error(`[pipeline] error procesando raw_event ${rawEvent.id}`, error);
    }
  }

  const classifiedCount = result.created + result.merged;
  const heuristicCount = Math.max(0, classifiedCount - result.aiClassified);

  let remainingOtro = 0;
  if (linkedRawEventIds.length > 0) {
    const rows = await withTransientRetry("pipeline-remaining-otro", async () =>
      db
        .select({ count: sql<number>`count(distinct ${eventSources.rawEventId})` })
        .from(eventSources)
        .innerJoin(events, eq(eventSources.eventId, events.id))
        .where(and(inArray(eventSources.rawEventId, linkedRawEventIds), eq(events.eventType, "otro"))),
    );

    remainingOtro = Number(rows[0]?.count ?? 0);
  }

  // Count remaining unprocessed events so the drain loop in the route can decide
  // whether to keep going or stop.
  const remainingRows = await withTransientRetry("pipeline-count-pending", async () =>
    db
      .select({ count: sql<number>`count(*)` })
      .from(rawEvents)
      .where(eq(rawEvents.processed, false)),
  );
  result.pending = Number(remainingRows[0]?.count ?? 0);

  console.info(
    `[pipeline] Clasificación: ${heuristicCount} heurística, ${result.aiClassified} IA, ${remainingOtro} quedó otro. Pendientes restantes: ${result.pending}`,
  );

  return result;
}

export async function reprocessRawEvent(rawEventId: string): Promise<{
  rawEventId: string;
  outcome: "created" | "merged" | "skipped" | "ai" | "created+ai" | "merged+ai";
}> {
  const rows = await withTransientRetry("load-raw-event-for-reprocess", async () =>
    db
      .select()
      .from(rawEvents)
      .where(eq(rawEvents.id, rawEventId))
      .limit(1),
  );

  const rawEvent = rows[0];
  if (!rawEvent) {
    throw new Error("Raw event not found");
  }

  await withTransientRetry("reset-raw-event-for-reprocess", async () =>
    db
      .update(rawEvents)
      .set({
        processed: false,
        processingError: null,
      })
      .where(eq(rawEvents.id, rawEventId)),
  );

  try {
    const outcome = await processRawEvent(rawEvent, {
      aiEnabled: true,
      context: await createPipelineBatchContext(),
    });
    return { rawEventId, outcome };
  } catch (error) {
    await withTransientRetry("set-reprocess-error", async () =>
      db
        .update(rawEvents)
        .set({
          processed: false,
          processingError: String(error),
        })
        .where(eq(rawEvents.id, rawEventId)),
    );
    throw error;
  }
}

async function processRawEvent(
  rawEvent: RawEvent,
  options: { aiEnabled: boolean; context: PipelineBatchContext },
): Promise<"created" | "merged" | "skipped" | "ai" | "created+ai" | "merged+ai"> {
  const normalized = await normalizeRawEvent(rawEvent);
  const rawData = rawEvent.rawData as Record<string, unknown>;
  const category = typeof rawData.category === "string" ? rawData.category : null;
  const genre = typeof rawData.genre === "string" ? rawData.genre : null;
  const dateText = typeof rawData.dateText === "string" ? rawData.dateText : null;
  const searchDateText = typeof rawData.searchDateText === "string" ? rawData.searchDateText : null;
  const recurrenceHintText = [dateText, searchDateText].filter(Boolean).join(" \n ") || null;
  const isRecurringHint = rawData.isRecurringHint === true;

  // Reject non-events before geocoding/classifying (saves API calls)
  const rejectReason = shouldRejectEvent(normalized, {
    source: rawEvent.source,
    category,
    dateText: recurrenceHintText,
  });
  if (rejectReason) {
    console.log(`[pipeline] skipping raw_event ${rawEvent.id}: ${rejectReason}`);
    await withTransientRetry("mark-rejected", async () =>
      db
        .update(rawEvents)
        .set({
          processed: true,
          processingError: rejectReason,
        })
        .where(eq(rawEvents.id, rawEvent.id)),
    );
    return "skipped";
  }

  // Check if this event has been banned by an admin (deleted + banned)
  const banned = isEventBannedInLookup(options.context.bannedLookup, normalized.name, rawEvent.source, rawEvent.sourceId);
  if (banned) {
    const banReason = `[BANNED] Evento eliminado por administrador: "${normalized.name}"`;
    console.log(`[pipeline] skipping banned raw_event ${rawEvent.id}: ${banReason}`);
    await withTransientRetry("mark-banned", async () =>
      db
        .update(rawEvents)
        .set({
          processed: true,
          processingError: banReason,
        })
        .where(eq(rawEvents.id, rawEvent.id)),
    );
    return "skipped";
  }

  // Use scraper-provided coordinates if available, otherwise geocode
  const geocode =
    normalized.latitude != null && normalized.longitude != null
      ? {
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          source: "scraper" as const,
        }
      : await geocodeVenue(normalized, { cache: options.context.geocodeCache });
  const enriched = {
    ...normalized,
    latitude: geocode.latitude,
    longitude: geocode.longitude,
  };

  // Re-detect department using coordinates (more reliable than text matching).
  // Read both rawData.city and rawData.department (MiEntrada uses the latter).
  if (enriched.latitude != null && enriched.longitude != null) {
    const rawData2 = rawEvent.rawData as Record<string, unknown>;
    const scraperCity =
      (typeof rawData2.city === "string" ? rawData2.city : null) ||
      (typeof rawData2.department === "string" ? rawData2.department : null);
    enriched.city = detectDepartment(
      enriched.venueName !== "Venue por confirmar" ? enriched.venueName : null,
      enriched.venueAddress,
      scraperCity,
      enriched.name,
      enriched.latitude,
      enriched.longitude,
    );
  }

  try {
    await syncVenueRegistryOnce(enriched, options.context);
  } catch (error) {
    console.warn(`[pipeline] venue registry sync failed for raw_event ${rawEvent.id}`, error);
  }

  const heuristic = classifyEvent(enriched, {
    source: rawEvent.source,
    category,
    genre,
    dateText: recurrenceHintText,
    isRecurringHint,
  });
  let classification: EventClassification = {
    eventType: heuristic.eventType,
    musicGenre: heuristic.musicGenre,
    typeAuthority: heuristic.fromSourceCategory ? "source" : "heuristic",
  };
  const isRecurring = heuristic.isRecurring;

  let usedAi = false;

  if (options.aiEnabled && shouldUseAiClassification(enriched, heuristic)) {
    const aiClassification = await classifyEventWithAi({
      name: enriched.name,
      description: enriched.description,
      venueName: enriched.venueName,
      fallbackType: heuristic.eventType,
      source: rawEvent.source,
      category,
      genre,
    });

    if (aiClassification && aiClassification.confidence >= 0.65) {
      classification = {
        eventType: aiClassification.eventType,
        musicGenre: aiClassification.musicGenre,
        typeAuthority: "ai",
      };
      usedAi = true;
    }
  }

  const confidenceScore = calculateConfidenceScore(enriched);

  const linkedEventId = await findLinkedEventIdForRawEvent(rawEvent.id, isRecurring);

  if (linkedEventId) {
    await mergeEventData(linkedEventId, enriched, {
      source: rawEvent.source,
      classification,
      confidenceScore,
      isRecurring,
    });
    rememberDuplicateCandidate(options.context.duplicateLookupCache, enriched, linkedEventId, isRecurring);

    await withTransientRetry("mark-processed", async () =>
      db
        .update(rawEvents)
        .set({
          processed: true,
          processingError: null,
        })
        .where(eq(rawEvents.id, rawEvent.id)),
    );

    return usedAi ? "merged+ai" : "merged";
  }

  const duplicateEventId = await findDuplicateEventId(enriched, {
    isRecurring,
    cache: options.context.duplicateLookupCache,
  });

  const eventId = duplicateEventId ?? (await createEvent(rawEvent, enriched, classification, confidenceScore, isRecurring));

  if (duplicateEventId) {
    await mergeEventData(duplicateEventId, enriched, {
      source: rawEvent.source,
      classification,
      confidenceScore,
      isRecurring,
    });
  }

  rememberDuplicateCandidate(options.context.duplicateLookupCache, enriched, eventId, isRecurring);

  const alreadyLinked = await withTransientRetry("already-linked", async () =>
    db
      .select({ id: eventSources.id })
      .from(eventSources)
      .where(and(eq(eventSources.rawEventId, rawEvent.id), eq(eventSources.eventId, eventId)))
      .limit(1),
  );

  if (alreadyLinked.length === 0) {
    await withTransientRetry("insert-event-source", async () =>
      db.insert(eventSources).values({
        eventId,
        rawEventId: rawEvent.id,
        source: rawEvent.source,
        sourceUrl: rawEvent.sourceUrl,
        createdAt: new Date(),
      }),
    );
  }

  await withTransientRetry("mark-processed", async () =>
    db
      .update(rawEvents)
      .set({
        processed: true,
        processingError: null,
      })
      .where(eq(rawEvents.id, rawEvent.id)),
  );

  if (duplicateEventId) {
    return usedAi ? "merged+ai" : "merged";
  }

  return usedAi ? "created+ai" : "created";
}

async function createEvent(
  rawEvent: RawEvent,
  normalized: Awaited<ReturnType<typeof normalizeRawEvent>>,
  classification: { eventType: ReturnType<typeof classifyEvent>["eventType"]; musicGenre: string | null },
  confidenceScore: string,
  isRecurring: boolean,
): Promise<string> {
  // Include date in slug base to avoid collisions for multi-date events
  const dateSlug = normalized.date ? `-${normalized.date}` : "";
  const fallbackBase = (normalized.slug || `evento-${Date.now()}`) + dateSlug;

  for (let suffix = 0; suffix < 200; suffix += 1) {
    const candidateSlug = suffix === 0 ? fallbackBase : `${fallbackBase}-${suffix}`;

    try {
      const inserted = await withTransientRetry("insert-event", async () =>
        db
          .insert(events)
          .values({
            name: normalized.name,
            slug: candidateSlug,
            description: normalized.description,
            date: normalized.date,
            startTime: normalized.startTime,
            endTime: normalized.endTime,
            venueName: normalized.venueName,
            venueAddress: normalized.venueAddress,
            latitude: normalized.latitude?.toString() ?? null,
            longitude: normalized.longitude?.toString() ?? null,
            city: normalized.city,
            department: normalized.city,
            eventType: classification.eventType,
            musicGenre: classification.musicGenre,
            imageUrl: normalized.imageUrl,
            ticketUrl: normalized.ticketUrl,
            priceMin: normalized.priceMin,
            priceMax: normalized.priceMax,
            currency: normalized.currency,
            isFree: normalized.isFree,
            ageRestriction: normalized.ageRestriction,
            isRecurring,
            confidenceScore,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning({ id: events.id }),
      );

      return inserted[0].id;
    } catch (error) {
      const errorStr = String(error);
      const causeStr = error instanceof Error && error.cause ? String(error.cause) : "";
      const fullStr = `${errorStr} ${causeStr}`;
      const conflict = fullStr.includes("events_slug_unique") || fullStr.includes("23505");

      if (conflict) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`[pipeline] no se pudo generar slug único para ${normalized.name}`);
}

/**
 * Sources whose date fields come from ISO-formatted structured data (not free text).
 * Dates from these sources are considered more reliable than dates parsed from
 * free text (e.g. MVD Eventos, Entraste, Cartelera).
 */
const TRUSTED_DATE_SOURCES = new Set(["cobraticket", "redtickets", "ticketfacil", "mientrada", "hayplan"]);
const TRUSTED_PRICE_SOURCES = new Set(["cobraticket", "redtickets", "ticketfacil", "mientrada", "hayplan"]);

async function mergeEventData(
  eventId: string,
  normalized: Awaited<ReturnType<typeof normalizeRawEvent>>,
  incoming: {
    source: string;
    classification: {
      eventType: ReturnType<typeof classifyEvent>["eventType"];
      musicGenre: string | null;
      typeAuthority: "heuristic" | "source" | "ai";
    };
    confidenceScore: string;
    isRecurring: boolean;
  },
): Promise<void> {
  const existingRows = await withTransientRetry("load-existing-event", async () =>
    db
      .select({
        priceMin: events.priceMin,
        priceMax: events.priceMax,
        currency: events.currency,
        isFree: events.isFree,
        imageUrl: events.imageUrl,
        venueName: events.venueName,
        venueAddress: events.venueAddress,
        startTime: events.startTime,
        endTime: events.endTime,
        date: events.date,
        latitude: events.latitude,
        longitude: events.longitude,
        city: events.city,
        department: events.department,
        isRecurring: events.isRecurring,
        eventType: events.eventType,
        confidenceScore: events.confidenceScore,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1),
  );

  const existing = existingRows[0];
  if (!existing) return;

  const updates: Partial<typeof events.$inferInsert> = {};

  const existingPriceMin = existing.priceMin ?? null;
  const existingCurrency = existing.currency ?? "UYU";

  // ── Date update with source-trust protection ──────────────────────────────
  // Only overwrite the date when the incoming source is more trustworthy than
  // the existing one, OR when the existing date is missing.
  // This prevents free-text date parses (MVD Eventos, Cartelera) from
  // overwriting ISO dates from CobraTicket / RedTickets / TicketFacil.
  if (normalized.date) {
    const existingDateStr = existing.date ? existing.date.split('T')[0] : null;
    const newDateStr = normalized.date.split('T')[0];

    if (!existingDateStr) {
      // No existing date — always fill it in.
      updates.date = normalized.date;
    } else if (existingDateStr !== newDateStr) {
      // Dates differ: only update if the incoming source is trusted OR the
      // existing source is not trusted (we don't track which source created the
      // event, so we use a conservative rule: trusted sources always win over
      // non-trusted ones, but two trusted sources don't overwrite each other).
      if (TRUSTED_DATE_SOURCES.has(incoming.source)) {
        updates.date = normalized.date;
      }
      // If incoming is not trusted, keep the existing date as-is.
    }
  }

  // Price update rules:
  // - If event has no price yet: always fill.
  // - If source is trusted and price changed: refresh existing price.
  // This prevents stale values (e.g. old scrape artifacts) from persisting.
  if (normalized.priceMin != null) {
    const hasExistingPrice = existingPriceMin != null && existingPriceMin > 1;
    const incomingPriceMin = normalized.priceMin;
    const incomingPriceMax = normalized.priceMax ?? normalized.priceMin;
    const priceChanged = existing.priceMin !== incomingPriceMin || existing.priceMax !== incomingPriceMax;

    if (!hasExistingPrice || (TRUSTED_PRICE_SOURCES.has(incoming.source) && priceChanged)) {
      updates.priceMin = normalized.priceMin;
      updates.priceMax = normalized.priceMax ?? normalized.priceMin;
    }
  }

  // Also update if rawData has isFree=true and event doesn't have price set
  if (normalized.isFree && !existing.priceMin && !existing.priceMax && existing.isFree !== true) {
    updates.isFree = normalized.isFree;
  }

  if (normalized.currency === "USD" && existingCurrency !== "USD") {
    updates.currency = "USD";
  }

  if (!existing.imageUrl && normalized.imageUrl) {
    updates.imageUrl = normalized.imageUrl;
  }

  if (isPlaceholderVenue(existing.venueName) && normalized.venueName) {
    updates.venueName = normalized.venueName;
  }

  if (!existing.venueAddress && normalized.venueAddress) {
    updates.venueAddress = normalized.venueAddress;
  }

  if (!existing.startTime && normalized.startTime) {
    updates.startTime = normalized.startTime;
  }

  if (!existing.endTime && normalized.endTime) {
    updates.endTime = normalized.endTime;
  }

  // Update coordinates and department when scraper provides them
  // This ensures the mini map and department filter always have accurate data
  const hasExistingCoords = existing.latitude && existing.longitude;
  const hasNewCoords = normalized.latitude != null && normalized.longitude != null;
  
  if (hasNewCoords && !hasExistingCoords) {
    updates.latitude = normalized.latitude?.toString() ?? null;
    updates.longitude = normalized.longitude?.toString() ?? null;
    // Recalculate department from new coordinates
    if (normalized.city) {
      updates.city = normalized.city;
      updates.department = normalized.city;
    }
  }

  // Also update city if it was previously null/empty and we have it now
  if (normalized.city && !existing.city) {
    updates.city = normalized.city;
  }

  if (normalized.city && (!existing.department || existing.department !== normalized.city)) {
    updates.department = normalized.city;
  }

  if (incoming.isRecurring && existing.isRecurring !== true) {
    updates.isRecurring = true;
  }

  // ── eventType: update when the incoming classification is more confident ──
  // "otro" is the lowest-confidence catch-all type. If the existing event is
  // "otro" and the incoming source has a real type, upgrade it.
  // Also upgrade if the incoming confidence score is meaningfully higher.
  const existingConfidence = Number.parseFloat(existing.confidenceScore ?? "0");
  const incomingConfidence = Number.parseFloat(incoming.confidenceScore);

  const incomingType = incoming.classification.eventType;
  const shouldTrustIncomingType = incoming.classification.typeAuthority === "source";

  if (shouldTrustIncomingType && incomingType !== existing.eventType) {
    updates.eventType = incomingType;
    updates.musicGenre = incoming.classification.musicGenre;
  } else if (existing.eventType === "otro" && incomingType !== "otro") {
    updates.eventType = incomingType;
    if (incoming.classification.musicGenre) {
      updates.musicGenre = incoming.classification.musicGenre;
    }
  }

  // ── confidenceScore: update when the incoming score is higher ────────────
  if (incomingConfidence > existingConfidence) {
    updates.confidenceScore = incoming.confidenceScore;
  }

  if (Object.keys(updates).length === 0) return;

  updates.updatedAt = new Date();

  await withTransientRetry("update-merged-event", async () =>
    db.update(events).set(updates).where(eq(events.id, eventId)),
  );
}

async function findLinkedEventIdForRawEvent(rawEventId: string, incomingIsRecurring: boolean): Promise<string | null> {
  const linkedRows = await withTransientRetry("load-linked-event", async () =>
    db
      .select({
        id: events.id,
        status: events.status,
        isRecurring: events.isRecurring,
        startTime: events.startTime,
        updatedAt: events.updatedAt,
      })
      .from(eventSources)
      .innerJoin(events, eq(eventSources.eventId, events.id))
      .where(eq(eventSources.rawEventId, rawEventId)),
  );

  if (linkedRows.length === 0) return null;

  const ranked = linkedRows
    .slice()
    .sort((left: LinkedEventCandidate, right: LinkedEventCandidate) => {
      const leftScore = scoreLinkedEventCandidate(left, incomingIsRecurring);
      const rightScore = scoreLinkedEventCandidate(right, incomingIsRecurring);

      if (leftScore !== rightScore) return rightScore - leftScore;
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });

  return ranked[0]?.id ?? null;
}

function scoreLinkedEventCandidate(candidate: LinkedEventCandidate, incomingIsRecurring: boolean): number {
  let score = 0;
  if (candidate.status === "active") score += 4;
  if (candidate.startTime) score += 2;
  if (candidate.isRecurring === incomingIsRecurring) score += 3;
  if (candidate.isRecurring) score += 1;
  return score;
}

function isPlaceholderVenue(value: string | null): boolean {
  if (!value) return true;
  const v = value.toLowerCase().trim();
  return v === "venue por confirmar" || v === "por confirmar" || v === "tba" || v === "";
}

async function createPipelineBatchContext(): Promise<PipelineBatchContext> {
  return {
    bannedLookup: await loadBannedLookup(),
    duplicateLookupCache: createDuplicateLookupCache(),
    geocodeCache: new Map(),
    syncedVenueSlugs: new Set(),
  };
}

async function loadBannedLookup(): Promise<BannedLookup> {
  const rows = await withTransientRetry("load-banned-events", async () =>
    db
      .select({
        normalizedName: bannedEvents.normalizedName,
        source: bannedEvents.source,
        sourceId: bannedEvents.sourceId,
      })
      .from(bannedEvents),
  );

  const normalizedNames = new Set<string>();
  const exactSourceKeys = new Set<string>();

  for (const row of rows) {
    if (row.normalizedName) {
      normalizedNames.add(row.normalizedName);
    }

    if (row.source && row.sourceId) {
      exactSourceKeys.add(buildSourceBanKey(row.source, row.sourceId));
    }
  }

  return {
    normalizedNames,
    exactSourceKeys,
  };
}

function isEventBannedInLookup(
  lookup: BannedLookup,
  name: string,
  source?: string,
  sourceId?: string,
): boolean {
  if (source && sourceId && lookup.exactSourceKeys.has(buildSourceBanKey(source, sourceId))) {
    return true;
  }

  return lookup.normalizedNames.has(normalizeBanName(name));
}

function normalizeBanName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSourceBanKey(source: string, sourceId: string): string {
  return `${source}::${sourceId}`;
}

async function syncVenueRegistryOnce(
  normalized: Awaited<ReturnType<typeof normalizeRawEvent>>,
  context: PipelineBatchContext,
): Promise<void> {
  if (normalized.latitude == null || normalized.longitude == null) {
    return;
  }

  const slug = buildVenueSlug(normalized.venueName, normalized.city);
  if (!slug || context.syncedVenueSlugs.has(slug)) {
    return;
  }

  await syncVenueRegistry(normalized);
  context.syncedVenueSlugs.add(slug);
}

async function withTransientRetry<T>(
  label: string,
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isTransient = isTransientNetworkError(error);

      if (!isTransient || attempt === attempts) {
        throw error;
      }

      const delay = 200 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`[pipeline] ${label} agotó reintentos: ${String(lastError)}`);
}

function isTransientNetworkError(error: unknown): boolean {
  const text = String(error);

  return (
    text.includes("ENOTFOUND") ||
    text.includes("ETIMEDOUT") ||
    text.includes("ECONNRESET") ||
    text.includes("ECONNREFUSED") ||
    text.includes("57P01")
  );
}
