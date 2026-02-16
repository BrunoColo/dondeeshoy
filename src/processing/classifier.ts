import type { EventType } from "@/types/events";

import type { NormalizedEventInput } from "./normalizer";

export interface ClassificationResult {
  eventType: EventType;
  musicGenre: string | null;
}

const EVENT_TYPE_RULES: Array<{ type: EventType; regex: RegExp }> = [
  { type: "festival", regex: /festival|fest/i },
  { type: "recital", regex: /recital|show|concierto|en vivo|live/i },
  { type: "club", regex: /club|sessions?|session|after/i },
  { type: "bar", regex: /bar|pub|cerveceria|cervecería/i },
  { type: "teatro", regex: /teatro|obra|escena/i },
  { type: "fiesta", regex: /fiesta|party|rancho|pariseo|dance|dj|electro/i },
];

const GENRE_RULES: Array<{ genre: string; regex: RegExp }> = [
  { genre: "electrónica", regex: /electro|house|techno|dj|session/i },
  { genre: "cumbia", regex: /cumbia|plena/i },
  { genre: "rock", regex: /rock|metal|punk/i },
  { genre: "urbano", regex: /trap|reggaeton|urbano|hip hop/i },
  { genre: "pop", regex: /pop/i },
  { genre: "jazz", regex: /jazz|blues/i },
];

export function classifyEvent(normalized: NormalizedEventInput): ClassificationResult {
  const text = `${normalized.name} ${normalized.description ?? ""} ${normalized.venueName}`;

  const eventType =
    EVENT_TYPE_RULES.find((rule) => rule.regex.test(text))?.type ??
    (normalized.venueName.toLowerCase().includes("teatro") ? "teatro" : "otro");

  const musicGenre = GENRE_RULES.find((rule) => rule.regex.test(text))?.genre ?? null;

  return {
    eventType,
    musicGenre,
  };
}
