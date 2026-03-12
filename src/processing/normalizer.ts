import type { RawEvent } from "@/lib/db/schema";
import { getOpenAIClient } from "./ai-client";
import { detectDepartment } from "./department-detector";

export interface NormalizedEventInput {
  name: string;
  slug: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string;
  venueAddress: string | null;
  city: string;
  imageUrl: string | null;
  ticketUrl: string;
  priceMin: number | null;
  priceMax: number | null;
  currency: "UYU" | "USD";
  isFree: boolean;
  ageRestriction: number | null;
  latitude: number | null;
  longitude: number | null;
}

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export async function normalizeRawEvent(rawEvent: RawEvent): Promise<NormalizedEventInput> {
  const rawData = rawEvent.rawData as Record<string, unknown>;

  const name = sanitizeText((rawData.title as string) ?? "");
  const description = sanitizeText((rawData.description as string) ?? "") || null;

  if (!name) {
    throw new Error("No se pudo normalizar el nombre del evento");
  }

  // ── MiEntrada stores dates as an array (rawData.dates: string[]).
  // Pick the first element and use it as dateText when the standard field is missing.
  const rawDatesArray = Array.isArray(rawData.dates) ? (rawData.dates as string[]) : null;
  const rawDateIso = sanitizeText((rawData.dateIso as string) ?? "");
  const rawDateText = sanitizeText((rawData.dateText as string) ?? "");
  const rawSearchDateText = sanitizeText((rawData.searchDateText as string) ?? "");

  // If the scraper already provides a valid ISO date (YYYY-MM-DD), use it directly
  // instead of feeding it through the Spanish date parser where DD/MM/YY regex can misinterpret it.
  // NOTE: Check both rawDateIso AND rawDateText, since some scrapers (entraste, cobraticket)
  // send ISO format strings in dateText fields instead of dedicated dateIso fields.
  
  // Validate and extract ISO dates - must be valid calendar dates and reasonable year (2026-2027)
  const validateIsoDate = (isoStr: string | null): string | null => {
    if (!isoStr) return null;
    const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    
    // Only accept years 2026-2027; reject any other century (2001, 2011, 2024, 2025, 2028+, etc.)
    if (year < 2026 || year > 2027) return null;
    
    // Basic calendar validation
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    
    // Additional check: confirm the date is valid (e.g., Feb 30 is not valid)
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
      return null;
    }
    
    return `${year}-${match[2]}-${match[3]}`;
  };
  
  const isoDateDirect = validateIsoDate(rawDateIso);
  const isoDateTextDirect = validateIsoDate(rawDateText);

  // dateText is for the human-readable string parser — prefer rawDateText over rawDateIso
  const dateText = rawDateText || rawSearchDateText || (rawDatesArray?.[0] ? sanitizeText(rawDatesArray[0]) : "") || rawDateIso;

  // Always try to parse date from the event title/name - many scrapers put the date in the title
  // like "EVENT NAME - Viernes 20/02/26" but only put generic text in dateText like "VIERNES DE EVENT"
  const dateFromName = parseUruguayDateTime(name);
  const dateFromDescription = parseUruguayDateTime(description ?? "");
  
  // Try to parse date from dateText first
  let parsedDate = parseUruguayDateTime(dateText);
  
  // If dateText didn't have a valid date OR if the name has a better date, use that
  if (dateFromName.wasFallback === false && parsedDate.wasFallback === true) {
    // Name has a valid date but dateText doesn't - use name's date
    parsedDate = dateFromName;
    console.log('[NORMALIZER] Using date from name:', parsedDate.date);
  } else if (!dateFromName.wasFallback && !parsedDate.wasFallback) {
    // Both have dates - prefer the one from name if it's more specific (has actual numbers)
    // This is a heuristic: title dates like "20/02/26" are usually more accurate than scraped dateText
    parsedDate = dateFromName;
  }

  if (parsedDate.wasFallback && !dateFromDescription.wasFallback) {
    parsedDate = dateFromDescription;
    console.log('[NORMALIZER] Using date from description:', parsedDate.date);
  }
  
  const aiResolvedDate =
    parsedDate.wasFallback && dateText
      ? await resolveDateWithAi(dateText)
      : null;

  // Prefer the direct ISO date from the scraper (from either dateIso or dateText field),
  // then AI resolution, then parsed date from human-readable text.
  // isoDateDirect prioritized first, then isoDateTextDirect (so scraper-provided dateIso field wins over scraped dateText field)
  const date = isoDateDirect ?? isoDateTextDirect ?? aiResolvedDate?.date ?? parsedDate.date;
  // Use explicit startTime from raw data if the parser couldn't extract one
  const rawStartTime =
    sanitizeText((rawData.startTime as string) ?? "") ||
    sanitizeText((rawData.aperturaTime as string) ?? "");
  const parsedStartTime = aiResolvedDate?.startTime ?? parsedDate.startTime;
  const startTime = parsedStartTime ?? normalizeTimeString(rawStartTime);

  // Use explicit endTime from raw data if provided (e.g., CobraTicket)
  const rawEndTime = sanitizeText((rawData.endTime as string) ?? "");
  const endTime = normalizeTimeString(rawEndTime);

  const venueNameCandidate = sanitizeText((rawData.venueName as string) ?? "");
  const venueTextCandidate = sanitizeText((rawData.venueText as string) ?? "");
  const venueName = cleanVenueName(venueNameCandidate || venueTextCandidate) || "Venue por confirmar";

  // Prefer explicit venueAddress; for RedTickets also check rawData.venueAddress
  const venueAddress = cleanVenueAddress(
    sanitizeText((rawData.venueAddress as string) ?? "")
  ) || null;

  const prices = normalizePrices(rawData.prices);
  const priceMin = prices.length > 0 ? Math.min(...prices) : null;
  const priceMax = prices.length > 0 ? Math.max(...prices) : null;

  // Mark as free if: scraper explicitly says so, OR text says free + no prices.
  // NOTE: TicketFacil stores this as rawData.isFreeText (not rawData.isFree) —
  // we read both to avoid missing free events from that source.
  const bodyText = sanitizeText(
    `${(rawData.title as string) ?? ""} ${(rawData.description as string) ?? ""} ${(rawData.dateText as string) ?? ""} ${(rawData.searchDateText as string) ?? ""}`,
  ).toLowerCase();
  const scraperSaysIsFree = rawData.isFree === true || rawData.isFreeText === true;
  const textSaysFree = /\b(gratis|entrada libre|free|sin cargo|sin costo)\b/i.test(bodyText);
  const isFree =
    scraperSaysIsFree || (prices.length === 0 && textSaysFree);

  const hasUsdHint = /\b(usd|u\$s|us\$|d[oó]lar(?:es)?)\b/i.test(bodyText);
  const currency = hasUsdHint ? "USD" : "UYU";

  // Use pre-extracted coordinates from scrapers that provide them.
  // CobraTicket / RedTickets / TicketFacil use rawData.latitude / rawData.longitude.
  // MiEntrada uses rawData.lat / rawData.lng — support both field names.
  const rawLatitude =
    typeof rawData.latitude === "number"
      ? rawData.latitude
      : typeof rawData.lat === "number"
        ? rawData.lat
        : null;
  const rawLongitude =
    typeof rawData.longitude === "number"
      ? rawData.longitude
      : typeof rawData.lng === "number"
        ? rawData.lng
        : null;

  // Detect the Uruguay department from venue/address/city/name data.
  // CobraTicket provides a `city` field (e.g. "Punta del Este, Maldonado").
  // MiEntrada provides a `department` field directly (e.g. "Montevideo").
  // Other scrapers rely on venue name + address detection.
  const scraperCity =
    sanitizeText((rawData.city as string) ?? "") ||
    sanitizeText((rawData.department as string) ?? "") ||
    null;
  const department = detectDepartment(
    venueName !== "Venue por confirmar" ? venueName : null,
    venueAddress,
    scraperCity,
    name,
    rawLatitude,
    rawLongitude,
  );

  return {
    name,
    slug: slugify(name),
    description,
    date,
    startTime,
    endTime,
    venueName,
    venueAddress,
    city: department,
    imageUrl: sanitizeText((rawData.imageUrl as string) ?? "") || null,
    ticketUrl: rawEvent.sourceUrl,
    priceMin,
    priceMax,
    currency,
    isFree,
    ageRestriction: typeof rawData.ageRestriction === "number" ? rawData.ageRestriction : null,
    latitude: rawLatitude,
    longitude: rawLongitude,
  };
}

