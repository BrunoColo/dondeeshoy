import * as cheerio from "cheerio";

import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import { extractBestImageUrl, extractMoneyValues, normalizeWhitespace, unique } from "./utils";

// ────────────────────────────────────────────────────────────────────────────
// Filters — aggressively exclude non-public, non-Uruguay, club/membership
// entries and duplicate pricing tiers that TicketFácil/accesofacil publishes.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Title patterns that indicate this is NOT a real public event.
 * Tested against both the API `name` and the scraped `<h1>`.
 */
const EXCLUDED_TITLE_RE = [
  // ── Club memberships / socios ──
  /\bsocios?\b/i,
  /\bclub balneario\b/i,
  /\bmembres[ií]a\b/i,
  /\bafiliaci[oó]n\b/i,

  // ── Registration fees / partial payments / pricing duplicates ──
  /\blicencia federativa\b/i,
  /\bsaldo de inscripci[oó]n\b/i,
  /\breserva de inscripci[oó]n\b/i,
  /\breserv[aá] tu carpa\b/i,
  /\bextranjeros\b/i,

  // ── Corporate / private events ──
  /\bcocktail party\b/i,
  /\bseminario global de inversiones\b/i,
  /\bcongreso anacer\b/i,
  /\bfiesta del centenario.*publicis\b/i,
  /\btendencias\s+\d{4}\b/i,

  // ── Explicitly NOT in Uruguay ──
  /\bpodcast days\b/i,

  // ── By-invitation / VIP-only entries ──
  /\bgala del tour\b/i,
  /\bconferencia del tour\b/i,
  /\bexperiencia vip\b/i,

  // ── Online-only / not a gatherable event ──
  /\bwebinar\b/i,

  // ── Generic non-event keywords ──
  /\bslarp\b/i,
];

/**
 * Title keywords that strongly suggest the event is outside Uruguay.
 * Checked against the combined title + organizer string, BUT only when the
 * title does NOT look like a sports match ("Uruguay - <opponent>").
 */
const EXCLUDED_TITLE_LOCATION_RE = [
  /\bargentina\b/i,
  /\bmadrid\b/i,
  /\bbarcelona\b/i,
  /\bmallorca\b/i,
  /\bpalma\b/i,
  /\bbogot[aá]\b/i,
  /\blima\b/i,
  /\bsantiago de chile\b/i,
];

/** Matches sports-match titles like "Uruguay - Argentina", "Uruguay - Perú" */
const SPORTS_MATCH_RE = /^uruguay\s*[-–—vs.]+\s*/i;

/**
 * Venue / location strings that indicate the event is outside Uruguay.
 */
const EXCLUDED_VENUE_RE = [
  /\bla rural\b/i,
  /\bfour seasons\b/i,
  /\bespacio movistar\b/i,
  /\bhotel meli[aá]\b/i,
  /\bmadrid\b/i,
  /\bargentina\b/i,
  /\bbuenos aires\b/i,
  /\bcaba\b/i,
  /\bpalma marina\b/i,
  /\bpalma de mallorca\b/i,
  /\boh my club\b/i,
];

/**
 * Organizer names that almost always produce non-public or non-Uruguay events.
 */
const EXCLUDED_ORGANIZER_RE = [
  /\bpublicis groupe\b/i,
  /\bcoca-cola argentina\b/i,
  /\banacer\b/i,
  /\bgrandstocker\b/i,
];

/** Spanish full month name → zero-padded month number */
const MONTH_MAP: Record<string, string> = {
  enero: "01",      febrero: "02",    marzo: "03",     abril: "04",
  mayo: "05",       junio: "06",      julio: "07",     agosto: "08",
  septiembre: "09", octubre: "10",    noviembre: "11", diciembre: "12",
};

/** Shape of each item returned by the accesofacil events search API */
interface AccesofacilEvent {
  id: string;
  name: string;
  location: string;
  organizer: string;
  link: string; // e.g. "Bienvenidos-a-SLARP/registerToEvent/"
}

/**
 * Scraper for ticketfacil.uy — Uruguay's events ticketing platform.
 * Powered by accesofacil.com backend.
 *
 * Strategy:
 *  1. Discover events from the accesofacil REST API (`restApi/eventsForSearch/w`).
 *     The listing page renders event cards client-side via JavaScript, so a plain
 *     HTTP fetch returns an empty shell — the API is the reliable source.
 *  2. **Pre-filter aggressively** at the API stage using title, location & organizer
 *     to discard memberships, non-Uruguay events, corporate/private events and
 *     duplicate pricing tiers before making any HTTP requests.
 *  3. Scrape each event's `/info/` page (NOT `/registerToEvent/`) — the info page
 *     consistently contains date, time, venue and description.
 *  4. Apply secondary HTML-level filters (por invitación, missing dates, etc.).
 */
