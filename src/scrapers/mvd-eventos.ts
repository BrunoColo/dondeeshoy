import * as cheerio from "cheerio";

import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import { fetchHtml, normalizeWhitespace, unique } from "./utils";

// Months mapping for future use in date parsing
const _MONTHS: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};
void _MONTHS;

const CATEGORY_PAGES = [
  "/categoria/musica",
  "/categoria/artes-escenicas",
  "/categoria/carnaval",
  "/categoria/deportes",
  "/categoria/recreacion",
  "/categoria/audiovisual",
  "/categoria/artes-visuales",
  "/categoria/literatura",
  "/categoria/paseos",
];

/**
 * Scraper for eventos.montevideo.gub.uy — Montevideo government cultural events.
 * Discovers events from category pages, then scrapes individual event/activity detail pages
 * which are Drupal-based with well-structured field classes.
 */
export class MvdEventosScraper extends BaseScraper {
  constructor() {
    super("mvd_eventos");
  }

  protected async discoverUrls(): Promise<string[]> {
    const allLinks: string[] = [];
    const base = scraperConfig.mvdEventosBaseUrl;

    // Discover from homepage
    try {
      const homeHtml = await fetchHtml(base);
      const $home = cheerio.load(homeHtml);
      $home('a[href*="/evento/"], a[href*="/actividad/"]').each((_, el) => {
        const href = $home(el).attr("href");
        if (href) {
          // Ensure https
          const fullUrl = href.startsWith("http")
            ? href.replace(/^http:\/\//, "https://")
            : `${base}${href}`;
          allLinks.push(fullUrl);
        }
      });
    } catch (error) {
      console.error("[mvd_eventos] error descubriendo desde homepage", error);
    }

    // Discover from category pages
    for (const cat of CATEGORY_PAGES) {
      try {
        const html = await fetchHtml(`${base}${cat}`);
        const $ = cheerio.load(html);
        $('a[href*="/evento/"], a[href*="/actividad/"]').each((_, el) => {
          const href = $(el).attr("href");
          if (href) {
            const fullUrl = href.startsWith("http")
              ? href.replace(/^http:\/\//, "https://")
              : `${base}${href}`;
            allLinks.push(fullUrl);
          }
        });
      } catch (error) {
        console.error(`[mvd_eventos] error descubriendo ${cat}`, error);
      }
    }

    // Filter out parent event pages that are just containers (e.g., /evento/cine-en-el-maua without a sub-event)
    // Keep the most specific URLs
    const urls = unique(allLinks).filter((url) => {
      // Exclude aggregate/container pages like /agenda-anteriores
      if (url.includes("agenda-anteriores")) return false;
      return true;
    });

    return urls;
  }

  protected async scrapeEvent(url: string): Promise<ScrapedRawEvent | null> {
    const sourceId = this.extractSourceId(url);
    if (!sourceId) return null;

    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Title — Drupal field--name-title or fallback to h1
    const title = normalizeWhitespace(
      $(".field--name-title").first().text() ||
        $("h1").first().text() ||
        $("title").text().replace(/\s*\|.*$/, "") ||
        "",
    );

    if (!title) return null;

    // Description from field--name-field-contenido
    const description = normalizeWhitespace(
      $("[class*='field--name-field-contenido']").first().text() ||
        $("[class*='field--name-field-resumen']").first().text() ||
        "",
    ).substring(0, 1000) || null;

    // Venue from field--name-field-donde — text is often inside a <p> within the div
    const dondeField = $("[class*='field--name-field-donde']").first();
    const venueName = normalizeWhitespace(
      dondeField.find("p").first().text() || dondeField.text() || "",
    ) || null;

    // Category from field--name-field-categoria-listado
    const category = normalizeWhitespace(
      $("[class*='field--name-field-categoria-listado']").first().text() || "",
    ) || null;

    // Parent event name
    const parentEvent = normalizeWhitespace(
      $("[class*='field--name-field-evento-pertenece']").first().text() || "",
    ) || null;

    // Image
    const imageUrl =
      $("meta[property='og:image']").attr("content") ??
      $("[class*='field--name-field-imagen-miniatura-listados'] img").first().attr("src") ??
      $("[class*='field--name-field-imagen'] img").first().attr("src") ??
      $("[class*='field--name-field-media-image'] img").first().attr("src") ??
      null;

    // Dates from field--name-field-fechas
    const dateText = this.extractDates($);

    // Check if free
    const bodyText = `${title} ${description ?? ""}`.toLowerCase();
    const isFree =
      /\b(gratis|gratuito|entrada libre|free|sin cargo|sin costo|evento gratuito)\b/i.test(bodyText);

    // Resolve the full image URL
    const fullImageUrl = imageUrl && !imageUrl.startsWith("http")
      ? `${scraperConfig.mvdEventosBaseUrl}${imageUrl}`
      : imageUrl;

    return {
      source: "mvd_eventos",
      sourceId,
      sourceUrl: url,
      rawData: {
        title: parentEvent ? `${parentEvent}: ${title}` : title,
        description,
        dateText,
        venueText: venueName,
        category,
        imageUrl: fullImageUrl,
        isFree,
        prices: isFree ? [] : undefined,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  private extractSourceId(url: string): string | null {
    // Extract path after /evento/ or /actividad/
    const match = url.match(/\/(?:evento|actividad)\/([\w-]+(?:\/[\w-]+)?)\/?$/i);
    if (!match) return null;
    return match[1].replace(/\//g, "--"); // Replace / with -- for safe sourceId
  }

  private extractDates($: cheerio.CheerioAPI): string | null {
    // Try to find dates from Drupal date fields
    const dateField = $(".field--name-field-fechas");
    if (dateField.length > 0) {
      const dateItems = dateField.find(".field__item, .datetime");
      const dates: string[] = [];
      dateItems.each((_, el) => {
        const text = normalizeWhitespace($(el).text());
        if (text) dates.push(text);
      });
      if (dates.length > 0) return dates.join("; ");
    }

    // Try field--name-field-resumen which sometimes has date info
    const resumen = normalizeWhitespace(
      $(".field--name-field-resumen .field__item").first().text() || "",
    );
    if (resumen && /\d{1,2}\s+de\s+\w+/i.test(resumen)) {
      return resumen;
    }

    // Try to find date from general content
    const mainText = normalizeWhitespace($.text());
    const dateMatch = mainText.match(
      /(?:Viernes|Sábado|Domingo|Lunes|Martes|Miércoles|Jueves)[,\s]+(\d{1,2}(?:\/\d{2})?(?:\/\d{2,4})?)/i,
    );
    if (dateMatch) return dateMatch[0];

    // Look for DD/MM/YYYY patterns
    const ddmmMatch = mainText.match(/\d{2}\/\d{2}\/\d{4}/);
    if (ddmmMatch) return ddmmMatch[0];

    return null;
  }
}
