import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import { normalizeWhitespace, unique } from "./utils";

interface PasslineApiEvent {
  id: string | number;
  nombre?: string | null;
  slug?: string | null;
  url?: string | null;
  fecha_inicio?: string | null;
  hora_inicio?: string | null;
  fecha_termino?: string | null;
  hora_termino?: string | null;
  lugar?: string | null;
  image?: string | null;
  precio_min?: string | number | null;
  simbolo_moneda?: string | null;
}

type PasslineApiPayload = Record<string, unknown>;

type CachedPasslineEvent = {
  section: string;
  event: PasslineApiEvent;
};

export class PasslineScraper extends BaseScraper {
  private readonly cache = new Map<string, CachedPasslineEvent>();

  constructor() {
    super("passline");
  }

  protected async discoverUrls(): Promise<string[]> {
    const payload = await this.fetchBillboard();
    const urls: string[] = [];

    for (const [section, value] of Object.entries(payload)) {
      if (!Array.isArray(value)) continue;

      for (const maybeEvent of value) {
        if (!maybeEvent || typeof maybeEvent !== "object") continue;

        const event = maybeEvent as PasslineApiEvent;
        const sourceId = this.extractSourceId(event.id);
        const title = normalizeWhitespace(String(event.nombre ?? ""));
        if (!sourceId || !title) continue;

        const sourceUrl = this.resolveEventUrl(event, sourceId);
        this.cache.set(sourceUrl, { section, event });
        urls.push(sourceUrl);
      }
    }

    return unique(urls);
  }

  protected async scrapeEvent(url: string): Promise<ScrapedRawEvent | null> {
    const cached = this.cache.get(url);
    if (!cached) {
      return null;
    }

    const { event, section } = cached;
    const sourceId = this.extractSourceId(event.id);
    const title = normalizeWhitespace(String(event.nombre ?? ""));

    if (!sourceId || !title) {
      return null;
    }

    const startDateIso = this.normalizeDate(event.fecha_inicio);
    const endDateIso = this.normalizeDate(event.fecha_termino);
    const startTime = this.normalizeTime(event.hora_inicio);
    const endTime = this.normalizeTime(event.hora_termino);
    const venueName = normalizeWhitespace(String(event.lugar ?? "")) || null;
    const priceMin = this.normalizePrice(event.precio_min);
    const currency = this.normalizeCurrency(event.simbolo_moneda);

    return {
      source: "passline",
      sourceId,
      sourceUrl: url,
      rawData: {
        title,
        description: null,
        dateIso: startDateIso,
        dateText: startDateIso,
        endDateIso,
        startTime,
        endTime,
        venueName,
        venueAddress: venueName,
        imageUrl: normalizeWhitespace(String(event.image ?? "")) || null,
        eventUrl: normalizeWhitespace(String(event.url ?? "")) || null,
        slug: normalizeWhitespace(String(event.slug ?? "")) || null,
        section,
        prices: priceMin != null ? [priceMin] : [],
        currency,
        isFree: priceMin === 0,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  private async fetchBillboard(): Promise<PasslineApiPayload> {
    const response = await fetch(scraperConfig.passlineCountryBillboardUrl, {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "es-419,es;q=0.9,en;q=0.8",
        "content-type": "text/plain;charset=UTF-8",
        origin: scraperConfig.passlineHomeUrl,
        referer: `${scraperConfig.passlineHomeUrl}/`,
        "user-agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
      },
      body: JSON.stringify({
        country: "uruguay",
        limit: "0,48",
      }),
      signal: AbortSignal.timeout(scraperConfig.timeoutMs),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`[passline] Billboard API returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();

    if (!contentType.includes("application/json")) {
      const looksLikeCloudflareChallenge = /cloudflare|challenge|enable javascript and cookies/i.test(raw);
      if (looksLikeCloudflareChallenge) {
        throw new Error("[passline] Billboard API is protected by challenge (Cloudflare). Response was not JSON.");
      }

      throw new Error("[passline] Billboard API returned non-JSON content.");
    }

    const parsed = JSON.parse(raw) as PasslineApiPayload;

    if (!parsed || typeof parsed !== "object") {
      throw new Error("[passline] Unexpected API payload.");
    }

    return parsed;
  }

  private extractSourceId(value: string | number): string | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "string") {
      const normalized = normalizeWhitespace(value);
      return normalized || null;
    }

    return null;
  }

  private resolveEventUrl(event: PasslineApiEvent, sourceId: string): string {
    const apiUrl = normalizeWhitespace(String(event.url ?? ""));
    if (apiUrl) {
      return apiUrl;
    }

    const slug = normalizeWhitespace(String(event.slug ?? ""));
    if (slug) {
      return `${scraperConfig.passlineEventsBaseUrl}/${slug}`;
    }

    return `${scraperConfig.passlineEventsBaseUrl}/${sourceId}`;
  }

  private normalizeDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = normalizeWhitespace(value);
    const m = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?.[1] ?? null;
  }

  private normalizeTime(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = normalizeWhitespace(value);
    const m = normalized.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    const seconds = m[3] ?? "00";
    return `${m[1]}:${m[2]}:${seconds}`;
  }

  private normalizePrice(value: string | number | null | undefined): number | null {
    if (value == null) return null;

    const n =
      typeof value === "number"
        ? value
        : Number.parseFloat(String(value).replace(/[^\d.,-]/g, "").replace(",", "."));

    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n);
  }

  private normalizeCurrency(symbol: string | null | undefined): "UYU" | "USD" {
    const s = normalizeWhitespace(String(symbol ?? "")).toLowerCase();
    if (s.includes("usd") || s.includes("u$s") || s.includes("us$") || s.includes("dolar") || s.includes("dólar")) {
      return "USD";
    }

    return "UYU";
  }
}