import * as cheerio from "cheerio";
import { decode } from "html-entities";

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
 * Known CobraTicket category labels.
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
 * Shape of the structured event data embedded by the SvelteKit SSR.
 * Extracted from the `const data = [...]` block in the page's script tag.
 */
interface CobraEventProps {
  id?: string;
  code?: string;
  name?: string;
  description?: string | null;
  startAt?: string;
  endAt?: string;
  minAge?: number | null;
  slug?: string;
  status?: string;
  account?: {
    name?: string;
    slug?: string;
    logo?: { urlThumb?: string };
  };
  category?: {
    name?: string;
  };
  image?: {
    url?: string;
  };
  imageCover?: {
    url?: string;
  };
  location?: {
    name?: string;
    address?: string;
    region?: string;
    locality?: string;
    latlng?: {
      lat?: number;
      lng?: number;
    };
  };
  ctaButton?: {
    text?: string;
    link?: string | null;
    action?: string;
  };
}

/**
 * Scraper for cobraticket.uy — Uruguayan ticketing platform.
 *
 * Discovery: Fetches the /eventos page and collects event links
 *   that appear BEFORE the "Eventos pasados" divider (upcoming only).
 *
 * Detail page: Extracts the rich SvelteKit SSR JSON payload embedded
 *   in the page <script> tag, which contains: name, description, dates,
 *   venue (name/address/region/locality), lat/lng, category, organizer,
 *   image, minAge, and more.
 *
 * Prices: Extracted from the event description text, since actual ticket
 *   types are loaded client-side via Firebase and not available in SSR HTML.
 */
export class CobraTicketScraper extends BaseScraper {
  constructor() {
    super("cobraticket");
  }

  /* ------------------------------------------------------------------ */
  /*  Discovery                                                          */
  /* ------------------------------------------------------------------ */

