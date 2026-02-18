import type { EventType } from "@/types/events";

import type { NormalizedEventInput } from "./normalizer";

export interface ClassificationResult {
  eventType: EventType;
  musicGenre: string | null;
  matchedTypes: EventType[];
  isRecurring: boolean;
}

export interface ClassificationContext {
  source?: string;
  category?: string | null;
  genre?: string | null;
}

/* ─── Type classification rules ─── */
// NOTE: order matters — first match wins. "fiesta" is placed high to beat "club"/"bar".
const EVENT_TYPE_RULES: Array<{ type: EventType; regex: RegExp }> = [
  {
    type: "festival",
    regex:
      /\bfestival(es)?\b|\bfest\b|\bcarnaval\b|\bfiesta\s+popular\b|\bencuentro\s+de\s+bandas\b|\bline\s*up\b/i,
  },
  {
    type: "concierto",
    regex:
      /\bconcierto\b|\blive\b|\bgira\b|\btour\b|\bbanda\s+en\s+vivo\b|\bpresenta\s+su\s+(disco|album)\b|\bm[uú]sica\s+en\s+vivo\b/i,
  },
  { type: "recital", regex: /\brecital\b|\bset\s+ac[uú]stico\b|\bac[uú]stico\b/i },
  {
    type: "teatro",
    regex:
      /\bteatro\b|\bobra\b|\bescena\b|\bdram[aá]tic[oa]\b|\bcomedia\b|\bdramaturgia\b|\bmon[oó]logo\b|\belenco\b|\bmusical\b|\btragedia\b|\bthe\s+crucible\b/i,
  },
  {
    type: "cultural",
    regex:
      /\bmuseo\b|\bexposici[oó]n\b|\bgaler[ií]a\b|\bpatrimonio\b|\bcultural\b|\bart[eí]stic[oa]\b|\bcine\b|\bpel[ií]cula\b|\bfilm\b|\bdocumental\b|\bproyecci[oó]n\b|\bcortometraje\b|\baudiovisual\b|\bliteratura\b|\bpoes[ií]a\b/i,
  },
  {
    type: "deportivo",
    regex:
      /\bpartido\b|\btorneo\b|\bcarrera\b|\bmarat[oó]n\b|\bdeport\w*\b|\bf[uú]tbol\b|\bbasket\b|\bbasquet\b|\bbox\w*\b|\bboxeo\b|\bvelada\s+de\s+box\w*\b|\bmma\b|\bufc\b|\bkick\s*boxing\b|\bcombate\b|\bpelea\b|\brugby\b|\bvoley\b|\bhandball\b|\bdesaf[ií]o\b|\breto\b|\btraves[ií]a\b|\btriatl[oó]n\b|\btrail\b|\bmtb\b|\bgravel\b|\bnado\b|\bnataci[oó]n\b|\bciclismo\b|\bxcm\b|\bestadio\b|\b\d+\s*k(?:m)?\b|\bscott\s*marathon\b|\bvikingo\b|\ba\s*nado\b/i,
  },
  {
    type: "gastronomico",
    regex:
      /\bgastron[oó]mic\w*\b|\bfood\b|\bcata\b|\bdegustaci[oó]n\b|\bcerveza\b|\bvino\b|\bparrilla\b|\bmen[uú]\b|\bchef\b|\bcocina\b|\bcomida\b/i,
  },
  {
    type: "familiar",
    regex:
      /\bfamiliar\b|\binfantil\b|\bniñ\w*\b|\bkids\b|\bapto para todo p[uú]blico\b|\ben familia\b|\bvacaciones\s+de\s+julio\b/i,
  },
  {
    type: "feria",
    regex:
      /\bferia\b|\bmercado\b|\bexpo\b|\bartesan\w*\b|\bemprendedor\w*\b|\bstands?\b|\bferiante\b/i,
  },
  {
    type: "taller",
    regex:
      /\btaller\b|\bworkshop\b|\bcharla\b|\bconferencia\b|\bseminario\b|\bcurso\b|\bmasterclass\b|\bcapacitaci[oó]n\b|\britual\b|\bsanaci[oó]n\b|\bmeditaci[oó]n\b|\bcongreso\b|\bxperience\b/i,
  },
  // fiesta — includes nightlife / dance / baile keywords (unified type)
  {
    type: "fiesta",
    regex:
      /\bfiesta\b|\bparty\b|\brancho\b|\bpariseo\b|\bdance\b|\bdj\b|\belectro\b|\bboliche\b|\bbaile\b|\bpista\s*de\s*baile\b|\bnightclub\b|\bopenbar\b|\bopen\s*bar\b|\bfomo\b|\bcloud\s*7\b|\bcloud\s*sessions?\b|\bprevia\b|\bafter\s*party\b|\bperreo\b|\breggaeton\b|\breggeaton\b|\breguet[oó]n\b/i,
  },
  { type: "club", regex: /\bclub\b|\bsessions?\b|\bafter\b/i },
  { type: "bar", regex: /\bbar\b|\bpub\b|\bcervecer[ií]a\b|\bhappy\s*hour\b|\bcoctel\w*\b/i },
];