export class TicketFacilScraper extends BaseScraper {
  /** Cache API metadata keyed by the /info/ page URL we'll scrape */
  private apiCache = new Map<string, AccesofacilEvent>();

  constructor() {
    super("ticketfacil");
  }

  // ─── Discover ───────────────────────────────────────────────────────────────

  protected async discoverUrls(): Promise<string[]> {
    const res = await fetch(
      "https://accesofacil.com/restApi/eventsForSearch/w",
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
          accept: "application/json",
          referer: "https://ticketfacil.uy/eventos/",
        },
        signal: AbortSignal.timeout(scraperConfig.timeoutMs),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      throw new Error(`[ticketfacil] API returned HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      status: string;
      events?: AccesofacilEvent[];
    };

    if (json.status !== "success" || !Array.isArray(json.events)) {
      throw new Error(
        `[ticketfacil] Unexpected API response: ${JSON.stringify(json).slice(0, 200)}`,
      );
    }

    console.log(
      `[ticketfacil] API returned ${json.events.length} raw events — pre-filtering…`,
    );

    const urls: string[] = [];

    for (const event of json.events) {
      const name = normalizeWhitespace(event.name);
      const location = normalizeWhitespace(event.location);
      const organizer = normalizeWhitespace(event.organizer);

      // ── Pre-filter: title ──
      if (this.isExcludedTitle(name)) {
        console.log(`[ticketfacil] PRE-SKIP (title): "${name}"`);
        continue;
      }

      // ── Pre-filter: title + organizer → foreign location keywords ──
      // Skip this check for sports-match titles like "Uruguay - Argentina"
      const titleOrgCombo = `${name} ${organizer}`;
      if (
        !SPORTS_MATCH_RE.test(name) &&
        EXCLUDED_TITLE_LOCATION_RE.some((re) => re.test(titleOrgCombo))
      ) {
        console.log(
          `[ticketfacil] PRE-SKIP (foreign in title/org): "${name}" [${organizer}]`,
        );
        continue;
      }

      // ── Pre-filter: venue ──
      if (this.isExcludedVenue(location)) {
        console.log(
          `[ticketfacil] PRE-SKIP (venue): "${name}" @ "${location}"`,
        );
        continue;
      }

      // ── Pre-filter: organizer ──
      if (EXCLUDED_ORGANIZER_RE.some((re) => re.test(organizer))) {
        console.log(
          `[ticketfacil] PRE-SKIP (organizer): "${name}" by "${organizer}"`,
        );
        continue;
      }

      // Always use the /info/ page — it has date, time, venue and description.
      // The API link can be either ".../registerToEvent/" or ".../info/".
      const slug = event.link.replace(/\/(registerToEvent|info)\/?$/, "");
      const infoUrl = `https://accesofacil.com/${slug}/info/`;
      this.apiCache.set(infoUrl, event);
      urls.push(infoUrl);
    }

    console.log(
      `[ticketfacil] ${urls.length} events remain after pre-filtering`,
    );
    return unique(urls);
  }

  // ─── Scrape individual event ─────────────────────────────────────────────────

  protected async scrapeEvent(
    sourceUrl: string,
  ): Promise<ScrapedRawEvent | null> {
    const apiEvent = this.apiCache.get(sourceUrl);

    let html: string;
    try {
      const res = await fetch(sourceUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
          referer: "https://accesofacil.com/",
        },
        signal: AbortSignal.timeout(scraperConfig.timeoutMs),
        cache: "no-store",
      });

      if (!res.ok) {
        console.log(`[ticketfacil] SKIP (HTTP ${res.status}): ${sourceUrl}`);
        return null;
      }

