import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { eventSources, events, rawEvents, type RawEvent } from "@/lib/db/schema";
import { isEventBanned } from "@/lib/admin-queries";

import { classifyEvent, shouldRejectEvent, shouldUseAiClassification } from "./classifier";
import { findDuplicateEventId } from "./deduplicator";
import { geocodeVenue } from "./geocoder";
import { classifyEventWithAi } from "./ai-client";
import { calculateConfidenceScore, normalizeRawEvent } from "./normalizer";
import { detectDepartment } from "./department-detector";
import { syncVenueRegistry } from "@/lib/venue-registry";

export interface PipelineResult {
  pending: number;
  processed: number;
  created: number;
  merged: number;
  skipped: number;
  errors: number;
  aiClassified: number;
}

export async function runProcessingPipeline(batchSize = 50): Promise<PipelineResult> {
  const pendingRawEvents = await withTransientRetry("pending-raw-events", async () =>
    db
      .select()
      .from(rawEvents)
      .where(eq(rawEvents.processed, false))
      .limit(batchSize),
  );

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

      await withTransientRetry("set-processing-error", async () =>
        db
          .update(rawEvents)
          .set({
            processingError: String(error),
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
    const outcome = await processRawEvent(rawEvent, { aiEnabled: true });
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
  options: { aiEnabled: boolean },
): Promise<"created" | "merged" | "skipped" | "ai" | "created+ai" | "merged+ai"> {
  const normalized = await normalizeRawEvent(rawEvent);

  // Reject non-events before geocoding/classifying (saves API calls)
  const rejectReason = shouldRejectEvent(normalized);
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
  const banned = await isEventBanned(normalized.name, rawEvent.source, rawEvent.sourceId);
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
      : await geocodeVenue(normalized);
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
    await syncVenueRegistry(enriched);
  } catch (error) {
    console.warn(`[pipeline] venue registry sync failed for raw_event ${rawEvent.id}`, error);
  }

  const rawData = rawEvent.rawData as Record<string, unknown>;
  const category = typeof rawData.category === "string" ? rawData.category : null;
  const genre = typeof rawData.genre === "string" ? rawData.genre : null;
  // dateText may contain schedule info like "lunes a viernes" or "sábados y domingos"
  // that is critical for recurrence detection but not stored in NormalizedEventInput.
  const dateText = typeof rawData.dateText === "string" ? rawData.dateText : null;
  const searchDateText = typeof rawData.searchDateText === "string" ? rawData.searchDateText : null;
  const recurrenceHintText = [dateText, searchDateText].filter(Boolean).join(" \n ") || null;

  const heuristic = classifyEvent(enriched, {
    source: rawEvent.source,
    category,
    genre,
    dateText: recurrenceHintText,
  });
  let classification = {
    eventType: heuristic.eventType,
    musicGenre: heuristic.musicGenre,
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
      };
      usedAi = true;
    }
  }

  const confidenceScore = calculateConfidenceScore(enriched);

  const duplicateEventId = await findDuplicateEventId(enriched, {
    isRecurring,
  });

  const eventId = duplicateEventId ?? (await createEvent(rawEvent, enriched, classification, confidenceScore, isRecurring));

  if (duplicateEventId) {
    await mergeEventData(duplicateEventId, enriched, {
      source: rawEvent.source,
      classification,
      confidenceScore,
    });
  }

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
const TRUSTED_DATE_SOURCES = new Set(["cobraticket", "redtickets", "ticketfacil", "mientrada"]);

async function mergeEventData(
  eventId: string,
  normalized: Awaited<ReturnType<typeof normalizeRawEvent>>,
  incoming: {
    source: string;
    classification: { eventType: ReturnType<typeof classifyEvent>["eventType"]; musicGenre: string | null };
    confidenceScore: string;
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

  // Always update price if rawData has price and event doesn't have one yet
  // This ensures re-scraped events with new prices get updated
  if (normalized.priceMin != null) {
    const hasExistingPrice = existingPriceMin != null && existingPriceMin > 1;
    if (!hasExistingPrice) {
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

  // ── eventType: update when the incoming classification is more confident ──
  // "otro" is the lowest-confidence catch-all type. If the existing event is
  // "otro" and the incoming source has a real type, upgrade it.
  // Also upgrade if the incoming confidence score is meaningfully higher.
  const existingConfidence = Number.parseFloat(existing.confidenceScore ?? "0");
  const incomingConfidence = Number.parseFloat(incoming.confidenceScore);

  if (existing.eventType === "otro" && incoming.classification.eventType !== "otro") {
    updates.eventType = incoming.classification.eventType;
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

function isPlaceholderVenue(value: string | null): boolean {
  if (!value) return true;
  const v = value.toLowerCase().trim();
  return v === "venue por confirmar" || v === "por confirmar" || v === "tba" || v === "";
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