const METADATA_HINT_RULES: Array<{ type: EventType; regex: RegExp }> = [
  { type: "teatro", regex: /teatro|artes\s*esc[eé]nicas|dramaturgia|obra/i },
  { type: "cultural", regex: /cultural|audiovisual|cine|literatura|artes\s*visuales|museo|exposici[oó]n/i },
  { type: "deportivo", regex: /deport|box|boxeo|f[uú]tbol|basket|basquet|mma|ufc|torneo|desaf[ií]o|reto|traves[ií]a|trail|mtb|triatl[oó]n|estadio|ciclismo|nado/i },
  { type: "fiesta", regex: /fiesta|dance|dj|electro|boliche|night|reggaeton|reggeaton|perreo/i },
  { type: "concierto", regex: /m[uú]sica|musica|concierto|recital|banda|tour/i },
  { type: "feria", regex: /feria|mercado|expo/i },
  { type: "taller", regex: /taller|workshop|curso|seminario|charla|congreso|ritual|meditaci[oó]n/i },
  { type: "gastronomico", regex: /gastron|food|cata|vino|cerveza|chef/i },
  { type: "familiar", regex: /familiar|infantil|niñ|kids/i },
  { type: "bar", regex: /bar|pub|cervecer/i },
  { type: "club", regex: /club|session|after/i },
  { type: "festival", regex: /festival|fest|carnaval/i },
];

const GENRE_RULES: Array<{ genre: string; regex: RegExp }> = [
  { genre: "electrónica", regex: /electro|house|techno|dj|session/i },
  { genre: "cumbia", regex: /cumbia|plena/i },
  { genre: "rock", regex: /rock|metal|punk/i },
  { genre: "urbano", regex: /trap|reggaeton|reggeaton|reguet[oó]n|urbano|hip hop/i },
  { genre: "pop", regex: /pop/i },
  { genre: "jazz", regex: /jazz|blues/i },
];

