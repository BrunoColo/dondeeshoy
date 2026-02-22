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

/**
 * Regex to extract the numeric event ID from the URL slug.
 * Example: /evento/pinta-boliche-21-febrero-28587 → "28587"
 */
const EVENT_ID_REGEX = /\/evento\/.*?-(\d+)$/i;

/**
 * Regex to match DD/MM/YYYY dates in body text.
 */
const DATE_REGEX = /\d{2}\/\d{2}\/\d{4}/g;

/**
 * Regex to extract opening/apertura time.
 */
const APERTURA_REGEX = /APERTURA[:\s]*(\d{1,2}:\d{2})/i;

/**
 * Regex to extract lat/lng from Google Maps search URL.
 */
const COORDS_REGEX = /maps\/search\/([-\d.]+),([-\d.]+)/;

/**
 * WhatsApp boilerplate lines to strip from descriptions.
 */
const WHATSAPP_BOILERPLATE = /Contáctanos a nuestro WhatsApp Oficial.*$/i;

export class MiEntradaScraper extends BaseScraper {
  constructor() {
    super("mientrada");
  }

  protected async discoverUrls(): Promise<string[]> {
    const baseUrl = scraperConfig.mientradaBaseUrl;
    const html = await fetchHtml(`${baseUrl}/agenda-geral`);
    const $ = cheerio.load(html);

    const discoveredLinks: string[] = [];

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");

      if (!href) return;
      if (!href.includes("/evento/")) return;
      if (!EVENT_ID_REGEX.test(href)) return;

      discoveredLinks.push(toAbsoluteUrl(baseUrl, href));
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

    const title = this.extractTitle($);

    if (!title) {
      return null;
    }

    const imageUrl = this.extractImage($);
    const { venueName, venueAddress, department } = this.extractVenue($);
    const { lat, lng } = this.extractCoordinates($);
    const dates = this.extractDates($);
    const aperturaTime = this.extractApertura($);
    const description = this.extractDescription($);
    const prices = this.extractPrices($);

    return {
      source: "mientrada",
      sourceId,
      sourceUrl: url,
      rawData: {
        title,
        imageUrl,
        venueName,
        venueAddress,
        department,
        lat,
        lng,
        dates,
        aperturaTime,
        description,
        prices,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Extract the numeric ID from the end of the event URL slug.
   */
  private extractSourceId(url: string): string | null {
    const match = url.match(EVENT_ID_REGEX);
    return match?.[1] ?? null;
  }

  /**
   * Extract the event title.
   * The first h1 on the page is the search placeholder "¿Qué estás buscando?",
   * so we pick the second h1 which is the actual event title.
   * Falls back to the page <title> tag minus the " - MI Entrada" suffix.
   */
  private extractTitle($: cheerio.CheerioAPI): string | null {
    const h1s: string[] = [];
    $("h1").each((_, el) => {
      const text = $(el).text().trim();
      if (text) h1s.push(text);
    });

    // Skip the first h1 (search bar) and use the second
    if (h1s.length > 1) {
      return normalizeWhitespace(h1s[1]);
    }

    // Fallback: <title> tag
    const pageTitle = $("title").text().trim();
    if (pageTitle) {
      return normalizeWhitespace(pageTitle.replace(/\s*-\s*MI\s*Entrada$/i, ""));
    }

    return null;
  }

  /**
   * Extract the event banner image URL.
   * Looks for img with alt containing "Capa" (banner images).
   */
  private extractImage($: cheerio.CheerioAPI): string | null {
    const src = $('img[alt*="Capa"]').attr("src");
    return src || null;
  }

  /**
   * Extract venue info from the Google Maps link text.
   * Format: "Venue Name, City/ Department"
   */
  private extractVenue($: cheerio.CheerioAPI): {
    venueName: string | null;
    venueAddress: string | null;
    department: string | null;
  } {
    const mapsLink = $('a[href*="maps"]').first();
    const text = mapsLink.text().replace(/\s+/g, " ").trim();

    if (!text) {
      return { venueName: null, venueAddress: null, department: null };
    }

    // Format: "Venue Name, City/ Department"
    const commaIdx = text.indexOf(",");
    if (commaIdx === -1) {
      return { venueName: normalizeWhitespace(text), venueAddress: null, department: null };
    }

    const venueName = normalizeWhitespace(text.slice(0, commaIdx));
    const rest = text.slice(commaIdx + 1).trim();

    // City/ Department
    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) {
      return { venueName, venueAddress: normalizeWhitespace(rest), department: null };
    }

    const city = rest.slice(0, slashIdx).trim();
    const department = rest.slice(slashIdx + 1).trim();

    return {
      venueName,
      venueAddress: normalizeWhitespace(city),
      department: normalizeWhitespace(department),
    };
  }

  /**
   * Extract coordinates from Google Maps link href.
   * URL pattern: https://www.google.com/maps/search/-30.948,-55.544
   */
  private extractCoordinates($: cheerio.CheerioAPI): {
    lat: number | null;
    lng: number | null;
  } {
    const href = $('a[href*="maps"]').first().attr("href") ?? "";
    const match = href.match(COORDS_REGEX);

    if (!match) {
      return { lat: null, lng: null };
    }

    const lat = Number.parseFloat(match[1]);
    const lng = Number.parseFloat(match[2]);

    return {
      lat: Number.isNaN(lat) ? null : lat,
      lng: Number.isNaN(lng) ? null : lng,
    };
  }

  /**
   * Extract all DD/MM/YYYY dates from the page body.
   */
  private extractDates($: cheerio.CheerioAPI): string[] {
    const bodyText = $.root().text();
    const matches = bodyText.match(DATE_REGEX) ?? [];
    return [...new Set(matches)];
  }

  /**
   * Extract the apertura (door opening) time.
   */
  private extractApertura($: cheerio.CheerioAPI): string | null {
    const bodyText = $.root().text();
    const match = bodyText.match(APERTURA_REGEX);
    return match?.[1] ?? null;
  }

  /**
   * Extract the event description from the "Descripción" section.
   * Strips WhatsApp boilerplate that commonly appears at the end.
   */
  private extractDescription($: cheerio.CheerioAPI): string | null {
    const descHeading = $("h2").filter((_, el) => $(el).text().includes("Descripción"));

    if (!descHeading.length) return null;

    // Grab text from the parent container
    let desc = descHeading.parent().text().replace("Descripción", "").trim();

    // Strip WhatsApp boilerplate
    desc = desc.replace(WHATSAPP_BOILERPLATE, "").trim();

    if (!desc) return null;

    return normalizeWhitespace(desc);
  }

  /**
   * Extract prices from the page.
   * Many events show "$0,00" for free events — we filter those out.
   */
  private extractPrices($: cheerio.CheerioAPI): number[] {
    const bodyText = normalizeWhitespace($.root().text());
    const prices = extractMoneyValues(bodyText);

    // Filter out zero-value prices (free events)
    return prices.filter((p) => p > 0);
  }
}
