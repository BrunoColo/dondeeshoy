import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import {
  extractBestImageUrl,
  fetchHtml,
  normalizeWhitespace,
  toAbsoluteUrl,
  unique,
  sleep,
} from "./utils";

const EVENT_PATH_REGEX = /\/evento\/([^/]+)\/(\d+)\/?$/i;

/**
 * Build a RedTickets search page URL for a given page number.
 * The URL format is: /busqueda{query},{category},{subcategory},{page}
 * Using `?,*,0,{page}` matches all events in all categories.
 */
function buildSearchUrl(page: number): string {
  return `${scraperConfig.redticketsBaseUrl}/busqueda?,*,0,${page}`;
}

/** Metadata extracted from search result cards to enrich detail scraping */
interface SearchCardMeta {
  category: string | null;
  imageUrl: string | null;
}

/** Safely coerce an unknown value to a number, returning null on failure */
function toNumber(val: unknown): number | null {
  if (typeof val === "number") return Number.isNaN(val) ? null : val;
  if (typeof val === "string") {
    const n = Number.parseFloat(val);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Deduplicate and sort an array of numbers */
function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export class RedTicketsScraper extends BaseScraper {
  /**
   * Cache of metadata extracted from search result cards.
   * Keyed by event URL — used to supplement detail page data with
   * category/thumbnail info visible on the search listing.
   */
  private searchCardMeta = new Map<string, SearchCardMeta>();

  constructor() {
    super("redtickets");
  }

  /* ─────────────────────── Discovery ─────────────────────── */

  protected async discoverUrls(): Promise<string[]> {
    const allLinks: string[] = [];

    // ── Source: Search / busqueda pages (paginated) ──
    // Note: Homepage discovery was removed as /busqueda already contains all events
    try {
      const searchLinks = await this.discoverFromSearchPages();
      allLinks.push(...searchLinks);
      console.log(
        `[redtickets] search pages: ${searchLinks.length} event links`,
      );
    } catch (error) {
      console.error(
        "[redtickets] error discovering from search pages",
        error,
      );
    }

    const deduped = unique(allLinks);
    console.log(
      `[redtickets] total unique URLs after merge: ${deduped.length}`,
    );
    return deduped;
  }

  /**
   * Extract all event URLs from a single HTML page by scanning anchor tags.
   */
  private async discoverLinksFromPage(url: string): Promise<string[]> {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const links: string[] = [];

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      if (!href || !EVENT_PATH_REGEX.test(href)) return;
      links.push(toAbsoluteUrl(scraperConfig.redticketsBaseUrl, href));
    });

    return links;
  }

  /**
   * Paginate through RedTickets search results to discover event URLs.
   * Stops when a page returns zero new event links or the max page limit is hit.
   * Also extracts card-level metadata (category, thumbnail) from each
   * search result for later enrichment during detail scraping.
   */
  private async discoverFromSearchPages(): Promise<string[]> {
    const allLinks: string[] = [];
    const maxPages = scraperConfig.maxSearchPages;
    let consecutiveEmpty = 0;

    for (let page = 0; page < maxPages; page++) {
      const searchUrl = buildSearchUrl(page);

      try {
        const html = await fetchHtml(searchUrl);
        const $ = cheerio.load(html);
        const pageLinks: string[] = [];

        $("a[href]").each((_, element) => {
          const href = $(element).attr("href");
          if (!href || !EVENT_PATH_REGEX.test(href)) return;

          const eventUrl = toAbsoluteUrl(
            scraperConfig.redticketsBaseUrl,
            href,
          );
          pageLinks.push(eventUrl);

          // Extract search card metadata (category, image) if not already cached
          if (!this.searchCardMeta.has(eventUrl)) {
            const meta = this.extractCardMeta($, element);
            if (meta) {
              this.searchCardMeta.set(eventUrl, meta);
            }
          }
        });

        const uniquePageLinks = unique(pageLinks);

        if (uniquePageLinks.length === 0) {
          consecutiveEmpty++;
          console.log(
            `[redtickets] search page ${page}: 0 events (${consecutiveEmpty} empty in a row)`,
          );
          // Stop after 2 consecutive empty pages to avoid infinite pagination
          if (consecutiveEmpty >= 2) {
            console.log(
              "[redtickets] stopping search pagination — 2 consecutive empty pages",
            );
            break;
          }
        } else {
          consecutiveEmpty = 0;
          allLinks.push(...uniquePageLinks);
          console.log(
            `[redtickets] search page ${page}: ${uniquePageLinks.length} events`,
          );
        }

        // Polite delay between search page requests
        if (page < maxPages - 1) {
          await sleep(500);
        }
      } catch (error) {
        console.error(
          `[redtickets] error fetching search page ${page}`,
          error,
        );
        // Continue to next page even on error
      }
    }

    return allLinks;
  }

  /**
   * Extract category and image metadata from the DOM context around an
   * event link on a search results page. Walks up to the nearest card-like
   * container and looks for category badges and thumbnail images.
   */
  private extractCardMeta(
    $: cheerio.CheerioAPI,
    linkElement: AnyNode,
  ): SearchCardMeta | null {
    const $link = $(linkElement);

    // Walk up to find a card-like container
    let $card = $link.closest(
      "[class*='card'], [class*='Card'], [class*='event'], [class*='Event'], [class*='item'], [class*='Item'], [class*='result'], [class*='Result']",
    );
    // Fallback — use grandparent
    if (!$card.length) {
      $card = $link.parent().parent();
    }
    if (!$card.length) return null;

    let category: string | null = null;
    let imageUrl: string | null = null;

    // Look for category text — RedTickets uses inline-styled elements:
    // a <li> containing a small colored-dot <div> + an <a> with the category name.
    category = this.extractCategoryFromDotPattern($card);

    // Fallback: class-based selectors (in case RedTickets changes markup)
    if (!category) {
      const categoryEl = $card
        .find(
          "[class*='category'], [class*='Category'], [class*='categoria'], [class*='tag'], [class*='Tag'], .badge",
        )
        .first();
      if (categoryEl.length) {
        const text = normalizeWhitespace(categoryEl.text());
        if (text && text.length < 50) {
          category = text;
        }
      }
    }

    // Look for thumbnail image
    const imgEl = $card.find("img").first();
    if (imgEl.length) {
      const src =
        imgEl.attr("src") ||
        imgEl.attr("data-src") ||
        imgEl.attr("data-original");
      if (src && !src.startsWith("data:")) {
        try {
          imageUrl = toAbsoluteUrl(scraperConfig.redticketsBaseUrl, src);
        } catch {
          // malformed URL — skip
        }
      }
    }

    // Fallback: check for background-image in card styles
    if (!imageUrl) {
      $card.find("[style*='background']").each((_, el) => {
        if (imageUrl) return;
        const style = $(el).attr("style") ?? "";
        const match = style.match(/url\((['"]?)(.*?)\1\)/i);
        if (match?.[2] && !match[2].startsWith("data:")) {
          try {
            imageUrl = toAbsoluteUrl(scraperConfig.redticketsBaseUrl, match[2]);
          } catch {
            // malformed URL — skip
          }
        }
      });
    }

    if (category || imageUrl) {
      return { category, imageUrl };
    }
    return null;
  }

  /* ─────────────────────── Detail Scraping ─────────────────────── */

  protected async scrapeEvent(url: string): Promise<ScrapedRawEvent | null> {
    const sourceId = this.extractSourceId(url);

    if (!sourceId) {
      return null;
    }

    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // RedTickets uses span.Title for event name on detail pages
    const title = normalizeWhitespace(
      $("span.Title").first().text() ||
        $("h1").first().text() ||
        $("meta[property='og:title']").attr("content") ||
        $("title").text() ||
        "",
    );

    if (!title) {
      return null;
    }

    const imageUrl = extractBestImageUrl($, url, [
      "img[src*='files.redtickets.uy']",
      "img[data-src*='files.redtickets.uy']",
      ".event-image img",
      ".evento img",
      "img",
    ]);

    // Category: prefer search card metadata (reflects RedTickets' actual classification),
    // fallback to detail page extraction (which may pick up generic badges)
    const detailCategory = this.extractCategory($);
    const cardMeta = this.searchCardMeta.get(url);
    const category = cardMeta?.category || detailCategory || null;

    // Image: prefer detail page, fallback to search card thumbnail
    const finalImageUrl = imageUrl || cardMeta?.imageUrl || null;

    // RedTickets detail pages use span.Description.Flex for date and venue
    const descFlex = $("span.Description.Flex");
    const dateText = descFlex.eq(0).text().trim() || null;
    const rawVenueText = descFlex.eq(1).text().trim() || null;

    // Extract venue name AND address from "VenueName - Address, Postal City"
    const { venueName: rtVenueName, venueAddress: rtVenueAddress } =
      this.parseVenueText(rawVenueText);

    // Extract coordinates directly from Google Maps embed iframe
    const coords = this.extractMapCoordinates($);

    // Attempt price extraction from the GeneXus embedded ticket data first,
    // then fall back to JSON-LD / meta / text extraction
    const ticketPrices = this.extractTicketPrices($, html);
    const prices = ticketPrices.length > 0 ? ticketPrices : this.extractPrices($);

    // Check isFree flag from the embedded GeneXus data
    const gxFree = this.extractIsFreeFromGx($, html);

    // Extract description from meta tags or page content
    const description = this.extractDescription($);

    return {
      source: "redtickets",
      sourceId,
      sourceUrl: url,
      rawData: {
        title,
        description,
        category,
        dateText,
        venueText: rtVenueName,
        venueAddress: rtVenueAddress,
        imageUrl: finalImageUrl,
        prices,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        ...(gxFree === true ? { isFree: true } : {}),
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /* ─────────────────────── Helpers ─────────────────────── */

  private extractSourceId(url: string): string | null {
    const match = url.match(EVENT_PATH_REGEX);
    return match?.[2] ?? null;
  }

  private extractCategory($: cheerio.CheerioAPI): string | null {
    // Primary: detect RedTickets' inline-styled category pattern
    // (colored dot <div> + <a> with category text inside a <li>)
    const dotPattern = this.extractCategoryFromDotPattern($('body'));
    if (dotPattern) return dotPattern;

    // Fallback: class-based selectors
    const candidate =
      $("[class*='category']").first().text() ||
      $("[class*='categoria']").first().text() ||
      $(".badge").first().text();

    const normalized = normalizeWhitespace(candidate ?? "");
    return normalized || null;
  }

  /**
   * Extract category text from RedTickets' characteristic dot+label pattern.
   * The HTML structure is: <li> → <div style="...border-radius:10px;height:10px;width:10px..."> (colored dot)
   *                                <a style="...font-family: Lato...">Category Name</a>
   * This pattern is used on both search cards and detail pages.
   */
  private extractCategoryFromDotPattern($container: cheerio.Cheerio<cheerio.AnyNode>): string | null {
    let found: string | null = null;

    $container.find('li').each((_, li) => {
      if (found) return;
      const $li = $container.find(li);
      // Look for the characteristic small colored dot div
      const dot = $li.find('div[style*="border-radius"][style*="height: 10px"][style*="width: 10px"]');
      if (!dot.length) return;
      // The category text is in the <a> sibling of the dot
      const categoryLink = dot.next('a');
      if (!categoryLink.length) return;
      const text = normalizeWhitespace(categoryLink.text());
      if (text && text.length > 0 && text.length < 50) {
        found = text;
      }
    });

    return found;
  }

  /**
   * Extract event description from meta tags or page content.
   * Avoids the span.Description.Flex which contains date/venue info.
   */
  private extractDescription($: cheerio.CheerioAPI): string | null {
    // Try meta tags first (most reliable)
    const ogDesc = $("meta[property='og:description']").attr("content");
    if (ogDesc) {
      return this.stripHtmlAndNormalize(ogDesc, 1000);
    }

    const metaDesc = $("meta[name='description']").attr("content");
    if (metaDesc) {
      return this.stripHtmlAndNormalize(metaDesc, 1000);
    }

    // Fallback: look for description containers in the page
    // Avoid the flex description that contains date/venue
    const descElement = $("[class*='description']")
      .not("span.Description.Flex")
      .filter((_, el) => {
        const text = $(el).text();
        // Must have meaningful content (not just date/venue)
        return text.length > 50;
      })
      .first();

    if (descElement.length) {
      const text = normalizeWhitespace(descElement.text());
      return text?.substring(0, 1000) || null;
    }

    return null;
  }

  /**
   * Strip HTML tags and entities from a string, normalize whitespace,
   * and truncate to maxLen. Used for descriptions that may contain raw HTML.
   */
  private stripHtmlAndNormalize(raw: string, maxLen: number): string | null {
    const stripped = raw
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
    return stripped.substring(0, maxLen) || null;
  }

  /**
   * Attempt to extract prices from multiple sources on the page.
   *
   * Strategy (in order):
   *   1. JSON-LD structured data (Schema.org Event → offers)
   *   2. Meta tags (product:price:amount / og:price:amount)
   *   3. Text-based extraction from og:description and page body
   *      Patterns: "USD 190", "US$ 800", "U$S 1.500", "$ 500", "Precio: 190"
   *
   * Returns sorted unique prices, or empty array if none found.
   */
  private extractPrices($: cheerio.CheerioAPI): number[] {
    const prices: number[] = [];

    // 1. Try JSON-LD (Schema.org Event with offers)
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const raw = $(el).contents().text();
        if (!raw) return;
        const data = JSON.parse(raw);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item && typeof item === "object") {
            this.collectPricesFromJsonLd(
              item as Record<string, unknown>,
              prices,
            );
          }
        }
      } catch {
        // ignore invalid JSON-LD
      }
    });

    if (prices.length > 0) {
      return uniqueNumbers(prices);
    }

    // 2. Fallback: meta tags
    const metaPrice =
      $("meta[property='product:price:amount']").attr("content") ||
      $("meta[property='og:price:amount']").attr("content");
    if (metaPrice) {
      const amount = Number.parseFloat(metaPrice);
      if (!Number.isNaN(amount) && amount > 0) {
        prices.push(amount);
      }
    }

    if (prices.length > 0) {
      return uniqueNumbers(prices);
    }

    // 3. Text-based extraction from og:description + page body
    const ogDesc = $("meta[property='og:description']").attr("content") ?? "";
    const bodyText = $("body").text();

    // Use all patterns on og:description (structured, low noise)
    this.extractPricesFromText(ogDesc, prices, true);
    // Use only explicit patterns on body text (avoid $ false positives from JS code)
    this.extractPricesFromText(bodyText, prices, false);

    return uniqueNumbers(prices);
  }

  /**
   * Extract prices from free text using common Uruguayan price patterns.
   * Handles: "USD 190", "US$ 800", "U$S 1.500", "$ 500", "Precio: $190", etc.
   * Filters out $0 values and amounts < 10 (likely false positives).
   * @param includeDollarSign - whether to match bare `$` + number (safe for og:description, noisy in body text)
   */
  private extractPricesFromText(text: string, prices: number[], includeDollarSign: boolean): void {
    const MIN_PRICE = 10; // Filter out small false positives

    // Pattern 1: USD / US$ / U$S followed by amount
    const usdPattern = /(?:USD|US\$|U\$S)\s*([\d]+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/gi;
    let match: RegExpExecArray | null;
    while ((match = usdPattern.exec(text)) !== null) {
      const amount = this.parseFormattedNumber(match[1]);
      if (amount !== null && amount >= MIN_PRICE) {
        prices.push(amount);
      }
    }

    // Pattern 2: "Precio:" followed by a number (with optional currency)
    const precioPattern = /Precio\s*:?\s*(?:USD|US\$|U\$S|UYU|\$)?\s*([\d]+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/gi;
    while ((match = precioPattern.exec(text)) !== null) {
      const amount = this.parseFormattedNumber(match[1]);
      if (amount !== null && amount >= MIN_PRICE) {
        prices.push(amount);
      }
    }

    // Pattern 3: $ followed by amount — only used on structured text (og:description)
    // to avoid false positives from JS code in body
    if (includeDollarSign) {
      const pesoPattern = /\$\s*([\d]+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/gi;
      while ((match = pesoPattern.exec(text)) !== null) {
        const amount = this.parseFormattedNumber(match[1]);
        if (amount !== null && amount >= MIN_PRICE) {
          prices.push(amount);
        }
      }
    }
  }

  /**
   * Parse a formatted number string that may use dots as thousands separators
   * and commas as decimal separators (or vice versa).
   * Examples: "1.500" → 1500, "190" → 190, "1,500" → 1500, "29.99" → 29.99
   */
  private parseFormattedNumber(raw: string): number | null {
    if (!raw) return null;

    let cleaned = raw.trim();

    // If matches pattern like "1.500" or "1.500.000" (dots as thousands sep)
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, "");
    }
    // If matches pattern like "1,500" or "1,500,000" (commas as thousands sep)
    else if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, "");
    }

    const num = Number.parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
  }

  /**
   * Recursively collect price values from a JSON-LD object.
   * Handles: Event.offers, Offer.price, AggregateOffer.lowPrice/highPrice.
   */
  private collectPricesFromJsonLd(
    obj: Record<string, unknown>,
    prices: number[],
  ): void {
    // Direct price
    if ("price" in obj) {
      const p = toNumber(obj.price);
      if (p !== null && p > 0) prices.push(p);
    }

    // AggregateOffer fields
    for (const key of ["lowPrice", "highPrice"] as const) {
      if (key in obj) {
        const p = toNumber(obj[key]);
        if (p !== null && p > 0) prices.push(p);
      }
    }

    // Recurse into offers
    if ("offers" in obj) {
      const offers = obj.offers;
      if (Array.isArray(offers)) {
        for (const offer of offers) {
          if (offer && typeof offer === "object") {
            this.collectPricesFromJsonLd(
              offer as Record<string, unknown>,
              prices,
            );
          }
        }
      } else if (offers && typeof offers === "object") {
        this.collectPricesFromJsonLd(
          offers as Record<string, unknown>,
          prices,
        );
      }
    }
  }

  /* ─────────────── Coordinates from Google Maps embed ────────────── */

  /**
   * Extract latitude and longitude directly from the Google Maps embed iframe.
   * RedTickets embeds an iframe like:
   *   <IFRAME src="https://www.google.com/maps/embed/v1/place?key=...&q=-34.90581000 , -56.19950300&zoom=16" ...>
   * This gives us the exact coordinates the organizer set.
   */
  private extractMapCoordinates(
    $: cheerio.CheerioAPI,
  ): { latitude: number; longitude: number } | null {
    const iframe = $(
      "iframe[name='W0010EMBMAP'], IFRAME[name='W0010EMBMAP'], iframe[src*='google.com/maps/embed'], IFRAME[src*='google.com/maps/embed']",
    ).first();

    const src = iframe.attr("src") || "";
    // Match q=LAT , LNG (with possible spaces around comma)
    const match = src.match(/[?&]q=([-\d.]+)\s*,\s*([-\d.]+)/);

    if (match) {
      const lat = Number.parseFloat(match[1]);
      const lng = Number.parseFloat(match[2]);

      // Sanity check: must be in Uruguay's bounding box roughly
      if (
        !Number.isNaN(lat) &&
        !Number.isNaN(lng) &&
        lat >= -36 &&
        lat <= -30 &&
        lng >= -59 &&
        lng <= -53
      ) {
        return { latitude: lat, longitude: lng };
      }
    }

    return null;
  }

  /* ──────────── Ticket prices from GeneXus embedded JSON ──────────── */

  /**
   * Extract ticket prices from the embedded GeneXus purchase response JSON.
   * The page embeds a large JSON blob containing `vPURCHASEOPTIONSRESPONSE`
   * which has the full ticket data including prices and availability.
   *
   * Structure: Evt.Dates[].Times[].Tickets[] → each ticket has:
   *   - price: string like "14656.00" (total including fees)
   *   - unitPrice: string like "13324.00" (base price)
   *   - soldOut: boolean (on the parent Time/Date level)
   *   - caption: string (ticket type name, e.g. "Segunda Tanda")
   */
  private extractTicketPrices(
    $: cheerio.CheerioAPI,
    html: string,
  ): number[] {
    const purchaseData = this.extractGxPurchaseResponse($, html);
    if (!purchaseData) return [];

    const prices: number[] = [];

    try {
      const evt = (purchaseData as Record<string, unknown>).Evt as
        | Record<string, unknown>
        | undefined;
      if (!evt) return [];

      // Check if event is free
      if (evt.isFree === true) return [];

      const dates = evt.Dates as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(dates)) return [];

      for (const date of dates) {
        // Skip sold-out dates
        if (date.soldOut === true) continue;

        const times = date.Times as
          | Array<Record<string, unknown>>
          | undefined;
        if (!Array.isArray(times)) continue;

        for (const time of times) {
          // Skip sold-out times
          if (time.soldOut === true) continue;

          const tickets = time.Tickets as
            | Array<Record<string, unknown>>
            | undefined;
          if (!Array.isArray(tickets)) continue;

          for (const ticket of tickets) {
            // Use unitPrice (base price without fees) if available, else price
            const priceStr =
              (ticket.unitPrice as string) || (ticket.price as string);
            if (!priceStr) continue;

            const amount = Number.parseFloat(priceStr);
            if (!Number.isNaN(amount) && amount > 0) {
              prices.push(amount);
            }
          }
        }
      }
    } catch {
      // Ignore parse errors — fall back to other price extraction
    }

    return uniqueNumbers(prices);
  }

  /**
   * Check the GeneXus embedded data for an explicit isFree flag.
   */
  private extractIsFreeFromGx(
    $: cheerio.CheerioAPI,
    html: string,
  ): boolean | null {
    const purchaseData = this.extractGxPurchaseResponse($, html);
    if (!purchaseData) return null;

    try {
      const evt = (purchaseData as Record<string, unknown>).Evt as
        | Record<string, unknown>
        | undefined;
      return evt?.isFree === true ? true : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract the vPURCHASEOPTIONSRESPONSE JSON from the page's GeneXus state.
   *
   * Strategy:
   *   1. Parse the GXState hidden input (most reliable — clean JSON)
   *   2. Fallback: bracket counting in the raw HTML
   */
  private extractGxPurchaseResponse(
    $: cheerio.CheerioAPI,
    html: string,
  ): Record<string, unknown> | null {
    // ── Strategy 1: GXState hidden input ──
    const gxStateValue = $("input[name='GXState']").attr("value");

    if (gxStateValue) {
      try {
        const state = JSON.parse(gxStateValue) as Record<string, unknown>;
        // Find the key that ends with vPURCHASEOPTIONSRESPONSE
        // (the prefix varies: W0013, W0014, etc.)
        const purchaseKey = Object.keys(state).find((k) =>
          k.endsWith("vPURCHASEOPTIONSRESPONSE"),
        );

        if (purchaseKey && typeof state[purchaseKey] === "object") {
          return state[purchaseKey] as Record<string, unknown>;
        }
      } catch {
        // GXState parse failed, try fallback
      }
    }

    // ── Strategy 2: Bracket counting in raw HTML ──
    const marker = 'vPURCHASEOPTIONSRESPONSE":';
    const idx = html.indexOf(marker);
    if (idx === -1) return null;

    let i = idx + marker.length;
    while (i < html.length && html[i] === " ") i++;
    if (html[i] !== "{") return null;

    let depth = 0;
    let end = i;
    for (let j = i; j < html.length; j++) {
      if (html[j] === "{") depth++;
      else if (html[j] === "}") depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }

    try {
      return JSON.parse(html.substring(i, end)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Parse venue text from RedTickets detail page.
   * Format: "VenueName - Address, PostalCode City"
   * Preserves the address for geocoding.
   */
  private parseVenueText(raw: string | null): {
    venueName: string | null;
    venueAddress: string | null;
  } {
    if (!raw) return { venueName: null, venueAddress: null };

    const dashIdx = raw.indexOf(" - ");
    if (dashIdx > 0) {
      const name = normalizeWhitespace(raw.substring(0, dashIdx)) || null;
      const address = normalizeWhitespace(raw.substring(dashIdx + 3)) || null;
      return { venueName: name, venueAddress: address };
    }

    return { venueName: normalizeWhitespace(raw) || null, venueAddress: null };
  }
}