/* ─── Recurrence detection ─── */
const DAY = `(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)`;
const RECURRENCE_PATTERNS = [
  /\btodos los d[ií]as\b/i,
  /\btodo el a[nñ]o\b/i,
  /\bdurante todo el a[nñ]o\b/i,
  /\babierto todo el a[nñ]o\b/i,
  // "DayA a DayB" — with or without "de" prefix (matches "Lunes a Jueves", "de Martes a Viernes", etc.)
  new RegExp(`\\b(?:de\\s+)?${DAY}\\s+a\\s+${DAY}\\b`, "i"),
  /\btodos los fines?\s*de?\s*semana\b/i,
  /\bcada fin\s*de\s*semana\b/i,
  new RegExp(`\\btodos?\\s+los?\\s+${DAY}\\b`, "i"),
  new RegExp(`\\bcada\\s+${DAY}\\b`, "i"),
  /\bs[aá]bados?\s+y\s+domingos?\b/i,
  /\bviernes\s+y\s+s[aá]bados?\b/i,
  /\bjueves\s+y\s+viernes\b/i,
  /\bmartes\s+y\s+jueves\b/i,
  /\blun(?:es)?\.?\s*a\s*vie(?:rnes)?\.?\b/i,
  /\bs[aá]b\.?\s*y\s*dom\.?\b/i,
  /\babierto\s+(todos|cada|siempre)\b/i,
  /\bhorarios?\s*:\s*\d/i,
  /\bhorario\s+habitual\b/i,
  /\bhorario\s+regular\b/i,
  /\bd[ií]a\s+de\s+por\s+medio\b/i,
  /\bsemanal(mente)?\b/i,
  /\bpermanente\b/i,
  // "Visita" type experiences (tours that run regularly)
  /\bvisitas?\s+(a\s+la|al|guiadas?)\b/i,
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
 * Patterns that indicate the raw event is NOT actually an event
 * and should be completely rejected from the pipeline (not stored as an event).
 */
const REJECT_PATTERNS = [
  // Venue service listings (rentals, courts, classes)
  /\bcancha(s)?\s+(de\s+)?(f[uú]tbol|tenis|p[aá]del|basketball|basquet)\b/i,
  /\balquiler\s+de\s+(cancha|sal[oó]n|espacio|local|equipo)\b/i,
  /\bturnos?\s+(disponibles?|abiertos?|online)\b/i,
  /\breserv[aá]\s+tu\s+(cancha|turno|lugar|espacio)\b/i,
  // Permanent facilities / services
  /\bgimnasio\b.*\b(abierto|horario|mensual)\b/i,
  /\bmembres[ií]a\b/i,
  /\bplan\s+mensual\b/i,
  /\babonos?\s+mensual(es)?\b/i,
  /\bpiscina\b.*\b(abierta|horario|temporada)\b/i,
  // Job postings / classifieds
  /\bse\s+busca\b.*\b(personal|empleado|mozo|cocinero)\b/i,
  /\bcontratamos\b/i,
  /\benviar?\s+cv\b/i,
  // Pure ads / promos without event
  /\bdescuento\s+\d+%/i,
  /\bpromoci[oó]n\s+(especial|exclusiva|del\s+d[ií]a)\b/i,
  // Recurring classes / schedules (not one-time events)
  /\bclases?\s+(regulares?|permanentes?|semanales?)\b/i,
  // Generic placeholder / test entries
  /\bevento\s+de\s+prueba\b/i,
  /\btest\s+event\b/i,
];

/**
 * Detect if the event is likely a recurring activity rather than a one-time event.
 */
export function detectRecurrence(normalized: NormalizedEventInput): boolean {
  const text = `${normalized.name} ${normalized.description ?? ""} ${normalized.scheduleText ?? ""}`;

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
 * Check if the startTime indicates a late-night fiesta (>= 23:00).
 * Reclassifies club/otro/bar events that start very late as "fiesta".
 */
function shouldReclassifyAsFiesta(
  eventType: EventType,
  startTime: string | null,
): boolean {
  if (!startTime) return false;

  // Only reclassify these types — don't turn a "concierto" into "fiesta"
  const reclassifiableTypes: EventType[] = ["club", "otro", "bar"];
  if (!reclassifiableTypes.includes(eventType)) return false;

  const hourMatch =
    startTime.match(/^(\d{1,2}):/) ??
    startTime.match(/^(\d{1,2})\s*(?:hs?|h)\b/i);
  if (!hourMatch) return false;

  const hour = parseInt(hourMatch[1], 10);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return false;
  return hour >= 22 || hour === 0;
}

/**
 * Determine whether a raw event should be completely rejected (not stored).
 * Returns a reason string if rejected, or null if acceptable.
 */
export function shouldRejectEvent(normalized: NormalizedEventInput): string | null {
  const text = `${normalized.name} ${normalized.description ?? ""}`;

  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(text)) {
      return `rejected: matches non-event pattern ${pattern.source}`;
    }
  }

  // Reject entries with no meaningful name
  if (normalized.name.trim().length < 3) {
    return "rejected: name too short";
  }

  return null;
}

function inferTypeFromMetadata(context?: ClassificationContext): EventType | null {
  if (!context) return null;

  const metadataText = `${context.source ?? ""} ${context.category ?? ""} ${context.genre ?? ""}`.trim();
  if (!metadataText) return null;

  const match = METADATA_HINT_RULES.find((rule) => rule.regex.test(metadataText));
  return match?.type ?? null;
}

export function classifyEvent(normalized: NormalizedEventInput, context?: ClassificationContext): ClassificationResult {
  const text = `${normalized.name} ${normalized.description ?? ""} ${normalized.venueName}`;

  const matchedTypes = EVENT_TYPE_RULES
    .filter((rule) => rule.regex.test(text))
    .map((rule) => rule.type);

  let eventType: EventType =
    matchedTypes[0] ??
    (normalized.venueName.toLowerCase().includes("teatro") ? "teatro" : "otro");

  // Metadata hinting from scraper category/source/genre when text is ambiguous
  if (eventType === "otro") {
    const hintedType = inferTypeFromMetadata(context);
    if (hintedType) {
      eventType = hintedType;
    }
  }

  // Time-based reclassification: late-night generic events → fiesta
  if (shouldReclassifyAsFiesta(eventType, normalized.startTime)) {
    eventType = "fiesta";
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

// High-confidence types that don't need AI even when there are multiple matches.
// These types have very specific keywords that rarely produce false positives.
const HIGH_CONFIDENCE_TYPES = new Set<EventType>([
  "festival",
  "deportivo",
  "teatro",
  "gastronomico",
  "familiar",
]);

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

  // 2) Multiple matched rules can indicate ambiguity — but skip if the primary
  //    match is a high-confidence type (e.g. "festival de rock" matches festival+concierto
  //    but festival is clearly correct and doesn't need AI confirmation).
  if (heuristic.matchedTypes.length > 1 && !HIGH_CONFIDENCE_TYPES.has(heuristic.eventType)) {
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
