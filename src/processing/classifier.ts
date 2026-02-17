import type { EventType } from "@/types/events";

import type { NormalizedEventInput } from "./normalizer";

export interface ClassificationResult {
  eventType: EventType;
  musicGenre: string | null;
  matchedTypes: EventType[];
  isRecurring: boolean;
}

/* ─── Type classification rules ─── */
const EVENT_TYPE_RULES: Array<{ type: EventType; regex: RegExp }> = [
  { type: "festival", regex: /\bfestival(es)?\b|\bfest\b/i },
  { type: "concierto", regex: /\bconcierto\b|\bshow\b|\ben vivo\b|\blive\b|\bgira\b|\btour\b/i },
  { type: "recital", regex: /\brecital\b/i },
  { type: "teatro", regex: /\bteatro\b|\bobra\b|\bescena\b|\bdram[aá]tic[oa]\b|\bcomedia\b/i },
  { type: "cultural", regex: /\bmuseo\b|\bexposici[oó]n\b|\bgaler[ií]a\b|\bpatrimonio\b|\bcultural\b|\bart[eí]stic[oa]\b/i },
  { type: "deportivo", regex: /\bpartido\b|\btorneo\b|\bcarrera\b|\bmarat[oó]n\b|\bdeport\w*\b|\bf[uú]tbol\b|\bbasket\b/i },
  { type: "gastronomico", regex: /\bgastron[oó]mic\w*\b|\bfood\b|\bcata\b|\bdegustaci[oó]n\b|\bcerveza\b|\bvino\b|\bparrilla\b/i },
  { type: "familiar", regex: /\bfamiliar\b|\binfantil\b|\bniñ\w*\b|\bkids\b|\bapto para todo p[uú]blico\b/i },
  { type: "feria", regex: /\bferia\b|\bmercado\b|\bexpo\b|\bartesan\w*\b|\bemprendedor\w*\b/i },
  { type: "taller", regex: /\btaller\b|\bworkshop\b|\bcharla\b|\bconferencia\b|\bseminario\b|\bcurso\b/i },
  { type: "baile", regex: /\bboliche\b|\bbaile\b|\bpista\s*de\s*baile\b|\bnightclub\b|\bopenbar\b|\bopen\s*bar\b|\bfomo\b|\bcloud\s*7\b|\bprevia\b|\bafter\s*party\b|\bperreo\b/i },
  { type: "club", regex: /\bclub\b|\bsessions?\b|\bafter\b/i },
  { type: "bar", regex: /\bbar\b|\bpub\b|\bcervecer[ií]a\b/i },
  { type: "fiesta", regex: /\bfiesta\b|\bparty\b|\brancho\b|\bpariseo\b|\bdance\b|\bdj\b|\belectro\b/i },
];

const GENRE_RULES: Array<{ genre: string; regex: RegExp }> = [
  { genre: "electrónica", regex: /electro|house|techno|dj|session/i },
  { genre: "cumbia", regex: /cumbia|plena/i },
  { genre: "rock", regex: /rock|metal|punk/i },
  { genre: "urbano", regex: /trap|reggaeton|urbano|hip hop/i },
  { genre: "pop", regex: /pop/i },
  { genre: "jazz", regex: /jazz|blues/i },
];

/* ─── Recurrence detection ─── */
const RECURRENCE_PATTERNS = [
  /\btodos los d[ií]as\b/i,
  /\bde lunes a\b/i,
  /\blunes a s[aá]bado\b/i,
  /\blunes a viernes\b/i,
  /\blunes a domingo\b/i,
  /\btodos los fines?\s*de?\s*semana\b/i,
  /\bcada\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i,
  /\bs[aá]bados\s+y\s+domingos\b/i,
  /\babierto\s+(todos|cada|siempre)\b/i,
  /\bhorarios?\s*:\s*\d/i,
  /\bd[ií]a\s+de\s+por\s+medio\b/i,
  /\bsemanal(mente)?\b/i,
  /\bpermanente\b/i,
];

/* ─── Non-event / venue-service detection ─── */
const NON_EVENT_PATTERNS = [
  /\bcancha(s)?\s+(de\s+)?\b/i,
  /\balquiler\s+de\b/i,
  /\breserv[aá]\s+tu\b/i,
  /\bharás?\s+tu\s+reserva\b/i,
  /\bturnos?\s+(disponibles?|abiertos?)\b/i,
  /\bclases?\s+de\s+\w+\s+(todos|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\b/i,
];

/**
 * Detect if the event is likely a recurring activity rather than a one-time event.
 */
export function detectRecurrence(normalized: NormalizedEventInput): boolean {
  const text = `${normalized.name} ${normalized.description ?? ""}`;

  // Check explicit recurrence patterns
  if (RECURRENCE_PATTERNS.some((p) => p.test(text))) {
    return true;
  }

  // Check non-event patterns (venue services are inherently recurring)
  if (NON_EVENT_PATTERNS.some((p) => p.test(text))) {
    return true;
  }

  return false;
}

/**
 * Check if the startTime indicates a late-night baile (>= 23:00).
 * Also reclassifies fiesta/club/otro events that start very late as "baile".
 */
function shouldReclassifyAsBaile(
  eventType: EventType,
  startTime: string | null,
): boolean {
  if (!startTime) return false;

  // Only reclassify these types — don't turn a "concierto" into "baile"
  const reclassifiableTypes: EventType[] = ["fiesta", "club", "otro", "bar"];
  if (!reclassifiableTypes.includes(eventType)) return false;

  const hourMatch = startTime.match(/^(\d{2}):/);
  if (!hourMatch) return false;

  const hour = parseInt(hourMatch[1], 10);
  return hour >= 23 || hour === 0;
}

export function classifyEvent(normalized: NormalizedEventInput): ClassificationResult {
  const text = `${normalized.name} ${normalized.description ?? ""} ${normalized.venueName}`;

  const matchedTypes = EVENT_TYPE_RULES
    .filter((rule) => rule.regex.test(text))
    .map((rule) => rule.type);

  let eventType: EventType =
    matchedTypes[0] ??
    (normalized.venueName.toLowerCase().includes("teatro") ? "teatro" : "otro");

  // Time-based reclassification: late-night generic events → baile
  if (shouldReclassifyAsBaile(eventType, normalized.startTime)) {
    eventType = "baile";
  }

  const musicGenre = GENRE_RULES.find((rule) => rule.regex.test(text))?.genre ?? null;

  const isRecurring = detectRecurrence(normalized);

  return {
    eventType,
    musicGenre,
    matchedTypes,
    isRecurring,
  };
}

/**
 * Keep AI usage intentionally low: only call it for edge/borderline classifications.
 */
export function shouldUseAiClassification(
  normalized: NormalizedEventInput,
  heuristic: ClassificationResult,
): boolean {
  // 1) Unknown bucket => strong AI candidate
  if (heuristic.eventType === "otro") {
    return true;
  }

  // 2) Multiple matched rules can indicate ambiguity
  if (heuristic.matchedTypes.length > 1) {
    return true;
  }

  // 3) Rich descriptions with generic wording can hide actual type
  const description = (normalized.description ?? "").toLowerCase();
  const genericWords = /\bevento\b|\bshow\b|\bexperiencia\b|\bencuentro\b/i.test(description);
  if (description.length >= 120 && genericWords) {
    return true;
  }

  return false;
}
