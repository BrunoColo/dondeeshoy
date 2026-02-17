import * as cheerio from "cheerio";

import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import { fetchHtml, normalizeWhitespace, unique } from "./utils";

/** Extracts the numeric event ID from accesofacil image URLs */
const EVENT_ID_FROM_IMG = /\/images\/acceso\/events\/images\/(\d+)\//;

/**
 * Title patterns that indicate this is NOT a real public event:
 * memberships, registrations, partial payments, private corporate events, etc.
 */
const EXCLUDED_TITLE_RE = [
  /\bsocios\b/i,                          // club memberships
  /\blicencia federativa\b/i,            // sports federation licenses
  /\bsaldo de inscripci[oó]n\b/i,        // "balance of registration fee"
  /\breserva de inscripci[oó]n\b/i,      // "registration reservation"
  /\breserv[aá] tu carpa\b/i,            // "reserve your tent"
  /\bcocktail party\b/i,                 // private corporate events
  /\bseminario global de inversiones\b/i,
  /\bcongreso anacer\b/i,
  /\bpodcast days\b/i,                   // held in Madrid
  /\bfiesta del centenario.*publicis\b/i, // corporate party
  /\bgala del tour\b/i,                  // by invitation only
  /\bconferencia del tour\b/i,           // by invitation only
  /\bexperiencia vip\b/i,               // VIP / by invitation
  /\bwebinar\b/i,
  /\bformaci[oó]n\b/i,
];

/**
 * Venue/location words that indicate the event is outside Uruguay.
 * TicketFácil sometimes lists Argentine or European events.
 */
const EXCLUDED_VENUE_RE = [
  /la rural/i,            // Buenos Aires expo venue
  /four seasons/i,        // Buenos Aires hotel
  /espacio movistar/i,    // Madrid arena
  /hotel meli[aá]/i,      // Mallorca
  /madrid/i,
  /\bargentina\b/i,
  /buenos aires/i,
  /rosario.*argentina/i,
];

/** Spanish month abbreviation → zero-padded month number (used for date parsing) */
const MONTH_ABBR: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
};

/**
 * Scraper for ticketfacil.uy — Uruguay's sports & endurance events ticketing platform.
 * Powered by accesofacil.com backend.
 *
 * Strategy:
 *  1. Discover event IDs from the listing page (image URL patterns + `<a>` hrefs).
 *  2. Scrape each individual event page for structured data.
 *  3. Filter hard to exclude: memberships, private events, non-Uruguay venues,
 *     "by invitation" events, and partial payment entries.
 */
export class TicketFacilScraper extends BaseScraper {
  constructor() {
    super("ticketfacil");
  }

  // ─── Discover ───────────────────────────────────────────────────────────────

