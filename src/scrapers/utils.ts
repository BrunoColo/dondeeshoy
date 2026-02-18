import { Ratelimit } from "@upstash/ratelimit";
import type { CheerioAPI } from "cheerio";

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

function normalizeImageUrl(baseUrl: string, rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  try {
    return toAbsoluteUrl(baseUrl, trimmed);
  } catch {
    return null;
  }
}

function pickBestFromSrcset(srcset: string | null | undefined): string | null {
  if (!srcset) return null;

  const entries = srcset
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, size] = part.split(/\s+/);
      const numeric = size ? Number.parseFloat(size) : Number.NaN;
      return { url, score: Number.isNaN(numeric) ? 0 : numeric };
    });

  if (entries.length === 0) return null;

  const best = entries.reduce((acc, cur) => (cur.score >= acc.score ? cur : acc));
  return best.url ?? null;
}

function extractJsonLdImages($: CheerioAPI): string[] {
  const images: string[] = [];

  $("script[type='application/ld+json']").each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const stack = Array.isArray(parsed) ? parsed : [parsed];

      while (stack.length > 0) {
        const node = stack.pop();
        if (!node || typeof node !== "object") continue;

        const imageField = (node as { image?: unknown }).image;
        if (typeof imageField === "string") {
          images.push(imageField);
        } else if (Array.isArray(imageField)) {
          for (const img of imageField) {
            if (typeof img === "string") images.push(img);
            if (img && typeof img === "object" && "url" in img && typeof img.url === "string") {
              images.push(img.url);
            }
          }
        } else if (imageField && typeof imageField === "object" && "url" in imageField) {
          const url = (imageField as { url?: unknown }).url;
          if (typeof url === "string") images.push(url);
        }

        for (const value of Object.values(node)) {
          if (value && typeof value === "object") {
            stack.push(value);
          }
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  });

  return images;
}

export function extractBestImageUrl(
  $: CheerioAPI,
  baseUrl: string,
  selectors: string[] = ["img"],
): string | null {
  const candidates: string[] = [];

  const metaCandidates = [
    $("meta[property='og:image']").attr("content"),
    $("meta[property='og:image:url']").attr("content"),
    $("meta[property='og:image:secure_url']").attr("content"),
    $("meta[name='twitter:image']").attr("content"),
    $("meta[name='twitter:image:src']").attr("content"),
  ];

  for (const value of metaCandidates) {
    if (value) candidates.push(value);
  }

  candidates.push(...extractJsonLdImages($));

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const srcset = $(el).attr("srcset") ?? $(el).attr("data-srcset");
      const bestFromSrcset = pickBestFromSrcset(srcset);
      if (bestFromSrcset) candidates.push(bestFromSrcset);

      const dataSrc = $(el).attr("data-src") ?? $(el).attr("data-original") ?? $(el).attr("data-lazy");
      if (dataSrc) candidates.push(dataSrc);

      const src = $(el).attr("src");
      if (src) candidates.push(src);

      const style = $(el).attr("style") ?? "";
      const match = style.match(/url\((['"]?)(.*?)\1\)/i);
      if (match?.[2]) {
        candidates.push(match[2]);
      }
    });
  }

  $("[style*='background-image'], [style*='background:']").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const match = style.match(/url\((['"]?)(.*?)\1\)/i);
    if (match?.[2]) {
      candidates.push(match[2]);
    }
  });

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeImageUrl(baseUrl, candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    return normalized;
  }

  return null;
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