      html = await res.text();
    } catch {
      console.log(`[ticketfacil] SKIP (fetch error): ${sourceUrl}`);
      return null;
    }

    const $ = cheerio.load(html);

    // ── Event ID — used for image URL and sourceId ──
    const eventIdMatch = html.match(/let\s+eventId\s*=\s*(\d+)/);
    const eventId = eventIdMatch?.[1] ?? apiEvent?.id ?? null;
    if (!eventId) {
      console.log(`[ticketfacil] SKIP (no eventId): ${sourceUrl}`);
      return null;
    }

    const sourceId = eventId;

    // ── Title ──
    const title = normalizeWhitespace(
      $("h1.eventTitle").first().text() ||
        $("h1").first().text() ||
        apiEvent?.name ||
        "",
    );

    if (!title || title === "Inscripción/Registro") {
      console.log(`[ticketfacil] SKIP (no title): ${sourceUrl}`);
      return null;
    }

    // ── Second-pass title filter (HTML title may differ from API name) ──
    if (this.isExcludedTitle(title)) {
      console.log(`[ticketfacil] SKIP (title filter): "${title}"`);
      return null;
    }

    // ── Full page text for keyword checks ──
    const fullPageText = normalizeWhitespace($.root().text());

    // ── "Por Invitación" — not open to the general public ──
    if (
      /por invitaci[oó]n/i.test(fullPageText) &&
      !/precio|entrada|comprar|gratis|sin cargo/i.test(fullPageText)
    ) {
      console.log(`[ticketfacil] SKIP (by-invitation): "${title}"`);
      return null;
    }

    // ── Date and Time ──
    // The /info/ page has structured paragraphs with class "detailItem".
    // Pattern 1: "📆 Fecha: 19 de febrero de 2026"
    // Pattern 2: "📆 Fecha: 27 al 28 de febrero de 2026" (date range)
    const detailTexts = $("p.detailItem")
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get();
    const dateTimeBlock = detailTexts.join(" ");

    let rawDateText: string | null = null;

    // Try range formats first:
    // 1) "27 al 28 de febrero de 2026"
    // 2) "2 de enero al 28 de febrero de 2026"
    // 3) "2 de enero de 2026 al 28 de febrero de 2026"
    const rangeSameMonth = dateTimeBlock.match(
      /Fecha:\s*(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    );
    const rangeCrossMonth = dateTimeBlock.match(
      /Fecha:\s*(\d{1,2})\s+de\s+(\w+)\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    );
    const rangeWithYearBoth = dateTimeBlock.match(
      /Fecha:\s*(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    );

    if (rangeWithYearBoth) {
      const [, day, monthName, year] = rangeWithYearBoth;
      const month = MONTH_MAP[monthName.toLowerCase()];
      if (month) {
        rawDateText = `${year}-${month}-${day.padStart(2, "0")}`;
      }
    } else if (rangeCrossMonth) {
      const [, day, monthName, , , year] = rangeCrossMonth;
      const month = MONTH_MAP[monthName.toLowerCase()];
      if (month) {
        rawDateText = `${year}-${month}-${day.padStart(2, "0")}`;
      }
    } else if (rangeSameMonth) {
      const [, day, , monthName, year] = rangeSameMonth;
      const month = MONTH_MAP[monthName.toLowerCase()];
      if (month) {
        rawDateText = `${year}-${month}-${day.padStart(2, "0")}`;
      }
    }

    // Try single-date format: "19 de febrero de 2026"
    if (!rawDateText) {
      const singleMatch = dateTimeBlock.match(
        /Fecha:\s*(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
      );
      if (singleMatch) {
        const [, day, monthName, year] = singleMatch;
        const month = MONTH_MAP[monthName.toLowerCase()];
        if (month) {
          rawDateText = `${year}-${month}-${day.padStart(2, "0")}`;
        }
      }
    }

    const startTimeMatch = dateTimeBlock.match(
      /Inicio\s+(\d{1,2}:\d{2})\s*hs/i,
    );
    const endTimeMatch = dateTimeBlock.match(/Fin\s+(\d{1,2}:\d{2})\s*hs/i);
    const rawStartTime = startTimeMatch?.[1] ?? null;
    const rawEndTime = endTimeMatch?.[1] ?? null;

    // ── Venue — look for the 📍 detail item ──
    const venueDetail = detailTexts.find((t) => /📍/.test(t) || /ubicaci[oó]n/i.test(t));
    // Strip leading non-letter characters (emoji, whitespace)
    const rawVenue =
      venueDetail?.replace(/^[^\w\dA-Za-záéíóúüñÁÉÍÓÚÜÑ"'(]+/, "").trim() ||
      apiEvent?.location ||
      "";

    if (this.isExcludedVenue(rawVenue)) {
      console.log(
        `[ticketfacil] SKIP (non-UY venue: "${rawVenue}"): "${title}"`,
      );
      return null;
    }

    // ── Image ──
    const imageUrl = this.extractImageUrl($, sourceUrl, sourceId);

    // ── Prices — fetch the /registerToEvent/ page for structured price data ──
    // The /info/ page has no price table; prices live on the purchase page
    // inside <span initPrice="NNN"> attributes.
    const prices = await this.fetchPricesFromRegisterPage(sourceUrl);
    const isFreeText = /gratis|entrada libre|free|sin cargo/i.test(fullPageText);

    // ── Description ──
    // The /info/ page has descriptive content after the detail items.
    // Try multiple selectors; fall back to gathering text from body sections.
    let rawDesc = normalizeWhitespace(
      $("span.description").text() ||
        $(".eventDescription").text() ||
        "",
    );
    // If no explicit description container, grab body text after detail items
    if (!rawDesc) {
      const bodyParagraphs: string[] = [];
      $("p, div")
        .not(".detailItem")
        .each((_, el) => {
          const t = normalizeWhitespace($(el).text());
          if (
            t.length > 30 &&
            !/Comenzar[aá]|Evento organizado|Contacto|Agregar Al Calendario|Logo|haz click/i.test(t)
          ) {
            bodyParagraphs.push(t);
          }
        });
      if (bodyParagraphs.length > 0) {
        rawDesc = bodyParagraphs.slice(0, 3).join(" ").slice(0, 500);
      }
    }
    const description =
      rawDesc && !rawDesc.toLowerCase().includes("haz click") ? rawDesc : null;

    // Build the public-facing URL
    const publicUrl = sourceUrl;

    return {
      source: "ticketfacil",
      sourceId,
      sourceUrl: publicUrl,
      rawData: {
        title,
        description,
        dateText: rawDateText,
        startTime: rawStartTime,
        endTime: rawEndTime,
        venueName: rawVenue || null,
        venueAddress: null,
        imageUrl,
        prices,
        isFreeText,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private isExcludedTitle(title: string): boolean {
    return EXCLUDED_TITLE_RE.some((re) => re.test(title));
  }

  private isExcludedVenue(venue: string): boolean {
    if (!venue) return false;
    return EXCLUDED_VENUE_RE.some((re) => re.test(venue));
  }

  /**
   * Fetch the /registerToEvent/ page and extract prices from the structured
   * HTML `initPrice` attributes on ticket rows. This avoids the old approach
   * of parsing `$('table').text()` which mixed in quantity dropdown values.
   */
  private async fetchPricesFromRegisterPage(
    infoUrl: string,
  ): Promise<number[]> {
    // Convert /info/ URL → /registerToEvent/ URL
    const registerUrl = infoUrl.replace(/\/info\/$/, "/registerToEvent/");

    try {
      const res = await fetch(registerUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
          referer: "https://accesofacil.com/",
        },
        signal: AbortSignal.timeout(scraperConfig.timeoutMs),
        cache: "no-store",
      });

      if (!res.ok) return [];

      const html = await res.text();

      const prices: number[] = [];

      // Extract prices from initPrice="NNN" attributes on price spans
      const initPriceMatches = html.matchAll(/initPrice="(\d+(?:\.\d+)?)"/g);
      for (const m of initPriceMatches) {
        const v = Number.parseFloat(m[1]);
        if (Number.isFinite(v) && v > 0 && v < 1_000_000) {
          prices.push(Math.round(v));
        }
      }

      // Extract prices from visible price cells (fallback for cases without initPrice)
      const $ = cheerio.load(html);
      $(".ticketTypeRowPrice, td.ticketTypeRowPrice").each((_, el) => {
        const text = normalizeWhitespace($(el).text());
        prices.push(...extractMoneyValues(text));
      });

      // Some pages include data-price attributes
      $("[data-price]").each((_, el) => {
        const raw = $(el).attr("data-price") ?? "";
        const normalized = raw.replace(/[^\d]/g, "");
        const v = Number.parseInt(normalized, 10);
        if (Number.isFinite(v) && v > 0 && v < 1_000_000) {
          prices.push(v);
        }
      });

      const uniquePrices = unique(prices.filter((v) => Number.isFinite(v) && v > 0));
      // Ticketfacil sometimes leaks the qty selector value ("1"). Treat it as noise.
      const cleaned = uniquePrices.filter((v) => v > 1);

      return cleaned;
    } catch {
      console.log(`[ticketfacil] Could not fetch prices from ${registerUrl}`);
      return [];
    }
  }

  private extractImageUrl(
    $: cheerio.CheerioAPI,
    baseUrl: string,
    sourceId: string,
  ): string {
    const imageUrl = extractBestImageUrl($, baseUrl, [
      "img[src*='eventLittleImg']",
      "img[src*='eventBigImg']",
      "img[src*='eventImg']",
      "img[alt*='Imagen de portada']",
      "img[src*='/images/acceso/events/images/']",
      "img",
    ]);

    if (imageUrl) return imageUrl;

    const base = `https://accesofacil.com/images/acceso/events/images/${sourceId}`;
    // Fallback to known asset path (PNG is most common; JPEG is a backup)
    return `${base}/eventLittleImg.png`;
  }
}
