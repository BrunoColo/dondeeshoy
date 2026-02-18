import * as cheerio from "cheerio";

import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import {
  extractMoneyValues,
  extractBestImageUrl,
  fetchHtml,
  normalizeWhitespace,
  toAbsoluteUrl,
  unique,
} from "./utils";

const EVENT_PATH_REGEX = /\/evento\/([^/?#]+)$/i;
const ENTRASTE_API_BASE = "https://api.entraste.com/sc";

export class EntrasteScraper extends BaseScraper {
  constructor() {
    super("entraste");
  }

  protected async discoverUrls(): Promise<string[]> {
    const html = await fetchHtml(scraperConfig.entrasteBaseUrl);
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

      discoveredLinks.push(toAbsoluteUrl(scraperConfig.entrasteBaseUrl, href));
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

    const title = normalizeWhitespace(
      $("h1").first().text() ||
        $("meta[property='og:title']").attr("content") ||
        $("title").text() ||
        "",
    );

    if (!title) {
      return null;
    }

    // Extract venue/address from structured HTML instead of body text
    const { venueName, venueAddress } = this.extractVenueFromHtml($);

    const bodyText = normalizeWhitespace($.root().text());
    const dateText = this.extractDateText(bodyText);

    // Prefer full-resolution img tags over og:image (which uses relative paths)
    const ogImage = this.resolveImageUrl($("meta[property='og:image']").attr("content"));
    const imageUrl =
      extractBestImageUrl($, url, [
        "img[src*='api.entraste.com']",
        "img[data-src*='api.entraste.com']",
        ".event img",
        "img",
      ]) ??
      ogImage;

    // Extract prices from .price elements instead of full body text
    const prices = this.extractPricesFromHtml($, bodyText);

    return {
      source: "entraste",
      sourceId,
      sourceUrl: url,
      rawData: {
        title,
        venueName,
        venueAddress,
        dateText,
        imageUrl,
        prices,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  private extractSourceId(url: string): string | null {
    const match = url.match(EVENT_PATH_REGEX);
    return match?.[1] ?? null;
  }

  /**
   * Extract venue name and address from the structured HTML.
   * Entraste uses: <p>Venue: {name}<br>Ubicación: {address}<br></p>
   */
  private extractVenueFromHtml($: cheerio.CheerioAPI): {
    venueName: string | null;
    venueAddress: string | null;
  } {
    let venueName: string | null = null;
    let venueAddress: string | null = null;

    // Find the <p> element that contains "Venue:"
    const venueP = $("p").filter((_, el) => $(el).text().includes("Venue:"));

    if (venueP.length > 0) {
      const htmlContent = venueP.html() ?? "";
      const parts = htmlContent.split(/<br\s*\/?>/i).map((part) => part.trim());

      for (const part of parts) {
        const textOnly = cheerio.load(part).text().trim();

        const venueMatch = textOnly.match(/Venue\s*:\s*(.+)/i);
        if (venueMatch?.[1]) {
          venueName = normalizeWhitespace(venueMatch[1]);
        }

        const addrMatch = textOnly.match(/Ubicaci[oó]n\s*:\s*(.+)/i);
        if (addrMatch?.[1]) {
          venueAddress = normalizeWhitespace(addrMatch[1]);
        }
      }
    }

    return { venueName, venueAddress };
  }

  /**
   * Turn relative og:image paths into absolute URLs.
   */
  private resolveImageUrl(rawUrl: string | undefined): string | null {
    if (!rawUrl) return null;

    if (rawUrl.startsWith("http")) return rawUrl;

    // Relative path like /uploads/thumbs/...
    return `${ENTRASTE_API_BASE}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  }

  /**
   * Extract prices from CSS .price elements first, fall back to body text.
   */
  private extractPricesFromHtml($: cheerio.CheerioAPI, bodyText: string): number[] {
    const priceEls = $(".price, .precio");
    const prices: number[] = [];

    priceEls.each((_, el) => {
      const text = $(el).text().trim();
      const numMatch = text.match(/^[\d.,]+$/);
      if (numMatch) {
        const amount = Number.parseInt(text.replace(/\./g, "").replace(",", ""), 10);
        if (!Number.isNaN(amount) && amount > 0) {
          prices.push(amount);
        }
      }
    });

    if (prices.length > 0) return prices;

    // Fallback to extracting from text
    return extractMoneyValues(bodyText);
  }

  private extractDateText(fullText: string): string | null {
    const match = fullText.match(
      /(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+\d{1,2}\s+de\s+[a-záéíóúñ]+(?:\s+a\s+las\s+\d{1,2}:\d{2})?/i,
    );

    return match ? normalizeWhitespace(match[0]) : null;
  }
}
