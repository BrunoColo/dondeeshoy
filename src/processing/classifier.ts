import type { EventType } from "@/types/events";

import type { NormalizedEventInput } from "./normalizer";

export interface ClassificationResult {
  eventType: EventType;
  musicGenre: string | null;
}

const EVENT_TYPE_RULES: Array<{ type: EventType; regex: RegExp }> = [
  { type: "festival", regex: /\bfestival(es)?\b|\bfest\b/i },
  { type: "recital", regex: /\brecital\b|\bshow\b|\bconcierto\b|\ben vivo\b|\blive\b/i },
  { type: "club", regex: /\bclub\b|\bsessions?\b|\bafter\b/i },
  { type: "bar", regex: /\bbar\b|\bpub\b|\bcervecer[ií]a\b/i },
  { type: "teatro", regex: /\bteatro\b|\bobra\b|\bescena\b/i },
  { type: "fiesta", regex: /\bfiesta\b|\bparty\b|\brancho\b|\bpariseo\b|\bdance\b|\bdj\b|\belectro\b/i },
];

const NON_NIGHTLIFE_REGEX =
  /\breserva\b|\bfauna\b|\bparque\b|\bzool[oó]gic[oa]\b|\becoparque\b|\bestancia\b|\bgranja\b|\btur[ií]stic[oa]\b|\bmuseo\b|\bexcursi[oó]n\b/i;

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

  if (NON_NIGHTLIFE_REGEX.test(text)) {
    return {
      eventType: "otro",
      musicGenre: null,
    };
  }

  const eventType =
    EVENT_TYPE_RULES.find((rule) => rule.regex.test(text))?.type ??
    (normalized.venueName.toLowerCase().includes("teatro") ? "teatro" : "otro");

  const musicGenre = GENRE_RULES.find((rule) => rule.regex.test(text))?.genre ?? null;

  return {
    eventType,
    musicGenre,
  };
}
