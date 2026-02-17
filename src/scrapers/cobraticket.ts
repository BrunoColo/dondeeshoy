import * as cheerio from "cheerio";

import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import { extractMoneyValues, fetchHtml, normalizeWhitespace, toAbsoluteUrl, unique } from "./utils";

/**
 * Regex to extract the event slug + id from CobraTicket event URLs.
 * Format: /e/{slug-with-numbers}  e.g. /e/hipnosis-395603
 */
const EVENT_PATH_REGEX = /\/e\/([\w-]+-\d+)\/?$/i;

/**
 * Known CobraTicket category labels that appear as badges on event pages.
 * Used for exact matching against badge text, not body scanning.
 */
const KNOWN_CATEGORIES = [
  "Fiestas",
  "Deportes",
  "Música",
  "Congresos",
  "Teatro",
  "Otros",
  "Cultura",
  "Gastronomía",
] as const;

/**
 * Scraper for cobraticket.uy — Uruguayan ticketing platform.
 *
 * Discovery: Fetches the main /eventos page (upcoming events only).
 * Detail page: Server-rendered HTML with structured sections for
 *   title, description, date/time, venue, address, city, category,
 *   organizer, image, and a Google Maps link with lat/lng.
 */
export class CobraTicketScraper extends BaseScraper {
  constructor() {
    super("cobraticket");
  }

