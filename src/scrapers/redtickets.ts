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
    const imageUrl =
      $("meta[property='og:image']").attr("content") ??
      $("img[src*='files.redtickets.uy']").first().attr("src") ??
      null;

    const category = this.extractCategory($);
    const dateText = this.extractDateText(bodyText);
    const venueText = this.extractVenueText($, bodyText);
    const prices = extractMoneyValues(bodyText);

    return {
      source: "redtickets",
      sourceId,
      sourceUrl: url,
      rawData: {
        title,
        category,
        dateText,
        venueText,
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

  private extractDateText(fullText: string): string | null {
    const match = fullText.match(
      /(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+\d{1,2}\s+de\s+[a-záéíóúñ]+(?:\s*-\s*\d{1,2}(?::\d{2})?\s*hs?)?/i,
    );

    return match ? normalizeWhitespace(match[0]) : null;
  }

  private extractVenueText($: cheerio.CheerioAPI, fullText: string): string | null {
    const fromSelectors = normalizeWhitespace(
      $("[class*='venue']").first().text() ||
        $("[class*='lugar']").first().text() ||
        $("[class*='location']").first().text() ||
        "",
    );

    if (fromSelectors) {
      return fromSelectors;
    }

    const fromText = fullText.match(/(?:lugar|ubicación|ubicacion)\s*:?\s*([\w\s,.-]{4,120})/i);
    return fromText ? normalizeWhitespace(fromText[1] ?? "") : null;
  }
}