export function calculateConfidenceScore(normalized: NormalizedEventInput): string {
  let score = 0;

  if (normalized.date) score += 0.2;
  if (normalized.startTime) score += 0.2;
  if (normalized.venueName && normalized.venueName !== "Venue por confirmar") score += 0.2;
  if (normalized.priceMin !== null || normalized.isFree) score += 0.2;
  if (normalized.imageUrl) score += 0.1;
  score += 0.1;

  return Math.min(1, score).toFixed(2);
}

function parseUruguayDateTime(value: string): { date: string; startTime: string | null; wasFallback: boolean } {
  const now = new Date();

  // Try DD/MM/YYYY format first (used by MVD Eventos)
  const ddmmMatch = value.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (ddmmMatch) {
    const day = Number.parseInt(ddmmMatch[1], 10);
    const month = Number.parseInt(ddmmMatch[2], 10);
    const year = Number.parseInt(ddmmMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:hs?)?/i);
      let startTime: string | null = null;
      if (timeMatch) {
        const hour = Number.parseInt(timeMatch[1], 10);
        const minute = Number.parseInt(timeMatch[2] ?? "0", 10);
        startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
      }
      return { date, startTime, wasFallback: false };
    }
  }

  // Try YYYY-MM-DD format (must come before DD/MM/YY to avoid misinterpreting ISO dates)
  const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      const date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:hs?)?/i);
      let startTime: string | null = null;
      if (timeMatch) {
        const hour = Number.parseInt(timeMatch[1], 10);
        const minute = Number.parseInt(timeMatch[2] ?? "0", 10);
        startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
      }
      return { date, startTime, wasFallback: false };
    }
  }

  // Try DD/MM/YY format (2-digit year, e.g. "21/02/26" for 2026)
  const ddmmShortMatch = value.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})(?!\d)/);
  if (ddmmShortMatch) {
    const day = Number.parseInt(ddmmShortMatch[1], 10);
    const month = Number.parseInt(ddmmShortMatch[2], 10);
    const shortYear = Number.parseInt(ddmmShortMatch[3], 10);
    const year = shortYear >= 0 && shortYear <= 99 ? 2000 + shortYear : shortYear;
    if (isValidCalendarDate(year, month, day)) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:hs?)?/i);
      let startTime: string | null = null;
      if (timeMatch) {
        const hour = Number.parseInt(timeMatch[1], 10);
        const minute = Number.parseInt(timeMatch[2] ?? "0", 10);
        startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
      }
      return { date, startTime, wasFallback: false };
    }
  }

  // Try DD/MM format without year (common in RedTickets labels like 11/03)
  const ddmmNoYearMatch = value.match(/(\d{1,2})[/\-.](\d{1,2})(?![/\-.]\d)/);
  if (ddmmNoYearMatch) {
    const day = Number.parseInt(ddmmNoYearMatch[1], 10);
    const month = Number.parseInt(ddmmNoYearMatch[2], 10);

    let year = now.getFullYear();
    const candidate = new Date(Date.UTC(year, month - 1, day));
    const daysDiff = (candidate.getTime() - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000;

    if (daysDiff < -30) {
      year += 1;
    }

    if (isValidCalendarDate(year, month, day)) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:hs?)?/i);
      let startTime: string | null = null;
      if (timeMatch) {
        const hour = Number.parseInt(timeMatch[1], 10);
        const minute = Number.parseInt(timeMatch[2] ?? "0", 10);
        startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
      }
      return { date, startTime, wasFallback: false };
    }
  }

  const dateMatch = value.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i);

  if (!dateMatch) {
    const fallbackDate = formatDate(now);
    return { date: fallbackDate, startTime: null, wasFallback: true };
  }

  const day = Number.parseInt(dateMatch[1], 10);
  const monthText = normalizeSpanish(dateMatch[2]);
  const month = MONTHS[monthText] ?? now.getMonth() + 1;

  let year = now.getFullYear();
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const daysDiff = (candidate.getTime() - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000;

  // If the date is more than 30 days in the past, it likely refers to next year
  if (daysDiff < -30) {
    year += 1;
  }

  if (!isValidCalendarDate(year, month, day)) {
    const fallbackDate = formatDate(now);
    return { date: fallbackDate, startTime: null, wasFallback: true };
  }

  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Try time after "-", "a las", or standalone HH:MM
  const timeMatch = value.match(/(?:[-–]\s*|a\s+las\s+)?(\d{1,2}):(\d{2})\s*(?:hs?)?/i);
  if (!timeMatch) {
    return { date, startTime: null, wasFallback: false };
  }

  const hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2] ?? "0", 10);
  const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

  return { date, startTime, wasFallback: false };
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