  protected async discoverUrls(): Promise<string[]> {
    const allLinks: string[] = [];
    const base = scraperConfig.cobraticketBaseUrl;

    // Fetch the first 3 pages of upcoming events to get a good coverage
    for (let page = 1; page <= 3; page++) {
      try {
        const html = await fetchHtml(`${base}/eventos?page=${page}`);
        const $ = cheerio.load(html);

        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (!href) return;
          if (!EVENT_PATH_REGEX.test(href)) return;

          allLinks.push(toAbsoluteUrl(base, href));
        });
      } catch (error) {
        console.error(`[cobraticket] error descubriendo page=${page}`, error);
      }
    }

    return unique(allLinks);
  }

  protected async scrapeEvent(url: string): Promise<ScrapedRawEvent | null> {
    const sourceId = this.extractSourceId(url);
    if (!sourceId) return null;

    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Title — main h1, fallback to og:title, then <title>
    const title = normalizeWhitespace(
      $("h1").first().text() ||
        $("meta[property='og:title']").attr("content") ||
        $("title").text().replace(/\s*[|\-–].*$/, "") ||
        "",
    );

    if (!title) return null;

    // Description from "Acerca del evento" section
    const description = this.extractDescription($);

    // Category badge (e.g., "Fiestas", "Deportes", "Música")
    const category = this.extractCategory($);

    // Date and time
    const { dateText, startTime, endTime } = this.extractDateTime($);

    // Venue info
    const { venueName, venueAddress, city } = this.extractVenue($);

    // Coordinates from Google Maps link
    const { latitude, longitude } = this.extractCoordinates($);

    // Image
    const imageUrl = this.extractImage($);

    // Age restriction — CobraTicket shows "+18" as a badge
    const ageRestriction = this.extractAgeRestriction($);

    // Check if free from title + description text
    const bodyText = `${title} ${description ?? ""}`.toLowerCase();
    const isFree =
      /\b(gratis|gratuito|entrada libre|free|sin cargo|sin costo|evento gratuito)\b/i.test(bodyText);

    // Extract prices — prefer structured data, then fallback to body text
    const prices = this.extractPrices($, bodyText);

    // Organizer — found in the "Organiza:" section
    const organizer = this.extractOrganizer($);

    return {
      source: "cobraticket",
      sourceId,
      sourceUrl: url,
      rawData: {
        title,
        description,
        category,
        dateText,
        startTime,
        endTime,
        venueText: venueName,
        venueAddress,
        city,
        latitude,
        longitude,
        imageUrl,
        isFree,
        prices: prices.length > 0 ? prices : undefined,
        ageRestriction,
        organizer,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  private extractSourceId(url: string): string | null {
    const match = url.match(EVENT_PATH_REGEX);
    return match?.[1] ?? null;
  }

  private extractDescription($: cheerio.CheerioAPI): string | null {
    // Look for the "Acerca del evento" section content
    const aboutSection = $("h3").filter((_, el) =>
      $(el).text().toLowerCase().includes("acerca del evento"),
    );

    if (aboutSection.length > 0) {
      // Get the parent container and extract text content after the heading
      const parent = aboutSection.closest("div");
      if (parent.length > 0) {
        // Remove the heading itself, then get the remaining text
        const clone = parent.clone();
        clone.find("h3").remove();
        const text = normalizeWhitespace(clone.text());
        if (text) return text.substring(0, 1500);
      }
    }

    // Fallback: og:description
    const ogDesc = $("meta[property='og:description']").attr("content");
    if (ogDesc) return normalizeWhitespace(ogDesc).substring(0, 1500);

    return null;
  }

  private extractCategory($: cheerio.CheerioAPI): string | null {
    // CobraTicket renders the category as a small text label/badge near the title.
    // We look for known category names in span/div/small elements that are short
    // (badge-like) rather than scanning the entire page text.
    const candidates: string[] = [];

    $("span, div, small, p").each((_, el) => {
      const text = normalizeWhitespace($(el).text());
      // Badges are short — typically just the category word
      if (text.length > 0 && text.length <= 20) {
        candidates.push(text);
      }
    });

    for (const text of candidates) {
      for (const known of KNOWN_CATEGORIES) {
        if (text.toLowerCase() === known.toLowerCase()) {
          return known;
        }
      }
    }

    return null;
  }

  private extractDateTime($: cheerio.CheerioAPI): {
    dateText: string | null;
    startTime: string | null;
    endTime: string | null;
  } {
    let dateText: string | null = null;
    let startTime: string | null = null;
    let endTime: string | null = null;

    // CobraTicket has an h3 with the date like "20 febrero, 2026"
    // and another h3 with time like "viernes, 23:50 - 06:00"
    const h3Elements: string[] = [];
    $("h3").each((_, el) => {
      h3Elements.push(normalizeWhitespace($(el).text()));
    });

    for (const text of h3Elements) {
      // Match date pattern: "20 febrero, 2026" or "17 febrero, 2026"
      const dateMatch = text.match(
        /(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre),?\s*(\d{4})/i,
      );
      if (dateMatch) {
        dateText = text;
      }

      // Match time pattern: "viernes, 23:50 - 06:00" or "martes, 21:30 - 01:00"
      const timeMatch = text.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (timeMatch) {
        startTime = timeMatch[1];
        endTime = timeMatch[2];
      }
    }

    return { dateText, startTime, endTime };
  }

  private extractVenue($: cheerio.CheerioAPI): {
    venueName: string | null;
    venueAddress: string | null;
    city: string | null;
  } {
    let venueName: string | null = null;
    let venueAddress: string | null = null;
    let city: string | null = null;

    // CobraTicket has venue info in h3 elements after "Ubicación" section
    // Pattern: h3 with venue name, h3 with address, h3 with "City, Department"
    const locationSection = $("h3").filter((_, el) =>
      $(el).text().toLowerCase().includes("ubicación"),
    );

    if (locationSection.length > 0) {
      // The venue data appears as h3 siblings after the "Ubicación" heading
      const parent = locationSection.closest("div");
      if (parent.length > 0) {
        const allH3: string[] = [];
        parent.find("h3").each((_, el) => {
          const text = normalizeWhitespace($(el).text());
          if (text && !text.toLowerCase().includes("ubicación")) {
            allH3.push(text);
          }
        });

        // Usually: [venueName, address, "City, Department"]
        if (allH3.length >= 1) venueName = allH3[0];
        if (allH3.length >= 2) venueAddress = allH3[1];
        if (allH3.length >= 3) city = allH3[2];
      }
    }

    // Fallback: scan all h3s looking for patterns
    if (!venueName) {
      $("h3").each((_, el) => {
        const text = normalizeWhitespace($(el).text());
        // Montevideo city pattern
        if (/montevideo/i.test(text) && !city) {
          city = text;
        }
      });
    }

    return { venueName, venueAddress, city };
  }

  private extractCoordinates($: cheerio.CheerioAPI): {
    latitude: number | null;
    longitude: number | null;
  } {
    // CobraTicket includes a Google Maps link with coordinates:
    // https://www.google.com/maps/dir/?api=1&travelmode=driving&layer=traffic&destination=-34.9095744,-56.1679561
    const mapsLink = $('a[href*="google.com/maps"]').attr("href");

    if (mapsLink) {
      const coordMatch = mapsLink.match(/destination=([-\d.]+),([-\d.]+)/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { latitude: lat, longitude: lng };
        }
      }
    }

    return { latitude: null, longitude: null };
  }

  private extractImage($: cheerio.CheerioAPI): string | null {
    // og:image is usually the best quality
    const ogImage = $("meta[property='og:image']").attr("content");
    if (ogImage) return ogImage;

    // Fallback: first significant image from cobraticket CDN
    const cdnImg = $("img[src*='img.cobraticket.uy']")
      .filter((_, el) => {
        const src = $(el).attr("src") ?? "";
        // Skip tiny thumbnails (w-72 prefix)
        return !src.includes("/w-72/");
      })
      .first()
      .attr("src");

    return cdnImg ?? null;
  }

  /**
   * Extract age restriction from badge elements.
   * CobraTicket renders "+18" as a small badge on the event page.
   */
  private extractAgeRestriction($: cheerio.CheerioAPI): number | null {
    const pageText = $("body").text();

    // Match patterns like "+18", "+21", "mayores de 18"
    const match = pageText.match(/\+(\d{2})\b/) ??
      pageText.match(/mayores\s+de\s+(\d{2})/i);

    if (match?.[1]) {
      const age = Number.parseInt(match[1], 10);
      if (!Number.isNaN(age) && age >= 16 && age <= 25) {
        return age;
      }
    }

    return null;
  }

  /**
   * Extract prices from structured elements first, then fallback to body text.
   * Similar approach to Entraste's extractPricesFromHtml.
   */
  private extractPrices($: cheerio.CheerioAPI, bodyText: string): number[] {
    // Look for price-like elements (CobraTicket sometimes shows ticket tiers)
    const priceEls = $(".price, .precio, [class*='price'], [class*='precio']");
    const prices: number[] = [];

    priceEls.each((_, el) => {
      const text = $(el).text().trim();
      const extracted = extractMoneyValues(text);
      prices.push(...extracted);
    });

    if (prices.length > 0) return prices;

    // Fallback to extracting from combined text
    return extractMoneyValues(bodyText);
  }

  /**
   * Extract organizer name from the "Organiza:" section.
   * CobraTicket shows organizer with an avatar image and an h4 name.
   */
  private extractOrganizer($: cheerio.CheerioAPI): string | null {
    // Look for "Organiza:" heading and get the following h4
    const organizaSection = $("h3").filter((_, el) =>
      $(el).text().toLowerCase().includes("organiza"),
    );

    if (organizaSection.length > 0) {
      const parent = organizaSection.closest("div");
      if (parent.length > 0) {
        const orgName = normalizeWhitespace(parent.find("h4").first().text());
        if (orgName) return orgName;
      }
    }

    // Fallback: h4 that is near an organizer image
    const h4WithImg = $("h4").filter((_, el) =>
      $(el).parent().find("img").length > 0,
    );
    const name = normalizeWhitespace(h4WithImg.first().text());
    return name || null;
  }
}
