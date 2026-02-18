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

    // ── Source 1: Homepage ──
    try {
      const homeLinks = await this.discoverLinksFromPage(
        scraperConfig.redticketsBaseUrl,
      );
      allLinks.push(...homeLinks);
      console.log(`[redtickets] homepage: ${homeLinks.length} event links`);
    } catch (error) {
      console.error("[redtickets] error discovering from homepage", error);
    }

    // ── Source 2: Search / busqueda pages (paginated) ──
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

    // Look for category text
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

    // Category: prefer detail page, fallback to search card metadata
    const detailCategory = this.extractCategory($);
    const cardMeta = this.searchCardMeta.get(url);
    const category = detailCategory || cardMeta?.category || null;

    // Image: prefer detail page, fallback to search card thumbnail
    const finalImageUrl = imageUrl || cardMeta?.imageUrl || null;

    // RedTickets detail pages use span.Description.Flex for date and venue
    const descFlex = $("span.Description.Flex");
    const dateText = descFlex.eq(0).text().trim() || null;
    const rawVenueText = descFlex.eq(1).text().trim() || null;

    // Extract venue name AND address from "VenueName - Address, Postal City"
    const { venueName: rtVenueName, venueAddress: rtVenueAddress } =
      this.parseVenueText(rawVenueText);

    // Attempt price extraction from JSON-LD / meta tags
    const prices = this.extractPrices($);

    return {
      source: "redtickets",
      sourceId,
      sourceUrl: url,
      rawData: {
        title,
        category,
        dateText,
        venueText: rtVenueName,
        venueAddress: rtVenueAddress,
        imageUrl: finalImageUrl,
        prices,
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
    const candidate =
      $("[class*='category']").first().text() ||
      $("[class*='categoria']").first().text() ||
      $(".badge").first().text();

    const normalized = normalizeWhitespace(candidate ?? "");
    return normalized || null;
  }

  /**
   * Attempt to extract prices from JSON-LD structured data or meta tags.
   * RedTickets may include Schema.org Event → offers → Offer → price,
   * or meta tags like product:price:amount.
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

    return uniqueNumbers(prices);
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
