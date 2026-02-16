export type SupportedSource = "redtickets" | "entraste";

export interface ScrapedRawEvent {
  source: SupportedSource;
  sourceId: string;
  sourceUrl: string;
  rawData: Record<string, unknown>;
}

export interface ScraperRunResult {
  source: SupportedSource;
  discovered: number;
  scraped: number;
  saved: number;
  errors: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}
