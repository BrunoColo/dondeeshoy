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
      /\bconcierto\b|\blive\b|\bgira\b|\btour\b|\bbanda\s+en\s+vivo\b|\bpresenta\s+su\s+(disco|album)\b|\bm[uú]sica\s+en\s+vivo\b|\broda\s+de\s+samba\b|\bsamba\b|\bcandombe\b|\brueda\s+de\s+candombe\b/i,
  },
  { type: "recital", regex: /\brecital\b|\bset\s+ac[uú]stico\b|\bac[uú]stico\b/i },
  {
    type: "teatro",
    regex:
      /\bteatro\b|\bobra\b|\bescena\b|\bdram[aá]tic[oa]\b|\bcomedia\b|\bdramaturgia\b|\bmon[oó]logo\b|\belenco\b|\bmusical\b|\btragedia\b|\bthe\s+crucible\b|\bunipersonal\b|\bimprovisaci\w*\b|\bstand\s*up\b|\bhumorist\w*\b|\bhumor\b|\bcircuito\s+teatral\b/i,
  },
  {
    type: "cultural",
    regex:
      /\bmuseo\b|\bexposici[oó]n\b|\bgaler[ií]a\b|\bpatrimonio\b|\bcultural\b|\bart[eí]stic[oa]\b|\bcine\b|\bpel[ií]cula\b|\bfilm\b|\bdocumental\b|\bproyecci[oó]n\b|\bcortometraje\b|\baudiovisual\b|\bliteratura\b|\bpoes[ií]a\b|\btablado\b|\bvisitas?\s+guiadas?\b|\bmisterios?\s+del?\b|\bpeatonal\s+tours?\b|\bvisit[aá]s?\s+(?:a\s+)?(?:la|el|al)\b|\breserva\s+(?:natural|de\s+fauna)\b|\bconocé\s+el\b/i,
  },
  {
    type: "deportivo",
    regex:
      /\bpartido\b|\btorneo\b|\bcarrera\b|\bmarat[oó]n\b|\bdeport\w*\b|\bf[uú]tbol\b|\bbasket\b|\bbasquet\b|\bbox\w*\b|\bboxeo\b|\bvelada\s+de\s+box\w*\b|\bmma\b|\bufc\b|\bkick\s*boxing\b|\bcombate\b|\bpelea\b|\brugby\b|\bvoley\b|\bhandball\b|\bdesaf[ií]o\b|\breto\b|\btraves[ií]a\b|\btriatl[oó]n\b|\btrail\b|\bmtb\b|\bgravel\b|\bnado\b|\bnataci[oó]n\b|\bciclismo\b|\bxcm\b|\bestadio\b|\b\d+\s*k(?:m)?\b|\bscott\s*marathon\b|\bvikingo\b|\ba\s*nado\b|\bhip[oó]dromo\b|\bmaro[nñ]as\b|\btrekking\b|\bsenderismo\b|\bpesca\b|\bgrutas?\s+extremas?\b/i,
  },
  {
    type: "gastronomico",
    regex:
      /\bgastron[oó]mic\w*\b|\bfood\b|\bcata\b|\bdegustaci[oó]n\b|\bcerveza\b|\bvino\b|\bparrilla\b|\bmen[uú]\b|\bchef\b|\bcocina\b|\bcomida\b|\bwine\s*lodge\b|\bchacra\s+tramonto\b/i,
  },
  {
    type: "familiar",
    regex:
      /\bfamiliar\b|\binfantil\b|\bni\u00f1\w*\b|\bkids\b|\bapto para todo p[u\u00fa]blico\b|\ben familia\b|\bvacaciones\s+de\s+julio\b|\bpaintball\b|\btrampoline\b|\btrampol[i\u00ed]n\b|\bparque\s+(?:de\s+)?(?:aventura|destrezas?)\b|\baqua\s*park\b|\baquaman[i\u00ed]a\b|\baquapark\b|\bbungee\b|\bparque\s+acu[a\u00e1]tico\b|\bgravity\b|\bdino\s*aventura\b|\bcirco\b|\bwet\s*(?:&|y)\s*wild\b|\bnimbus\b|\bparque\s+biomas?\b|\bla\s+cuerda\b|\bfutvolt\b|\btactical\s+games?\b|\bludus\b/i,
  },
  {
    type: "feria",
    regex:
      /\bferia\b|\bmercado\b|\bexpo\b|\bartesan\w*\b|\bemprendedor\w*\b|\bstands?\b|\bferiante\b/i,
  },
  {
    type: "taller",
    regex:
      /\btalleres?\b|\bworkshop\b|\bcharla\b|\bconferencia\b|\bseminario\b|\bcurso\b|\bmasterclass\b|\bcapacitaci[oó]n\b|\britual\b|\bsanaci[oó]n\b|\bmeditaci[oó]n\b|\bcongreso\b|\bxperience\b|\bdisertaci[oó]n\b|\bescuela\s+de\b/i,
  },
  // fiesta — includes nightlife / dance / baile keywords (unified type)
  {
    type: "fiesta",
    regex:
      /\bfiesta\b|\bparty\b|\brancho\b|\bpariseo\b|\bdance\b|\bdj\b|\belectro\b|\bboliche\b|\bbaile\b|\bpista\s*de\s*baile\b|\bnightclub\b|\bopenbar\b|\bopen\s*bar\b|\bfomo\b|\bcloud\s*7\b|\bcloud\s*sessions?\b|\bprevia\s+(?:de\s+)?(?:la\s+)?(?:fiesta|party|noche)\b|\bafter\s*party\b|\bperreo\b|\breggaeton\b|\breggeaton\b|\breguet[o\u00f3]n\b|\bnoche\s+cubana\b|\bla\s+previa\b|\bdanzeria\b|\b2\s+pistas\b|\bacceso\s+\d+\s+pistas?\b|\bcumbia\s+vieja\b|\bsin\s+censura\b|\bsilent\s+(?:disco|party|luna)\b|\blokeito\b|\bsunset\s+experience\b/i,
  },
  { type: "club", regex: /\bclub\b|\bclvb\b|\bsessions?\b|\bafter\b/i },
  { type: "bar", regex: /\bbar\b|\bpub\b|\bcervecer[ií]a\b|\bhappy\s*hour\b|\bcoctel\w*\b/i },
];

