import * as cheerio from "cheerio";

import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import {
  extractMoneyValues,
  fetchHtml,
  normalizeWhitespace,
  toAbsoluteUrl,
  unique,
} from "./utils";

const EVENT_PATH_REGEX = /\/evento\/([^/?#]+)$/i;

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

    const bodyText = normalizeWhitespace($.root().text());

    const venueName = this.findLabelValue(bodyText, ["Venue"]);
    const venueAddress = this.findLabelValue(bodyText, ["Ubicación", "Ubicacion", "Location"]);
    const dateText = this.extractDateText(bodyText);

    const imageUrl =
      $("meta[property='og:image']").attr("content") ??
      $("img[src*='api.entraste.com']").first().attr("src") ??
      null;

    const prices = extractMoneyValues(bodyText);

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

  private findLabelValue(fullText: string, labels: string[]): string | null {
    for (const label of labels) {
      const regex = new RegExp(`${label}\\s*:?\\s*([^|•\\n]{3,120})`, "i");
      const match = fullText.match(regex);

      if (!match?.[1]) {
        continue;
      }

      const normalized = normalizeWhitespace(match[1]);

      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private extractDateText(fullText: string): string | null {
    const match = fullText.match(
      /(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+\d{1,2}\s+de\s+[a-záéíóúñ]+(?:\s+a\s+las\s+\d{1,2}:\d{2})?/i,
    );

    return match ? normalizeWhitespace(match[0]) : null;
  }
}