  protected async discoverUrls(): Promise<string[]> {
    const base = scraperConfig.cobraticketBaseUrl;

    console.log(`[cobraticket] fetching listing: ${base}`);
    const html = await fetchHtml(base);

    const upcomingLinks: string[] = [];

    // The page has cards in <a href="/e/..."> elements.
    // After the "Eventos pasados" divider everything is past events.
    // Strategy: only parse the HTML that comes BEFORE the divider.
    const markerIndex = html.indexOf("Eventos pasados");

    if (markerIndex === -1) {
      // No divider found — treat the whole page as upcoming
      console.warn("[cobraticket] 'Eventos pasados' divider not found, scraping all links");
      const $ = cheerio.load(html);
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (href && EVENT_PATH_REGEX.test(href)) {
          upcomingLinks.push(toAbsoluteUrl(base, href));
        }
      });
    } else {
      // Only parse the HTML before the marker
      const upcomingHtml = html.substring(0, markerIndex);
      const $ = cheerio.load(upcomingHtml);

      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (href && EVENT_PATH_REGEX.test(href)) {
          upcomingLinks.push(toAbsoluteUrl(base, href));
        }
      });
    }

    const uniqueLinks = unique(upcomingLinks);
    console.log(`[cobraticket] discovered ${uniqueLinks.length} upcoming events`);
    return uniqueLinks;
  }

  /* ------------------------------------------------------------------ */
  /*  Scrape single event                                                */
  /* ------------------------------------------------------------------ */

  protected async scrapeEvent(url: string): Promise<ScrapedRawEvent | null> {
    const sourceId = this.extractSourceId(url);
    if (!sourceId) return null;

    const html = await fetchHtml(url);

    // ---- Try to extract the structured SvelteKit data payload ----
    const props = this.extractSvelteKitProps(html);

    if (props) {
      return this.buildEventFromProps(props, url, sourceId);
    }

    // ---- Fallback: parse DOM if SvelteKit data is not available ----
    console.warn(`[cobraticket] SvelteKit data not found for ${url}, falling back to DOM parsing`);
    return this.scrapeEventFromDom(url, sourceId, html);
  }

  /* ------------------------------------------------------------------ */
  /*  Extract SvelteKit JSON payload                                     */
  /* ------------------------------------------------------------------ */

  /**
   * The SvelteKit SSR injects a block like:
   *   const data = [null, {...}, {"type":"data","data":{props:{...}}}];
   *
   * The data uses JS object notation (some keys are unquoted), so we
   * cannot use JSON.parse directly. We use `new Function()` to evaluate
   * the literal safely on the server side.
   */
  private extractSvelteKitProps(html: string): CobraEventProps | null {
    try {
      // Match the data assignment in the script block.
      const dataMatch = html.match(
        /const\s+data\s*=\s*(\[[\s\S]*?\])\s*;\s*(?:\r?\n|\s*Promise)/,
      );
      if (!dataMatch?.[1]) return null;

      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const dataArray = new Function("return " + dataMatch[1])() as unknown[];
      if (!Array.isArray(dataArray)) return null;

      // Walk the array to find the element with props
      for (const item of dataArray) {
        if (!item || typeof item !== "object") continue;

        const record = item as Record<string, unknown>;
        // SvelteKit data node: { type: "data", data: { props: { ... } } }
        if (record.type === "data") {
          const data = record.data as Record<string, unknown> | undefined;
          if (data?.props) {
            return data.props as CobraEventProps;
          }
        }
      }

      return null;
    } catch (error) {
      console.error("[cobraticket] Error parsing SvelteKit data:", error);
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Build event from structured props                                  */
  /* ------------------------------------------------------------------ */

  private buildEventFromProps(
    props: CobraEventProps,
    url: string,
    sourceId: string,
  ): ScrapedRawEvent | null {
    const title = normalizeWhitespace(props.name ?? "");
    if (!title) return null;

    // Clean description: the description field contains HTML entities
    const rawDesc = props.description ?? null;
    const description = rawDesc ? this.cleanDescription(rawDesc) : null;

    // Category
    const category = props.category?.name ?? null;

    // Dates
    const dateText = props.startAt ?? null;
    const { startTime, endTime } = this.parseStartEndTimes(props.startAt, props.endAt);

    // Venue
    const venueName = props.location?.name ?? null;
    const venueAddress = props.location?.address?.trim() ?? null;
    const city = props.location?.region?.trim() ?? props.location?.locality?.trim() ?? null;

    // Coordinates
    const latitude = props.location?.latlng?.lat ?? null;
    const longitude = props.location?.latlng?.lng ?? null;

    // Image — prefer cover image, fallback to square image
    const imageUrl = props.imageCover?.url ?? props.image?.url ?? null;

    // Age restriction
    const ageRestriction = props.minAge ?? this.extractAgeFromText(description);

    // Organizer
    const organizer = props.account?.name ?? null;

    // Prices from description text
    const bodyText = `${title} ${description ?? ""}`;
    const isFree =
      /\b(gratis|gratuito|entrada libre|free|sin cargo|sin costo|evento gratuito)\b/i.test(bodyText);
    const prices = extractMoneyValues(bodyText);

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

  /* ------------------------------------------------------------------ */
  /*  Fallback DOM-based scraping                                        */
  /* ------------------------------------------------------------------ */

  private scrapeEventFromDom(
    url: string,
    sourceId: string,
    html: string,
  ): ScrapedRawEvent | null {
    const $ = cheerio.load(html);

    // Title
    const title = normalizeWhitespace(
      $("h1").first().text() ||
        $("meta[property='og:title']").attr("content") ||
        $("title").text().replace(/\s*[|\-–].*$/, "") ||
        "",
    );
    if (!title) return null;

    // Description — "Acerca del evento" section
    const description = this.extractDescriptionFromDom($);

    // Category badge
    const category = this.extractCategoryFromDom($);

    // Date/time from <time> elements
    const { dateText, startTime, endTime } = this.extractDateTimeFromDom($);

    // Venue info from the location section (map-pin icon + h3s)
    const { venueName, venueAddress, city } = this.extractVenueFromDom($);

    // Coordinates from Google Maps link
    const { latitude, longitude } = this.extractCoordinatesFromDom($);

    // Image
    const imageUrl = this.extractImageFromDom($);

    // Age restriction
    const ageRestriction = this.extractAgeFromText($("body").text());

    // Organizer
    const organizer = this.extractOrganizerFromDom($);

    // Prices
    const bodyText = `${title} ${description ?? ""}`;
    const isFree =
      /\b(gratis|gratuito|entrada libre|free|sin cargo|sin costo|evento gratuito)\b/i.test(bodyText);
    const prices = extractMoneyValues(bodyText);

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

  /* ------------------------------------------------------------------ */
  /*  Helper methods                                                     */
  /* ------------------------------------------------------------------ */

  private extractSourceId(url: string): string | null {
    const match = url.match(EVENT_PATH_REGEX);
    return match?.[1] ?? null;
  }

  /**
   * Clean HTML-encoded description: strip tags, decode entities,
   * normalize whitespace.
   */
  private cleanDescription(raw: string): string {
    // Replace HTML tags with newlines/spaces
    let text = raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ");

    // Decode HTML entities like &aacute; &nbsp; etc.
    text = decode(text);

    // Normalize whitespace
    text = text
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    return text.substring(0, 1500) || "";
  }

  /**
   * Parse start/end times from ISO-like strings like "2026-02-19 23:59:00".
   */
  private parseStartEndTimes(
    startAt?: string,
    endAt?: string,
  ): { startTime: string | null; endTime: string | null } {
    let startTime: string | null = null;
    let endTime: string | null = null;

    if (startAt) {
      const match = startAt.match(/(\d{2}:\d{2}):\d{2}$/);
      if (match) startTime = match[1];
    }
    if (endAt) {
      const match = endAt.match(/(\d{2}:\d{2}):\d{2}$/);
      if (match) endTime = match[1];
    }

    return { startTime, endTime };
  }

  /**
   * Extract age restriction from text ("+18", "mayores de 18").
   */
  private extractAgeFromText(text: string | null): number | null {
    if (!text) return null;

    const match = text.match(/\+(\d{2})\b/) ??
      text.match(/mayores\s+de\s+(\d{2})/i);

    if (match?.[1]) {
      const age = Number.parseInt(match[1], 10);
      if (!Number.isNaN(age) && age >= 16 && age <= 25) {
        return age;
      }
    }

    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  DOM fallback helpers                                               */
  /* ------------------------------------------------------------------ */

  private extractDescriptionFromDom($: cheerio.CheerioAPI): string | null {
    const aboutSection = $("h3").filter((_, el) =>
      $(el).text().toLowerCase().includes("acerca del evento"),
    );

    if (aboutSection.length > 0) {
      const parent = aboutSection.closest("div");
      if (parent.length > 0) {
        const clone = parent.clone();
        clone.find("h3").remove();
        const text = normalizeWhitespace(clone.text());
        if (text) return text.substring(0, 1500);
      }
    }

    const ogDesc = $("meta[property='og:description']").attr("content");
    if (ogDesc) return normalizeWhitespace(ogDesc).substring(0, 1500);

    return null;
  }

  private extractCategoryFromDom($: cheerio.CheerioAPI): string | null {
    // Look for the category badge — a small bordered div with class border-primary
    const categoryBadge = $("div.rounded-full").filter((_, el) => {
      const text = normalizeWhitespace($(el).text());
      return text.length > 0 && text.length <= 20;
    });

    for (let i = 0; i < categoryBadge.length; i++) {
      const text = normalizeWhitespace(categoryBadge.eq(i).text());
      for (const known of KNOWN_CATEGORIES) {
        if (text.toLowerCase() === known.toLowerCase()) return known;
      }
    }

    // Fallback: scan short text elements
    const candidates: string[] = [];
    $("span, div, small, p, h4").each((_, el) => {
      const text = normalizeWhitespace($(el).text());
      if (text.length > 0 && text.length <= 20) {
        candidates.push(text);
      }
    });

    for (const text of candidates) {
      for (const known of KNOWN_CATEGORIES) {
        if (text.toLowerCase() === known.toLowerCase()) return known;
      }
    }

    return null;
  }

  private extractDateTimeFromDom($: cheerio.CheerioAPI): {
    dateText: string | null;
    startTime: string | null;
    endTime: string | null;
  } {
    let dateText: string | null = null;
    let startTime: string | null = null;
    let endTime: string | null = null;

    // CobraTicket uses <time datetime="2026-02-19 23:59:00"> elements
    const timeEls: string[] = [];
    $("time[datetime]").each((_, el) => {
      const dt = $(el).attr("datetime");
      if (dt) timeEls.push(dt);
    });

    const uniqueTimes = [...new Set(timeEls)];
    if (uniqueTimes.length >= 1) {
      dateText = uniqueTimes[0];
      const match1 = uniqueTimes[0].match(/(\d{2}:\d{2}):\d{2}$/);
      if (match1) startTime = match1[1];
    }
    if (uniqueTimes.length >= 2) {
      const match2 = uniqueTimes[1].match(/(\d{2}:\d{2}):\d{2}$/);
      if (match2) endTime = match2[1];
    }

    return { dateText, startTime, endTime };
  }

  private extractVenueFromDom($: cheerio.CheerioAPI): {
    venueName: string | null;
    venueAddress: string | null;
    city: string | null;
  } {
    let venueName: string | null = null;
    let venueAddress: string | null = null;
    let city: string | null = null;

    // The venue section has a map-pin SVG icon followed by h3 elements:
    //   h3.text-sm.font-semibold = venue name
    //   h3.text-sm = address
    //   h3.text-xs.font-light.opacity-70 = city/region
    const mapPinSvg = $("svg.icon-tabler-map-pin");
    if (mapPinSvg.length > 0) {
      const container = mapPinSvg.first().closest("div.flex");
      if (container.length > 0) {
        const h3s = container.find("h3");
        if (h3s.length >= 1) venueName = normalizeWhitespace(h3s.eq(0).text()) || null;
        if (h3s.length >= 2) venueAddress = normalizeWhitespace(h3s.eq(1).text()) || null;
        if (h3s.length >= 3) city = normalizeWhitespace(h3s.eq(2).text()) || null;
      }
    }

    return { venueName, venueAddress, city };
  }

  private extractCoordinatesFromDom($: cheerio.CheerioAPI): {
    latitude: number | null;
    longitude: number | null;
  } {
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

  private extractImageFromDom($: cheerio.CheerioAPI): string | null {
    // Prefer data-src pointing to img.cobraticket.uy (high-res, not thumbnail)
    let best: string | null = null;

    $("img[data-src*='img.cobraticket.uy']").each((_, el) => {
      const src = $(el).attr("data-src");
      if (src && !src.includes("/w-72/")) {
        if (!best) best = src;
      }
    });

    if (best) return best;

    // Fallback to og:image
    const ogImage = $("meta[property='og:image']").attr("content");
    return ogImage ?? null;
  }

  private extractOrganizerFromDom($: cheerio.CheerioAPI): string | null {
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

    return null;
  }
}