  protected async discoverUrls(): Promise<string[]> {
    const html = await fetchHtml(scraperConfig.ticketfacilListUrl);
    const $ = cheerio.load(html);

    const ids = new Set<string>();

    // Primary: event IDs embedded in accesofacil CDN image URLs
    $("img[src*='accesofacil.com/images/acceso/events/images']").each((_, el) => {
      const src = $(el).attr("src") ?? "";
      const match = src.match(EVENT_ID_FROM_IMG);
      if (match?.[1]) ids.add(match[1]);
    });

    // Secondary: explicit `<a>` links (some layouts include these)
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      // Matches /eventos/123 or /eventos/e/123 style paths
      const match = href.match(/\/eventos\/(?:e\/)?(\d+)/);
      if (match?.[1]) ids.add(match[1]);
    });

    console.log(`[ticketfacil] Discovered ${ids.size} event IDs from listing`);

    // Try two common URL patterns for individual event pages on accesofacil platforms:
    //   /eventos/{id}  and  /eventos/e/{id}
    // We'll try the first; if it 404s, scrapeEvent returns null gracefully.
    return unique([...ids].map((id) => `${scraperConfig.ticketfacilBaseUrl}/eventos/${id}`));
  }

  // ─── Scrape individual event ─────────────────────────────────────────────────

  protected async scrapeEvent(sourceUrl: string): Promise<ScrapedRawEvent | null> {
    const idMatch = sourceUrl.match(/\/eventos\/(?:e\/)?(\d+)$/);
    if (!idMatch) return null;

    const sourceId = idMatch[1];

    let html: string;
    try {
      html = await fetchHtml(sourceUrl);
    } catch {
      // 404 or network error — this event page doesn't exist at this URL pattern
      return null;
    }

    const $ = cheerio.load(html);

    // ── Title ──
    const title = normalizeWhitespace(
      $("h1").first().text() ||
      $("meta[property='og:title']").attr("content") ||
      $("title").text().replace(/\s*[-|].+$/, "") ||
      "",
    );

    if (!title) return null;

    // ── Strict title filter ──
    if (this.isExcludedTitle(title)) {
      console.log(`[ticketfacil] SKIP (title filter): "${title}"`);
      return null;
    }

    // ── "Por Invitación" filter — not open to the general public ──
    const fullPageText = normalizeWhitespace($.root().text());
    if (/por invitaci[oó]n/i.test(fullPageText) && !/precio|entrada|comprar|gratis/i.test(fullPageText)) {
      console.log(`[ticketfacil] SKIP (by-invitation): "${title}"`);
      return null;
    }

    // ── Venue — several possible selectors ──
    const rawVenueBlock = normalizeWhitespace(
      $("[class*='venue']").first().text() ||
      $("[class*='lugar']").first().text() ||
      $("[class*='location']").first().text() ||
      $("[itemprop='location']").first().text() ||
      $("[class*='place']").first().text() ||
      "",
    );

    // ── Venue location filter — exclude non-Uruguay venues ──
    if (this.isExcludedVenue(rawVenueBlock)) {
      console.log(`[ticketfacil] SKIP (non-UY venue: "${rawVenueBlock}"): "${title}"`);
      return null;
    }

    // Split venue block into name + address if possible
    const { venueName, venueAddress } = this.splitVenueBlock(rawVenueBlock);

    // ── Date ──
    const rawDateText = normalizeWhitespace(
      $("[itemprop='startDate']").attr("content") ||
      $("time[datetime]").first().attr("datetime") ||
      $("time").first().text() ||
      $("[class*='date']").first().text() ||
      $("[class*='fecha']").first().text() ||
      "",
    );

    // ── Time ──
    const rawStartTime = normalizeWhitespace(
      $("[itemprop='startDate']").attr("content")?.slice(11, 16) ||
      $("[class*='time']").not("[class*='date']").first().text() ||
      $("[class*='hora']").first().text() ||
      "",
    ) || null;

    // ── Description ──
    const description = normalizeWhitespace(
      $("meta[property='og:description']").attr("content") ||
      $("[class*='description']").first().text() ||
      $("[class*='desc']").first().text() ||
      "",
    ) || null;

    // ── Image ──
    const imageUrl =
      $("meta[property='og:image']").attr("content") ??
      $(`img[src*='/images/acceso/events/images/${sourceId}/']`)
        .not("[src*='LittleImg']")
        .first()
        .attr("src") ??
      // Fallback to the listing thumbnail — better than nothing
      `https://accesofacil.com/images/acceso/events/images/${sourceId}/eventLittleImg.png`;

    // ── Prices ──
    const rawPriceText = normalizeWhitespace(
      $("[class*='price']").text() ||
      $("[class*='precio']").text() ||
      $("[class*='ticket']").text() ||
      "",
    );
    const prices = this.extractPrices(rawPriceText);
    const isFreeText = /gratis|entrada libre|free|sin cargo/i.test(rawPriceText + " " + fullPageText);

    return {
      source: "ticketfacil",
      sourceId,
      sourceUrl,
      rawData: {
        title,
        description,
        dateText: rawDateText || null,
        startTime: rawStartTime,
        venueName: venueName || null,
        venueAddress: venueAddress || null,
        imageUrl: imageUrl || null,
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
   * Attempts to split a raw venue block like "Stadium XYZ — Av. 18 de Julio 999" into
   * separate name and address parts.
   */
  private splitVenueBlock(raw: string): { venueName: string | null; venueAddress: string | null } {
    if (!raw) return { venueName: null, venueAddress: null };

    const separators = [" — ", " – ", " - ", " | "];
    for (const sep of separators) {
      const idx = raw.indexOf(sep);
      if (idx > 0) {
        return {
          venueName: raw.slice(0, idx).trim() || null,
          venueAddress: raw.slice(idx + sep.length).trim() || null,
        };
      }
    }

    return { venueName: raw, venueAddress: null };
  }

  /** Parses numeric price values from a mixed-currency price string. */
  private extractPrices(priceText: string): number[] {
    if (!priceText) return [];
    const prices: number[] = [];
    // Match numbers like "1.200", "1200", "120,50"
    const matches = priceText.match(/[\d.,]+/g) ?? [];
    for (const m of matches) {
      // Disambiguate thousands separator vs decimal
      const v = parseFloat(m.replace(/\.(?=\d{3})/g, "").replace(",", "."));
      if (!isNaN(v) && v > 0 && v < 1_000_000) {
        prices.push(v);
      }
    }
    return prices;
  }

  // Kept here in case we want to parse listing-page dates in a future iteration
  private _parseDateFromListing(dateStr: string): string | null {
    // e.g. "19 FEB 2026" → "2026-02-19"
    const m = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (!m) return null;
    const month = MONTH_ABBR[m[2].toLowerCase()];
    if (!month) return null;
    return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
  }
}
