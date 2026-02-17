import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import { redis } from "@/lib/redis";

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

export function getNoStoreHeaders(): Record<string, string> {
  return NO_STORE_HEADERS;
}

function secureStringEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token.trim();
}

export function isCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return false;
  }

  const byHeader = request.headers.get("x-cron-secret")?.trim();
  const byBearer = getBearerToken(request);

  if (byHeader && secureStringEquals(byHeader, expected)) {
    return true;
  }

  if (byBearer && secureStringEquals(byBearer, expected)) {
    return true;
  }

  return false;
}

export function normalizeBatchSize(value: string | null, fallback = 50, max = 200): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(parsed, max));
}

export interface CronLock {
  key: string;
  token: string;
}

export async function acquireCronLock(jobName: string, ttlSeconds = 600): Promise<CronLock | null> {
  const key = `lock:cron:${jobName}`;
  const token = randomUUID();
  const result = await redis.set(key, token, { nx: true, ex: ttlSeconds });

  if (result !== "OK") {
    return null;
  }

  return { key, token };
}

export async function releaseCronLock(lock: CronLock): Promise<void> {
  const current = await redis.get<string | null>(lock.key);

  if (current !== lock.token) {
    return;
  }

  await redis.del(lock.key);
}