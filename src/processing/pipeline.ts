import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { eventSources, events, rawEvents, type RawEvent } from "@/lib/db/schema";

import { classifyEvent, shouldRejectEvent, shouldUseAiClassification } from "./classifier";
import { findDuplicateEventId } from "./deduplicator";
import { geocodeVenue } from "./geocoder";
import { classifyEventWithAi } from "./ai-client";
import { calculateConfidenceScore, normalizeRawEvent } from "./normalizer";

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

  const aiBudget = Number.parseInt(process.env.AI_CLASSIFICATION_MAX_PER_BATCH ?? "10", 10);
  let aiClassified = 0;
  const linkedRawEventIds: string[] = [];

  const result: PipelineResult = {
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

  console.info(
    `[pipeline] Clasificación: ${heuristicCount} heurística, ${result.aiClassified} IA, ${remainingOtro} quedó otro`,
  );

  return result;
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

  const geocode = await geocodeVenue(normalized);
  const enriched = {
    ...normalized,
    latitude: geocode.latitude,
    longitude: geocode.longitude,
  };

  const rawData = rawEvent.rawData as Record<string, unknown>;
  const category = typeof rawData.category === "string" ? rawData.category : null;
  const genre = typeof rawData.genre === "string" ? rawData.genre : null;

  const heuristic = classifyEvent(enriched, {
    source: rawEvent.source,
    category,
    genre,
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

  const duplicateEventId = await findDuplicateEventId(enriched);

  const eventId = duplicateEventId ?? (await createEvent(rawEvent, enriched, classification, confidenceScore, isRecurring));

  if (duplicateEventId) {
    await mergeEventData(duplicateEventId, enriched);
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

async function mergeEventData(
  eventId: string,
  normalized: Awaited<ReturnType<typeof normalizeRawEvent>>,
): Promise<void> {
  const existingRows = await withTransientRetry("load-existing-event", async () =>
    db
      .select({
        priceMin: events.priceMin,
        priceMax: events.priceMax,
        currency: events.currency,
        imageUrl: events.imageUrl,
        venueName: events.venueName,
        venueAddress: events.venueAddress,
        startTime: events.startTime,
        endTime: events.endTime,
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

  if (normalized.priceMin != null && (existingPriceMin == null || existingPriceMin <= 1)) {
    updates.priceMin = normalized.priceMin;
    updates.priceMax = normalized.priceMax ?? normalized.priceMin;
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