async function resolveDateWithAi(
  dateText: string,
): Promise<{ date: string; startTime: string | null } | null> {
  try {
    const client = getOpenAIClient();
    const now = formatDate(new Date());

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content:
            "Sos un normalizador de fechas de eventos en Uruguay. Respondé JSON puro con campos date y startTime. date en formato YYYY-MM-DD o null. startTime en HH:mm:ss o null.",
        },
        {
          role: "user",
          content: `Fecha original: \"${dateText}\". Fecha actual de referencia: ${now}.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content) as {
      date?: string | null;
      startTime?: string | null;
    };

    const validDate =
      typeof parsed.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) &&
      (() => {
        const [year, month, day] = parsed.date.split("-").map((part) => Number.parseInt(part, 10));
        return isValidCalendarDate(year, month, day);
      })();
    const validTime =
      typeof parsed.startTime === "string" && /^\d{2}:\d{2}:\d{2}$/.test(parsed.startTime);

    if (!validDate) {
      return null;
    }

    return {
      date: parsed.date!,
      startTime: validTime ? parsed.startTime! : null,
    };
  } catch {
    return null;
  }
}

function normalizePrices(pricesRaw: unknown): number[] {
  if (!Array.isArray(pricesRaw)) {
    return [];
  }

  return pricesRaw
    .map((price) => {
      const num = typeof price === "number" ? price : Number.parseFloat(String(price));
      // Round to integer — DB column is integer
      return Number.isFinite(num) ? Math.round(num) : NaN;
    })
    .filter((price) => Number.isFinite(price) && price > 0);
}

/**
 * Strip junk text that gets appended to venue names from scraping.
 * Cuts at known boundary words like "Ubicación", "Ver flyer", "Tickets", etc.
 */
function cleanVenueName(raw: string): string {
  if (!raw) return "";

  const cutPatterns = [
    /\s*Ubicaci[oó]n\s*:.*/i,
    /\s*Ver flyer.*/i,
    /\s*Tickets.*/i,
    /\s*Informaci[oó]n.*/i,
    /\s*Eleg[ií]\s+tu.*/i,
    /\s*Precio.*/i,
    /\s*Tanda\s+\d.*/i,
  ];

  let cleaned = raw;
  for (const pattern of cutPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

/**
 * Strip junk text from venue addresses.
 */
function cleanVenueAddress(raw: string): string {
  if (!raw) return "";

  const cutPatterns = [
    /\s*Ver flyer.*/i,
    /\s*Tickets.*/i,
    /\s*Informaci[oó]n.*/i,
    /\s*Eleg[ií]\s+tu.*/i,
  ];

  let cleaned = raw;
  for (const pattern of cutPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")     // Strip HTML tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSpanish(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugify(value: string): string {
  return normalizeSpanish(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Normalize a time string like "20:00" or "21:30hs" into HH:mm:ss format.
 * Returns null if the input is empty or unparseable.
 */
function normalizeTimeString(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:hs?)?/i);
  if (!m) return null;
  const hour = Number.parseInt(m[1], 10);
  const minute = Number.parseInt(m[2] ?? "0", 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}
