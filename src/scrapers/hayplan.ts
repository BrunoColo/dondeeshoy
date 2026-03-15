import { scraperConfig } from "@/config/scraper-config";

import { BaseScraper } from "./base-scraper";
import type { ScrapedRawEvent } from "./types";
import { normalizeWhitespace, unique } from "./utils";

interface HayPlanApiEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  event_url: string | null;
  price: number | null;
  currency: string | null;
  ticket_types: unknown;
  ticket_purchase_url: string | null;
  ticket_purchase_web: string | null;
  ticket_purchase_phone: string | null;
  category: string | null;
  is_18_plus: boolean | null;
}

interface HayPlanEventsResponse {
  events: HayPlanApiEvent[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

const FREE_REJECT_REGEX =
  /evento\s+con\s+costo|consultar\s+costo|entrada\s*\$|ticket\s*\$|cubierto|bono\s+colaboraci[oó]n|desde\s*\$|con\s*costo/i;

interface ParsedTicketType {
  name: string | null;
  price: number | null;
}

export class HayPlanScraper extends BaseScraper {
  private readonly listCache = new Map<string, HayPlanApiEvent>();

  constructor() {
    super("hayplan");
  }

  protected async discoverUrls(): Promise<string[]> {
    const perPage = 50;
    const firstPage = await this.fetchListPage(1, perPage);

    for (const event of firstPage.events) {
      this.listCache.set(event.id, event);
    }

    const urls: string[] = [];
    for (const event of firstPage.events) {
      if (this.isEligibleFreeEvent(event)) {
        urls.push(this.buildDetailUrl(event.id));
      }
    }

    const boundedTotalPages = Math.max(1, Math.min(firstPage.total_pages || 1, scraperConfig.maxSearchPages));

    for (let page = 2; page <= boundedTotalPages; page += 1) {
      const payload = await this.fetchListPage(page, perPage);

      for (const event of payload.events) {
        this.listCache.set(event.id, event);
      }

      const pageUrls = payload.events
        .filter((event) => this.isEligibleFreeEvent(event))
        .map((event) => this.buildDetailUrl(event.id));

      urls.push(...pageUrls);

      if (payload.events.length === 0) {
        break;
      }
    }

    return unique(urls);
  }

  protected async scrapeEvent(url: string): Promise<ScrapedRawEvent | null> {
    const eventId = this.extractEventId(url);
    if (!eventId) return null;

    const detail = await this.fetchEventDetail(eventId);
    const summary = this.listCache.get(eventId);
    const event = detail ?? summary;

    if (!event) {
      return null;
    }

    if (!this.isEligibleFreeEvent(event)) {
      return null;
    }

    const title = normalizeWhitespace(event.title || "");
    if (!title) {
      return null;
    }

    const startIso = typeof event.start_time === "string" ? event.start_time : null;
    const endIso = typeof event.end_time === "string" ? event.end_time : null;

    const dateIso = this.extractDateIso(startIso);
    const startTime = this.extractTime(startIso);
    const endTime = this.extractTime(endIso);

    const description = normalizeWhitespace(event.description ?? "") || null;
    const venueText = normalizeWhitespace(event.location_name ?? "") || null;

    const sourceUrl =
      normalizeWhitespace(event.ticket_purchase_url ?? "") ||
      normalizeWhitespace(event.ticket_purchase_web ?? "") ||
      normalizeWhitespace(event.event_url ?? "") ||
      this.buildDetailUrl(eventId);

    return {
      source: "hayplan",
      sourceId: eventId,
      sourceUrl,
      rawData: {
        title,
        description,
        dateIso,
        dateText: startIso,
        startTime,
        endTime,
        venueText,
        venueAddress: venueText,
        imageUrl: event.image_url,
        category: event.category,
        prices: [],
        isFree: true,
        currency: normalizeWhitespace(event.currency ?? "") || "UYU",
        ageRestriction: event.is_18_plus ? 18 : null,
        latitude: typeof event.latitude === "number" ? event.latitude : null,
        longitude: typeof event.longitude === "number" ? event.longitude : null,
        eventUrl: event.event_url,
        ticketPurchaseUrl: event.ticket_purchase_url,
        ticketPurchaseWeb: event.ticket_purchase_web,
        ticketPurchasePhone: event.ticket_purchase_phone,
        ticketTypes: this.parseTicketTypes(event.ticket_types),
        extractedAt: new Date().toISOString(),
      },
    };
  }

  private async fetchListPage(page: number, perPage: number): Promise<HayPlanEventsResponse> {
    const url = `${scraperConfig.hayplanBackendUrl}/landing/events?page=${page}&per_page=${perPage}`;

    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        accept: "application/json",
      },
      signal: AbortSignal.timeout(scraperConfig.timeoutMs),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`[hayplan] API list returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as HayPlanEventsResponse;

    return {
      events: Array.isArray(payload.events) ? payload.events : [],
      page: payload.page ?? page,
      per_page: payload.per_page ?? perPage,
      total: payload.total ?? 0,
      total_pages: payload.total_pages ?? 1,
    };
  }

  private async fetchEventDetail(eventId: string): Promise<HayPlanApiEvent | null> {
    const url = this.buildDetailUrl(eventId);

    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        accept: "application/json",
      },
      signal: AbortSignal.timeout(scraperConfig.timeoutMs),
      cache: "no-store",
    });

    if (!response.ok) {
      // Some IDs are valid in listing but not available in detail yet.
      return null;
    }

    return (await response.json()) as HayPlanApiEvent;
  }

  private extractEventId(url: string): string | null {
    const match = url.match(/\/landing\/event\/([^/?#]+)/i);
    return match?.[1] ?? null;
  }

  private buildDetailUrl(eventId: string): string {
    return `${scraperConfig.hayplanBackendUrl}/landing/event/${eventId}`;
  }

  private extractDateIso(dateTime: string | null): string | null {
    if (!dateTime) return null;
    const m = dateTime.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?.[1] ?? null;
  }

  private extractTime(dateTime: string | null): string | null {
    if (!dateTime) return null;
    const m = dateTime.match(/T(\d{2}:\d{2})(?::\d{2})?/);
    if (!m) return null;
    return `${m[1]}:00`;
  }

  private isEligibleFreeEvent(event: HayPlanApiEvent): boolean {
    if (event.price !== 0) {
      return false;
    }

    const combined = normalizeWhitespace(`${event.title ?? ""} ${event.description ?? ""}`);
    if (FREE_REJECT_REGEX.test(combined)) {
      return false;
    }

    const ticketTypes = this.parseTicketTypes(event.ticket_types);

    if (ticketTypes.length > 0) {
      const hasFreeTicket = ticketTypes.some((ticket) => {
        const byPrice = ticket.price === 0;
        const byName = ticket.name ? /gratis|entrada\s+libre|sin\s+costo/i.test(ticket.name) : false;
        return byPrice || byName;
      });

      if (!hasFreeTicket) {
        return false;
      }
    }

    return true;
  }

  private parseTicketTypes(raw: unknown): ParsedTicketType[] {
    const normalized = this.parseTicketTypesValue(raw);
    const items = Array.isArray(normalized) ? normalized : [normalized];

    return items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => {
        const name = typeof item.name === "string" ? normalizeWhitespace(item.name) : null;
        const price =
          typeof item.price === "number"
            ? item.price
            : typeof item.price === "string"
              ? Number.parseFloat(item.price)
              : null;

        return {
          name,
          price: price != null && Number.isFinite(price) ? price : null,
        };
      });
  }

  private parseTicketTypesValue(raw: unknown): unknown {
    if (!raw) return [];

    if (typeof raw === "string") {
      const text = normalizeWhitespace(raw);
      if (!text || text === "[]") return [];

      try {
        return JSON.parse(text);
      } catch {
        return [];
      }
    }

    return raw;
  }
}