const METADATA_HINT_RULES: Array<{ type: EventType; regex: RegExp }> = [
  { type: "teatro", regex: /teatro|artes\s*esc[eé]nicas|dramaturgia|obra\s+de|funci[oó]n\s+de|actuaci[oó]n|elenco|obra\s+teatral|presentaci[oó]n\s+esc[é]nica|piezas?\s+teatrales?|sala\s+de\s+espect[áé]culos|unipersonal|humor|stand\s*up/i },
  { type: "cultural", regex: /cultural|audiovisual|cine|literatura|artes\s*visuales|museo|exposici[oó]n|galer[ií]a|presentaci[oó]n\s+de\s+libro|charla\s+cultural|encuentro\s+literario|muestra\s+art[í]stica|tablado|candombe|patrimonio|visita\s+guiada|tours?/i },
  { type: "deportivo", regex: /deport|box|boxeo|f[uú]tbol|basket|basquet|mma|ufc|torneo|desaf[ií]o|reto|traves[ií]a|trail|mtb|triatl[oó]n|estadio|ciclismo|nado|marat[oó]n|carrera\s+de|liga|deporte|competici[oó]n|torneo\s+de|challenge|copa|selecci[oó]n|hip[oó]dromo|trekking|pesca/i },
  { type: "fiesta", regex: /fiesta|dance|dj|electro|boliche|night|reggaeton|reggeaton|perreo|party|after\s*party|open\s*bar|discoteca|clandestino|bailable|baile\s+de|kermesse|celebraci[oó]n|festejo|noche\s+cubana|danzeria/i },
  { type: "concierto", regex: /m[uú]sica|musica|concierto|recital|banda|tour|vivo|show\s+musical|presentaci[oó]n\s+musical|actuaci[oó]n\s+musical|gira\s+musical/i },
  { type: "festival", regex: /festival|fest|carnaval|encuentro\s+de\s+m[ú]sica|marat[oó]n\s+musical/i },
  { type: "feria", regex: /feria|mercado|expo|feria\s+de|mercado\s+de|exposici[oó]n\s+comercial/i },
  { type: "taller", regex: /taller|workshop|curso|seminario|charla|congreso|ritual|meditaci[oó]n|sanaci[oó]n|encuentro\s+de|conferencia|presentaci[oó]n|simposio|jornada/i },
  { type: "gastronomico", regex: /gastron|food|cata|vino|cerveza|chef|cocina|restaurante|men[uú]|degustaci[oó]n|comida\s+de|gourmet/i },
  { type: "familiar", regex: /familiar|infantil|niñ|kids|para\s+niños|con\s+niños| familia|nenes|chicos/i },
  { type: "bar", regex: /bar|pub|cervecer|pubs?|happy\s*hour|tragos?|bebidas?\s+artesianales?|cervecer[ií]a\s+artesianal/i },
  { type: "club", regex: /club|nocturno|after\s*hours|sessions?|noche\s+de/i },
];

