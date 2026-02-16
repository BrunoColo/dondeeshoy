import { Ratelimit } from "@upstash/ratelimit";

import { scraperConfig } from "@/config/scraper-config";
import { redis } from "@/lib/redis";

const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(scraperConfig.requestsPerSecond, "1 s"),
  analytics: true,
  prefix: "ratelimit:scrapers",
});

export async function enforceRateLimit(key: string): Promise<void> {
  const { success, reset } = await rateLimiter.limit(key);

  if (success) {
    return;
  }

  const waitMs = Math.max(reset - Date.now(), 250);
  await sleep(waitMs);
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(scraperConfig.timeoutMs),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al obtener ${url}`);
  }

  return response.text();
}

export async function withRetry<T>(
  taskName: string,
  fn: () => Promise<T>,
  attempts = scraperConfig.retryAttempts,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await sleep(attempt * 400);
      }
    }
  }

  throw new Error(`${taskName} falló después de ${attempts} intentos: ${String(lastError)}`);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractMoneyValues(text: string): number[] {
  const values: number[] = [];
  const regex = /\$\s*([\d.]+)/g;

  for (const match of text.matchAll(regex)) {
    const normalized = match[1]?.replace(/\./g, "");

    if (!normalized) {
      continue;
    }

    const amount = Number.parseInt(normalized, 10);

    if (!Number.isNaN(amount) && amount > 0) {
      values.push(amount);
    }
  }

  return values;
}

export function toAbsoluteUrl(baseUrl: string, href: string): string {
  return new URL(href, baseUrl).toString();
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
