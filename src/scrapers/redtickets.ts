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

const EVENT_PATH_REGEX = /\/evento\/([^/]+)\/(\d+)\/?$/i;

export class RedTicketsScraper extends BaseScraper {
  constructor() {
    super("redtickets");
  }

  protected async discoverUrls(): Promise<string[]> {
    const html = await fetchHtml(scraperConfig.redticketsBaseUrl);
    const $ = cheerio.load(html);

    const discoveredLinks: string[] = [];

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");

      if (!href) {
        return;
      }

      if (!EVENT_PATH_REGEX.test(href)) {
        return;
      }

      discoveredLinks.push(toAbsoluteUrl(scraperConfig.redticketsBaseUrl, href));
    });

    return unique(discoveredLinks);
  }

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

    const imageUrl =
      $("meta[property='og:image']").attr("content") ??
      $("img[src*='files.redtickets.uy']").first().attr("src") ??
      null;

    const category = this.extractCategory($);

    // RedTickets detail pages use span.Description.Flex for date and venue
    const descFlex = $("span.Description.Flex");
    const dateText = descFlex.eq(0).text().trim() || null;
    const rawVenueText = descFlex.eq(1).text().trim() || null;
    
    // Extract venue name AND address from "VenueName - Address, Postal City"
    const { venueName: rtVenueName, venueAddress: rtVenueAddress } = this.parseVenueText(rawVenueText);

    // RedTickets detail pages show $0 in cart — no reliable price from HTML
    // Skip price extraction for RedTickets (prices not in static HTML)
    const prices: number[] = [];

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
        imageUrl,
        prices,
        extractedAt: new Date().toISOString(),
      },
    };
  }

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
   * Parse venue text from RedTickets detail page.
   * Format: "VenueName - Address, PostalCode City"
   * Now preserves the address for geocoding.
   */
  private parseVenueText(raw: string | null): { venueName: string | null; venueAddress: string | null } {
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