const GENRE_RULES: Array<{ genre: string; regex: RegExp }> = [
  { genre: "electrónica", regex: /electro|house|techno|dj|session/i },
  { genre: "cumbia", regex: /cumbia|plena/i },
  { genre: "rock", regex: /rock|metal|punk/i },
  { genre: "urbano", regex: /trap|reggaeton|reggeaton|reguet[oó]n|urbano|hip hop/i },
  { genre: "pop", regex: /pop/i },
  { genre: "jazz", regex: /jazz|blues/i },
];

/* ─── Known theater venues in Uruguay ─── */
const KNOWN_THEATER_VENUES = [
  /el\s+tinglado/i,
  /el\s+galp[oó]n/i,
  /sala\s+zavala\s+muniz/i,
  /auditorio\s+vaz\s+ferreira/i,
  /teatro\s+sol[ií]s/i,
  /teatro\s+el\s+picadero/i,
  /teatro\s+de\s+la\s+ciudad/i,
  /espacio\s+palermo/i,
  /la\s+cretina/i,
  /asociaci[oó]n\s+cristiana\s+de\s+j[oó]venes/i,
  /castillo\s+pittamiglio/i,
  /la\s+colmena/i,
  /teatro\s+florencio\s+sanchez/i,
  /teatro\s+gran\s+retton/i,
  /sala\s+del\s+museo/i,
  /peña\s+blanca/i,
  /sala\s+camac[uú][aá]/i,
  /la\s+incorrecta/i,
  /casatrompo/i,
  /\bacj\s+montevideo/i,
];

/* ─── Known concert / music venues in Uruguay ─── */
const KNOWN_CONCERT_VENUES = [
  /medio\s+y\s+medio/i,
  /magnolio\s+sala/i,
  /pueblo\s+narakan/i,
  /sociedad\s+urbana\s+villa\s+dolores/i,
  /soto\s+bosque/i,
  /sala\s+del\s+museo/i,
  /la\s+trastienda/i,
  /sala\s+zitarrosa/i,
  /estadio\s+centenario/i,
  /antel\s+arena/i,
  /velódromo/i,
  /teatro\s+de\s+verano/i,
];

/* ─── Known party / nightclub venues in Uruguay ─── */
const KNOWN_PARTY_VENUES = [
  /viejo\s+barreiro/i,
  /\bsoho\b/i,
  /\bnox\s*cl[uv]b/i,
  /\bplaza\s+mateo\b/i,
  /\binmigrantes\s+mvd/i,
  /\bviejar2/i,
  /\blokeito/i,
];

/* ─── Known cultural venues (tablados, etc.) ─── */
const KNOWN_CULTURAL_VENUES = [
  /tablado\s+parque\s+rod[oó]/i,
  /tablado\s+primero\s+de\s+mayo/i,
  /tablado\s+1ero\s+de\s+mayo/i,
  /tablado\s+monumental/i,
  /palacio\s+salvo/i,
  /plaza\s+de\s+toros/i,
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

  // Check if venue is a known type
  const venueName = normalized.venueName ?? "";
  const venueIsKnownTheater = KNOWN_THEATER_VENUES.some((regex) =>
    regex.test(venueName),
  );
  const venueIsKnownConcert = KNOWN_CONCERT_VENUES.some((regex) =>
    regex.test(venueName),
  );
  const venueIsKnownParty = KNOWN_PARTY_VENUES.some((regex) =>
    regex.test(venueName),
  );
  const venueIsKnownCultural = KNOWN_CULTURAL_VENUES.some((regex) =>
    regex.test(venueName),
  );

  let eventType: EventType;
  if (matchedTypes[0]) {
    eventType = matchedTypes[0];
  } else if (venueName.toLowerCase().includes("teatro") || venueIsKnownTheater) {
    eventType = "teatro";
  } else if (venueIsKnownParty) {
    eventType = "fiesta";
  } else if (venueIsKnownConcert) {
    eventType = "concierto";
  } else if (venueIsKnownCultural || /\btablado\b/i.test(normalized.name)) {
    eventType = "cultural";
  } else {
    eventType = "otro";
  }

  // Metadata hinting: use scraper category to improve classification
  // This helps when text matching is weak but source provides good category
  const hintedType = inferTypeFromMetadata(context);
  if (hintedType) {
    // If current type is "otro" or the hinted type is more specific, use it
    if (eventType === "otro" || shouldPreferHintedType(eventType, hintedType)) {
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

/**
 * Decide if the hinted type from metadata should be preferred over the heuristic match.
 * Prioritize specific types over generic ones.
 */
function shouldPreferHintedType(currentType: EventType, hintedType: EventType): boolean {
  // Prefer hinted type if current is generic
  const genericTypes = new Set<EventType>(["otro", "club", "bar"]);
  if (genericTypes.has(currentType)) {
    return true;
  }
  return false;
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
