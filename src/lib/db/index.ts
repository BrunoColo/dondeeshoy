import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL no está configurada. Revisá tu archivo .env");
}

/**
 * Ensure we use Transaction mode (port 6543) for Supabase pooler.
 * Session mode (port 5432) has strict per-client limits that cause
 * "MaxClientsInSessionMode" errors under concurrent load.
 */
function ensureTransactionMode(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("pooler.supabase.com") && parsed.port === "5432") {
      parsed.port = "6543";
      return parsed.toString();
    }
  } catch {
    // If URL parsing fails, return as-is
  }
  return url;
}

const connectionUrl = ensureTransactionMode(databaseUrl);

const client = postgres(connectionUrl, {
  prepare: false,       // Required for Supabase transaction-mode pooler
  max: 3,               // Small app-side pool; Supabase pooler manages connections
  idle_timeout: 20,     // Release idle connections after 20s
  connect_timeout: 15,  // Timeout on initial connection
});

export const db = drizzle(client, { schema });
