import type { RawEvent } from "@/lib/db/schema";
import { getOpenAIClient } from "./ai-client";

export interface NormalizedEventInput {
  name: string;
  slug: string;
  description: string | null;
  scheduleText: string | null;
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

  const dateText = sanitizeText((rawData.dateText as string) ?? "");
  const parsedDate = parseUruguayDateTime(dateText);
  const aiResolvedDate =
    parsedDate.wasFallback && dateText
      ? await resolveDateWithAi(dateText)
      : null;

  const date = aiResolvedDate?.date ?? parsedDate.date;
  // Use explicit startTime from raw data if the parser couldn't extract one
  const rawStartTime = sanitizeText((rawData.startTime as string) ?? "");
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

  // Only mark as free if the text explicitly says so, never from price data alone
  const bodyText = sanitizeText(
    `${(rawData.title as string) ?? ""} ${(rawData.description as string) ?? ""} ${(rawData.dateText as string) ?? ""}`,
  ).toLowerCase();
  const isFree =
    prices.length === 0 &&
    /\b(gratis|entrada libre|free|sin cargo|sin costo)\b/i.test(bodyText);

  // Use pre-extracted coordinates from scrapers that provide them (e.g., CobraTicket)
  const rawLatitude = typeof rawData.latitude === "number" ? rawData.latitude : null;
  const rawLongitude = typeof rawData.longitude === "number" ? rawData.longitude : null;

  return {
    name,
    slug: slugify(name),
    description,
    scheduleText: dateText || null,
    date,
    startTime,
    endTime,
    venueName,
    venueAddress,
    city: "Montevideo",
    imageUrl: sanitizeText((rawData.imageUrl as string) ?? "") || null,
    ticketUrl: rawEvent.sourceUrl,
    priceMin,
    priceMax,
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

  // Try YYYY-MM-DD format
  const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
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

    const validDate = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date);
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
    .map((price) => (typeof price === "number" ? price : Number.parseInt(String(price), 10)))
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
  return value.replace(/\s+/g, " ").trim();
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
