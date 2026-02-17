import * as cheerio from "cheerio";

import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import { fetchHtml, normalizeWhitespace, unique } from "./utils";

const SHOW_PATH_REGEX = /averespectaculo\.aspx\?(\d+)/i;

const MONTHS: Record<string, string> = {
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

/**
 * Scraper for cartelera.montevideo.com.uy — Uruguay's main theater and music listings.
 * Discovers shows from the /teatro and /musica pages on cartelera.com.uy,
 * then scrapes individual show pages from cartelera.montevideo.com.uy.
 * Creates one raw event per show+date combination.
 */
export class CarteleraScraper extends BaseScraper {
  constructor() {
    super("cartelera");
  }

  protected async discoverUrls(): Promise<string[]> {
    const allLinks: string[] = [];

    for (const section of ["/teatro", "/musica"]) {
      try {
        const html = await fetchHtml(`${scraperConfig.carteleraFrontUrl}${section}`);
        const $ = cheerio.load(html);

        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (href && SHOW_PATH_REGEX.test(href)) {
            allLinks.push(href.startsWith("http") ? href : `${scraperConfig.carteleraBaseUrl}/${href.replace(/^\/+/, "")}`);
          }
        });
      } catch (error) {
        console.error(`[cartelera] error descubriendo ${section}`, error);
      }
    }

    return unique(allLinks);
  }

  /**
   * Scrapes a show page and returns multiple raw events (one per date).
   * The base class calls this once per URL, but we store multiple date entries
   * by encoding the date into the sourceId.
   */
  protected async scrapeEvent(url: string): Promise<ScrapedRawEvent | null> {
    const showId = this.extractShowId(url);
    if (!showId) return null;

    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Title from itemprop or h2 name
    const title = normalizeWhitespace(
      $("[itemprop='alternateName']").first().text() ||
        $("h2.name").first().text() ||
        $("h1").first().text() ||
        $("title").text().replace(/ - Cartelera$/i, "") ||
        "",
    );

    if (!title) return null;

    // Genre
    const genre =
      normalizeWhitespace($("[itemprop='genre']").first().text()) || null;

    // Duration
    const durationRaw = $("[itemprop='duration']").first().text();
    const duration = durationRaw ? normalizeWhitespace(durationRaw) : null;

    const { venueName, venueAddress } = this.extractVenueData($);

    // Image
    const imageUrl =
      $("meta[property='og:image']").attr("content") ??
      $(".poster img").first().attr("src") ??
      null;

    // Description
    const description = normalizeWhitespace(
      $("[itemprop='description']").first().text(),
    ).substring(0, 1000) || null;

    // Price
    const priceText = $(".precio, .price").first().text();
    const prices = this.extractPrices(priceText || $.text());

    // Cast
    const cast = $("[itemprop='actor']")
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get()
      .filter((t: string) => t.length > 0);

    // Extract all schedule dates+times from lista-horarios
    const schedules = this.extractSchedules($);

    if (schedules.length === 0) {
      // No specific dates found — store as single event with today
      return {
        source: "cartelera",
        sourceId: showId,
        sourceUrl: url,
        rawData: {
          title,
          genre,
          duration,
          description,
          venueText: venueName,
          venueAddress,
          imageUrl,
          prices,
          cast: cast.length > 0 ? cast : undefined,
          dateText: null,
          extractedAt: new Date().toISOString(),
        },
      };
    }

    // Store the first date as the main event, additional dates will be
    // handled by overriding the run method
    this._pendingMultiDateEvents = this._pendingMultiDateEvents || [];
    for (const sched of schedules) {
      this._pendingMultiDateEvents.push({
        source: "cartelera",
        sourceId: `${showId}-${sched.date}`,
        sourceUrl: url,
        rawData: {
          title,
          genre,
          duration,
          description,
          venueText: venueName,
          venueAddress,
          imageUrl,
          prices,
          cast: cast.length > 0 ? cast : undefined,
          dateText: sched.dateText,
          startTime: sched.time,
          extractedAt: new Date().toISOString(),
        },
      });
    }

    // Return the first one to satisfy the base class contract
    return this._pendingMultiDateEvents[this._pendingMultiDateEvents.length - schedules.length] ?? null;
  }

  private _pendingMultiDateEvents: ScrapedRawEvent[] = [];

  /**
   * Override run to handle multi-date events.
   * After scraping all URLs, save all pending multi-date events.
   */
  async run() {
    this._pendingMultiDateEvents = [];
    const result = await super.run();

    // The base class already saved the first event per URL.
    // Now save remaining multi-date events (skip first per show since it's already saved).
    const savedIds = new Set<string>();

    for (const event of this._pendingMultiDateEvents) {
      if (savedIds.has(event.sourceId)) continue;
      savedIds.add(event.sourceId);

      try {
        // Use the base class saveRawEvent indirectly by re-running through the save
        await this.saveExtra(event);
      } catch (error) {
        console.error(`[cartelera] error guardando evento extra ${event.sourceId}`, error);
      }
    }

    return {
      ...result,
      scraped: savedIds.size,
      saved: savedIds.size,
    };
  }

  private async saveExtra(event: ScrapedRawEvent): Promise<void> {
    const { db } = await import("@/lib/db");
    const { rawEvents } = await import("@/lib/db/schema");

    await db
      .insert(rawEvents)
      .values({
        source: event.source,
        sourceId: event.sourceId,
        sourceUrl: event.sourceUrl,
        rawData: event.rawData,
        scrapedAt: new Date(),
        processed: false,
        processingError: null,
      })
      .onConflictDoUpdate({
        target: [rawEvents.source, rawEvents.sourceId],
        set: {
          sourceUrl: event.sourceUrl,
          rawData: event.rawData,
          scrapedAt: new Date(),
          processed: false,
          processingError: null,
        },
      });
  }

  private extractShowId(url: string): string | null {
    const match = url.match(SHOW_PATH_REGEX);
    return match?.[1] ?? null;
  }

  private extractSchedules($: cheerio.CheerioAPI): Array<{ date: string; dateText: string; time: string | null }> {
    const schedules: Array<{ date: string; dateText: string; time: string | null }> = [];

    $(".lista-horarios > li").each((_, li) => {
      const dateHeading = normalizeWhitespace($(li).find(".subheading").text());
      const times: string[] = [];

      $(li).find(".hour").each((__, hourEl) => {
        const t = normalizeWhitespace($(hourEl).text());
        if (t) times.push(t);
      });

      if (!dateHeading) return;

      const parsed = this.parseDateHeading(dateHeading);
      if (!parsed) return;

      if (times.length > 0) {
        for (const time of times) {
          schedules.push({
            date: parsed,
            dateText: `${dateHeading} ${time}`,
            time,
          });
        }
      } else {
        schedules.push({
          date: parsed,
          dateText: dateHeading,
          time: null,
        });
      }
    });

    return schedules;
  }

  /**
   * Parse "Sábado 21 de Febrero" → "2025-02-21"
   */
  private parseDateHeading(text: string): string | null {
    const match = text.match(/(\d{1,2})\s+de\s+(\w+)/i);
    if (!match) return null;

    const day = match[1].padStart(2, "0");
    const monthName = match[2].toLowerCase();
    const month = MONTHS[monthName];
    if (!month) return null;

    const now = new Date();
    let year = now.getFullYear();

    // If the month is before the current month, assume next year
    const monthNum = Number.parseInt(month, 10);
    if (monthNum < now.getMonth() + 1) {
      year += 1;
    }

    return `${year}-${month}-${day}`;
  }

  private extractPrices(text: string): number[] {
    const values: number[] = [];
    const regex = /\$\s*([\d.,]+)/g;
    for (const match of text.matchAll(regex)) {
      const normalized = match[1]?.replace(/\./g, "").replace(",", ".");
      if (!normalized) continue;
      const amount = Number.parseFloat(normalized);
      if (!Number.isNaN(amount) && amount > 0) {
        values.push(amount);
      }
    }
    return values;
  }

  private extractVenueData($: cheerio.CheerioAPI): { venueName: string | null; venueAddress: string | null } {
    const selectors = [
      ".salas a",
      ".salas",
      "[itemprop='location']",
      ".teatro a",
      ".teatro",
      ".sala a",
      ".sala",
      "[class*='sala'] a",
      "[class*='sala']",
    ];

    let rawVenue = "";
    for (const selector of selectors) {
      const el = $(selector).first();
      if (el.length === 0) continue;

      const text = selector.includes(".salas")
        ? normalizeWhitespace(el.clone().children("script").remove().end().text())
        : normalizeWhitespace(el.text());

      if (text) {
        rawVenue = text;
        break;
      }
    }

    const cleaned = rawVenue
      .replace(/Ver en mapa.*$/i, "")
      .replace(/Funciones?.*$/i, "")
      .trim();

    if (!cleaned) {
      return { venueName: null, venueAddress: null };
    }

    const parts = cleaned.split(/\s+-\s+/);
    const venueName = normalizeWhitespace(parts[0] ?? "") || null;
    const venueAddress = parts.length > 1 ? normalizeWhitespace(parts.slice(1).join(" - ")) || null : null;

    return { venueName, venueAddress };
  }
}
