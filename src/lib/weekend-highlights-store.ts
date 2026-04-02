import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { editorialConfigs, events } from "@/lib/db/schema";
import {
  WEEKEND_HIGHLIGHT_LIMIT,
} from "@/config/weekend-highlights";

const WEEKEND_HIGHLIGHTS_CONFIG_KEY = "weekend-highlights";
const MAX_MANUAL_SLUGS = 12;

type WeekendHighlightsPayload = {
  manualSlugs?: string[];
};

export type WeekendHighlightEditorEvent = {
  id: string;
  slug: string;
  name: string;
  date: string;
  eventType: typeof events.$inferSelect.eventType;
  venueName: string;
  isRecurring: boolean;
  status: typeof events.$inferSelect.status;
};

function sanitizeManualSlugs(slugs: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawSlug of slugs) {
    const slug = rawSlug.trim();

    if (!slug || seen.has(slug)) continue;

    seen.add(slug);
    result.push(slug);

    if (result.length >= MAX_MANUAL_SLUGS) break;
  }

  return result;
}

export async function getStoredWeekendHighlightManualSlugs(): Promise<string[]> {
  const rows = await db
    .select({ payload: editorialConfigs.payload })
    .from(editorialConfigs)
    .where(eq(editorialConfigs.key, WEEKEND_HIGHLIGHTS_CONFIG_KEY))
    .limit(1);

  const payload = rows[0]?.payload as WeekendHighlightsPayload | undefined;
  const manualSlugs = Array.isArray(payload?.manualSlugs)
    ? payload.manualSlugs.filter((value): value is string => typeof value === "string")
    : [];

  return sanitizeManualSlugs(manualSlugs);
}

export async function saveWeekendHighlightManualSlugs(slugs: string[]) {
  const manualSlugs = sanitizeManualSlugs(slugs);

  await db
    .insert(editorialConfigs)
    .values({
      key: WEEKEND_HIGHLIGHTS_CONFIG_KEY,
      payload: { manualSlugs },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [editorialConfigs.key],
      set: {
        payload: { manualSlugs },
        updatedAt: new Date(),
      },
    });

  return { manualSlugs };
}

export async function getWeekendHighlightEditorState() {
  const rows = await db
    .select({ payload: editorialConfigs.payload, updatedAt: editorialConfigs.updatedAt })
    .from(editorialConfigs)
    .where(eq(editorialConfigs.key, WEEKEND_HIGHLIGHTS_CONFIG_KEY))
    .limit(1);

  const manualSlugs = await getStoredWeekendHighlightManualSlugs();
  const manualEvents = await getWeekendHighlightEventsBySlugs(manualSlugs);

  const raw = rows[0]?.updatedAt ?? null;
  return {
    manualSlugs,
    manualEvents,
    updatedAt: raw ? raw.toISOString() : null,
    limit: WEEKEND_HIGHLIGHT_LIMIT,
    maxManualSlugs: MAX_MANUAL_SLUGS,
  };
}

export async function getWeekendHighlightEventsBySlugs(slugs: string[]): Promise<WeekendHighlightEditorEvent[]> {
  const sanitized = sanitizeManualSlugs(slugs);

  if (sanitized.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      name: events.name,
      date: events.date,
      eventType: events.eventType,
      venueName: events.venueName,
      isRecurring: events.isRecurring,
      status: events.status,
    })
    .from(events)
    .where(inArray(events.slug, sanitized));

  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return sanitized
    .map((slug) => bySlug.get(slug))
    .filter((row): row is (typeof rows)[number] => Boolean(row));
}