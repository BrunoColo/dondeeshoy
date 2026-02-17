import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { eventSources, events, rawEvents, type RawEvent } from "@/lib/db/schema";

import { classifyEvent, shouldUseAiClassification } from "./classifier";
import { findDuplicateEventId } from "./deduplicator";
import { geocodeVenue } from "./geocoder";
import { classifyEventWithAi } from "./ai-client";
import { calculateConfidenceScore, normalizeRawEvent } from "./normalizer";

export interface PipelineResult {
  pending: number;
  processed: number;
  created: number;
  merged: number;
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

  const aiBudget = Number.parseInt(process.env.AI_CLASSIFICATION_MAX_PER_BATCH ?? "6", 10);
  let aiClassified = 0;

  const result: PipelineResult = {
    pending: pendingRawEvents.length,
    processed: 0,
    created: 0,
    merged: 0,
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
      }

      if (output === "merged") {
        result.merged += 1;
      }

      if (output === "ai") {
        aiClassified += 1;
        result.aiClassified = aiClassified;
      }

      if (output === "created+ai") {
        result.created += 1;
        aiClassified += 1;
        result.aiClassified = aiClassified;
      }

      if (output === "merged+ai") {
        result.merged += 1;
        aiClassified += 1;
        result.aiClassified = aiClassified;
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

  return result;
}

async function processRawEvent(
  rawEvent: RawEvent,
  options: { aiEnabled: boolean },
): Promise<"created" | "merged" | "ai" | "created+ai" | "merged+ai"> {
  const normalized = await normalizeRawEvent(rawEvent);
  const geocode = await geocodeVenue(normalized);
  const enriched = {
    ...normalized,
    latitude: geocode.latitude,
    longitude: geocode.longitude,
  };

  const heuristic = classifyEvent(enriched);
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
            endTime: null,
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
            currency: "UYU",
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
