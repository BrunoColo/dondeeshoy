import { db } from "@/lib/db";
import { rawEvents } from "@/lib/db/schema";

import type { ScrapedRawEvent, ScraperRunResult, SupportedSource } from "./types";
import { enforceRateLimit, withRetry } from "./utils";

export abstract class BaseScraper {
  protected readonly source: SupportedSource;

  protected constructor(source: SupportedSource) {
    this.source = source;
  }

  protected abstract discoverUrls(): Promise<string[]>;
  protected abstract scrapeEvent(url: string): Promise<ScrapedRawEvent | null>;

  async run(): Promise<ScraperRunResult> {
    const startedAtDate = new Date();

    let discovered = 0;
    let scraped = 0;
    let saved = 0;
    let errors = 0;

    const urls = await withRetry(`${this.source}:discover`, async () => this.discoverUrls());
    discovered = urls.length;

    for (const url of urls) {
      try {
        await enforceRateLimit(`source:${this.source}`);

        const payload = await withRetry(`${this.source}:scrape:${url}`, async () => this.scrapeEvent(url));

        if (!payload) {
          continue;
        }

        scraped += 1;
        await this.saveRawEvent(payload);
        saved += 1;
      } catch (error) {
        errors += 1;
        console.error(`[${this.source}] error scrapeando ${url}`, error);
      }
    }

    const finishedAtDate = new Date();

    return {
      source: this.source,
      discovered,
      scraped,
      saved,
      errors,
      startedAt: startedAtDate.toISOString(),
      finishedAt: finishedAtDate.toISOString(),
      durationMs: finishedAtDate.getTime() - startedAtDate.getTime(),
    };
  }

  protected async saveRawEvent(payload: ScrapedRawEvent): Promise<void> {
    await db
      .insert(rawEvents)
      .values({
        source: payload.source,
        sourceId: payload.sourceId,
        sourceUrl: payload.sourceUrl,
        rawData: payload.rawData,
        scrapedAt: new Date(),
        processed: false,
        processingError: null,
      })
      .onConflictDoUpdate({
        target: [rawEvents.source, rawEvents.sourceId],
        set: {
          sourceUrl: payload.sourceUrl,
          rawData: payload.rawData,
          scrapedAt: new Date(),
          processed: false,
          processingError: null,
        },
      });
  }
}
