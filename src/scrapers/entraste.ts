import * as cheerio from "cheerio";

import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import {
  fetchHtml,
  normalizeWhitespace,
  toAbsoluteUrl,
  unique,
} from "./utils";

const EVENT_PATH_REGEX = /\/evento\/([^/?#]+)$/i;

/**
 * Shape of the JSON blob stored in each ticket row's `data-ticket` attribute.
 * Entraste inlines all ticket data directly in the HTML — no separate API call needed.
 */
interface EntrasteTicket {
  name?: string;
  description?: string;
  eventid?: string;
  etid?: string;
  price?: string;   // price in UYU as a string, e.g. "300"
  minquantity?: string;
  mquantity?: string;
  promo?: string;
}

interface UruguayDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Scraper for entraste.com — Uruguayan event ticketing platform.
 *
 * Key improvements over the previous version:
 *
 *  1. **Date/time from Unix timestamp**: the page embeds `data-eventstart="<unix>`
 *     on the event-dates div. Parsing this avoids fragile Spanish weekday regexes
 *     and gives a precise ISO date + time.
 *
 *  2. **Prices from `data-ticket` JSON attributes**: each ticket row has a
 *     `data-ticket='{"name":"...","price":"300",...}'` attribute with the full
 *     ticket data. No text parsing needed.
 *
 *  3. **Coordinates from inline JS**: the page injects `const lat = X; const lng = Y;`
 *     in a script block. Extracted with a simple regex — no Google Maps iframe needed.
 *
 *  4. **Description from `#event-description`**: the dedicated description div
 *     is now targeted directly.
 *
 *  5. **Discovery also scrapes `/with/<organizer>` pages** linked from the homepage,
 *     giving access to all events from each organizer, not just those on the homepage.
 */
export class EntrasteScraper extends BaseScraper {
  constructor() {
    super("entraste");
  }

  /* ─────────────────────────── Discovery ─────────────────────────── */

  protected async discoverUrls(): Promise<string[]> {
    const base = scraperConfig.entrasteBaseUrl;
    const allLinks: string[] = [];

    // 1. Scrape the homepage
    const homeLinks = await this.collectEventLinks(base);
    allLinks.push(...homeLinks);

    // 2. Find organizer pages (/with/<slug>) linked from the homepage and
    //    collect their event links too. These pages list events that may not
    //    be featured on the homepage.
    const homeHtml = await fetchHtml(base);
    const $home = cheerio.load(homeHtml);
    const organizerPaths: string[] = [];

    $home('a[href^="/with/"]').each((_, el) => {
      const href = $home(el).attr("href");
      if (href) organizerPaths.push(href);
    });

    const uniqueOrgPaths = unique(organizerPaths);
    for (const path of uniqueOrgPaths) {
      try {
        const orgLinks = await this.collectEventLinks(`${base}${path}`);
        allLinks.push(...orgLinks);
      } catch (error) {
        console.error(`[entraste] error en página de organizador ${path}`, error);
      }
    }

    const deduped = unique(allLinks);
    console.log(`[entraste] discovered ${deduped.length} events (homepage + ${uniqueOrgPaths.length} organizer pages)`);
    return deduped;
  }

  /** Collect all /evento/ links from a given page URL. */
  private async collectEventLinks(url: string): Promise<string[]> {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const links: string[] = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href && EVENT_PATH_REGEX.test(href)) {
        links.push(toAbsoluteUrl(scraperConfig.entrasteBaseUrl, href));
      }
    });

    return links;
  }

  /* ─────────────────────────── Detail scraping ───────────────────── */

  protected async scrapeEvent(url: string): Promise<ScrapedRawEvent | null> {
    const sourceId = this.extractSourceId(url);
    if (!sourceId) return null;

    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // ── Title ──────────────────────────────────────────────────────────────
    const title = normalizeWhitespace(
      $("h2.text-center").first().text() ||
        $("h1").first().text() ||
        $("meta[property='og:title']").attr("content") ||
        $("title").text() ||
        "",
    );
    if (!title) return null;

    // ── Date and time from Unix timestamp ──────────────────────────────────
    // <div class="col-sm-6 event-dates" data-eventstart="1772161140">
    // This is the most reliable date source — no text parsing needed.
    const { dateText, startTime, dateIso } = this.extractDateFromTimestamp($, title);

    // ── Venue and address ──────────────────────────────────────────────────
    // <p>Venue: Cloud 7<br>Ubicación: Constituyente 1885, ...</p>
    const { venueName, venueAddress } = this.extractVenueFromHtml($);

    // ── Coordinates from inline JS ─────────────────────────────────────────
    // The page injects: const lat = -34.90692; const lng = -56.17565;
    const { latitude, longitude } = this.extractCoordinates(html);

    // ── Tickets and prices from data-ticket JSON ───────────────────────────
    const { prices, isFree } = this.extractTickets($);

    // ── Image ──────────────────────────────────────────────────────────────
    const imageUrl = this.extractImage($);

    // ── Description ────────────────────────────────────────────────────────
    const description = this.extractDescription($);

    return {
      source: "entraste",
      sourceId,
      sourceUrl: url,
      rawData: {
        title,
        description,
        dateText,
        dateIso,
        startTime,
        venueName,
        venueAddress,
        latitude,
        longitude,
        imageUrl,
        prices,
        isFree,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /* ─────────────────────────── Helpers ───────────────────────────── */

  private extractSourceId(url: string): string | null {
    const match = url.match(EVENT_PATH_REGEX);
    return match?.[1] ?? null;
  }

  /**
   * Extract date and time from the `data-eventstart` Unix timestamp attribute.
   * Returns both a human-readable `dateText` and a clean ISO `dateIso` (YYYY-MM-DD)
   * plus `startTime` (HH:MM:SS) so the normalizer doesn't need to parse anything.
   */
  private extractDateFromTimestamp(
    $: cheerio.CheerioAPI,
    title: string,
  ): {
    dateText: string | null;
    dateIso: string | null;
    startTime: string | null;
  } {
    const raw = $("[data-eventstart]").first().attr("data-eventstart");
    if (!raw) {
      // Fallback to text-based extraction if timestamp not found
      const bodyText = normalizeWhitespace(
        $(".event-dates p").first().text() || "",
      );
      return { dateText: bodyText || null, dateIso: null, startTime: null };
    }

    const ts = Number.parseInt(raw, 10);
    if (Number.isNaN(ts) || ts <= 0) {
      return { dateText: null, dateIso: null, startTime: null };
    }

    // Convert Unix timestamp to local Uruguay components.
    // Entraste often stores night events in a way that can otherwise look shifted
    // to the next UTC day/hours when interpreted as UTC directly.
    const uruguay = this.toUruguayDateParts(new Date(ts * 1000));

    let dateIso = this.toDateIso(uruguay.year, uruguay.month, uruguay.day);
    let startTime = `${String(uruguay.hour).padStart(2, "0")}:${String(uruguay.minute).padStart(2, "0")}:00`;

    // Circumstantial fix requested by product: nightlife events shown in madrugada
    // (00:00-05:59) should be treated as the prior night and pinned to 23:59.
    // This avoids appearing as "today" when they are effectively "anoche".
    if (this.isNightlifeEvent(title) && uruguay.hour >= 0 && uruguay.hour <= 5) {
      dateIso = this.shiftDateIso(dateIso, -1);
      startTime = "23:59:00";
    }

    const dateText = dateIso; // normalizer can parse YYYY-MM-DD directly

    return { dateText, dateIso, startTime };
  }

  private toUruguayDateParts(date: Date): UruguayDateParts {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Montevideo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      Number.parseInt(parts.find((part) => part.type === type)?.value ?? "0", 10);

    return {
      year: getPart("year"),
      month: getPart("month"),
      day: getPart("day"),
      hour: getPart("hour"),
      minute: getPart("minute"),
    };
  }

  private toDateIso(year: number, month: number, day: number): string {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  private shiftDateIso(dateIso: string, days: number): string {
    const [y, m, d] = dateIso.split("-").map((part) => Number.parseInt(part, 10));
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + days);
    return this.toDateIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  private isNightlifeEvent(title: string): boolean {
    const normalized = normalizeWhitespace(title).toLowerCase();
    return /(fiesta|party|boliche|club|dance|after|sunset|bailable|electr[oó]nica|dj|techno|house|cocoon|experience|regga?e?t[oó]n|cumbia|guaracha|pariseo|vicio|inauguraci[oó]n|welcome)/i.test(normalized);
  }

  /**
   * Extract venue name and address from the structured HTML block:
   * <p>Venue: Cloud 7<br>Ubicación: Constituyente 1885, ...</p>
   *
   * Also checks the location-section block which has cleaner markup:
   * <div class="location-section"><h3>Cloud 7</h3><p>address</p></div>
   */
  private extractVenueFromHtml($: cheerio.CheerioAPI): {
    venueName: string | null;
    venueAddress: string | null;
  } {
    // Primary: location-section (cleaner, no label prefix to strip)
    const locationSection = $(".location-section");
    if (locationSection.length > 0) {
      const name = normalizeWhitespace(locationSection.find("h3").first().text()) || null;
      const addr = normalizeWhitespace(locationSection.find("p").first().text()) || null;
      if (name) return { venueName: name, venueAddress: addr };
    }

    // Fallback: the <p>Venue: ...<br>Ubicación: ...</p> block
    let venueName: string | null = null;
    let venueAddress: string | null = null;

    const venueP = $("p").filter((_, el) => $(el).text().includes("Venue:"));
    if (venueP.length > 0) {
      const htmlContent = venueP.html() ?? "";
      const parts = htmlContent.split(/<br\s*\/?>/i).map((p) => p.trim());

      for (const part of parts) {
        const text = cheerio.load(part).text().trim();
        const venueMatch = text.match(/Venue\s*:\s*(.+)/i);
        if (venueMatch?.[1]) venueName = normalizeWhitespace(venueMatch[1]);

        const addrMatch = text.match(/Ubicaci[oó]n\s*:\s*(.+)/i);
        if (addrMatch?.[1]) venueAddress = normalizeWhitespace(addrMatch[1]);
      }
    }

    return { venueName, venueAddress };
  }

  /**
   * Extract lat/lng from the inline JS block:
   *   const lat = -34.90692;
   *   const lng = -56.17565;
   */
  private extractCoordinates(html: string): {
    latitude: number | null;
    longitude: number | null;
  } {
    const latMatch = html.match(/\bconst\s+lat\s*=\s*([-\d.]+)\s*;/);
    const lngMatch = html.match(/\bconst\s+lng\s*=\s*([-\d.]+)\s*;/);

    if (!latMatch || !lngMatch) return { latitude: null, longitude: null };

    const lat = Number.parseFloat(latMatch[1]);
    const lng = Number.parseFloat(lngMatch[1]);

    // Sanity check: must be within Uruguay bounding box
    if (
      Number.isNaN(lat) || Number.isNaN(lng) ||
      lat < -36 || lat > -30 || lng < -59 || lng > -53
    ) {
      return { latitude: null, longitude: null };
    }

    return { latitude: lat, longitude: lng };
  }

  /**
   * Extract ticket prices from `data-ticket` JSON attributes.
   *
   * Each ticket row has:
   *   <div class="row ticket" data-ticket='{"name":"Tanda 1","price":"300",...}'>
   *
   * Returns sorted unique prices and whether the event is free.
   * Tickets with price "0" are treated as free rather than as a price point.
   */
  private extractTickets($: cheerio.CheerioAPI): {
    prices: number[];
    isFree: boolean;
  } {
    const prices: number[] = [];
    let hasTickets = false;
    let allFree = true;

    $("[data-ticket]").each((_, el) => {
      const raw = $(el).attr("data-ticket");
      if (!raw) return;

      let ticket: EntrasteTicket;
      try {
        ticket = JSON.parse(raw) as EntrasteTicket;
      } catch {
        return;
      }

      const ticketText = normalizeWhitespace(
        `${ticket.name ?? ""} ${ticket.description ?? ""} ${ticket.promo ?? ""}`,
      ).toLowerCase();

      // Ignore parking/sold-out rows when computing event price points.
      // Example: "Parking", "Estacionamiento", "Agotado".
      if (/(parking|estacionamiento|agotad[oa]|sold\s*out)/i.test(ticketText)) {
        return;
      }

      hasTickets = true;
      const amount = Number.parseFloat(ticket.price ?? "0");

      if (!Number.isNaN(amount) && amount > 0) {
        prices.push(Math.round(amount));
        allFree = false;
      }
      // price === "0" keeps allFree = true
    });

    const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);
    const isFree = hasTickets && allFree;

    return { prices: uniquePrices, isFree };
  }

  /**
   * Extract the event banner image.
   * Entraste uses `.event-flyer-image` for the main banner and
   * `.event-flyer-imagebox` for a secondary image (usually the same).
   * Falls back to og:image.
   */
  private extractImage($: cheerio.CheerioAPI): string | null {
    const flyer = $("img.event-flyer-image").first().attr("src");
    if (flyer && flyer.startsWith("http")) return flyer;

    const ogImage = $("meta[property='og:image']").attr("content");
    if (ogImage) {
      if (ogImage.startsWith("http")) return ogImage;
      return `${scraperConfig.entrasteBaseUrl}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;
    }

    return null;
  }

  /**
   * Extract the event description from the `#event-description` div.
   * Strips empty paragraphs and normalizes whitespace.
   */
  private extractDescription($: cheerio.CheerioAPI): string | null {
    const descEl = $("#event-description");
    if (!descEl.length) return null;

    const text = normalizeWhitespace(descEl.text());
    return text.length > 0 ? text.substring(0, 1000) : null;
  }
}
