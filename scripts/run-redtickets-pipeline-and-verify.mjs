import "dotenv/config";
import postgres from "postgres";

const BASE_URL = "http://localhost:3000";
const BATCH_SIZE = 200;
const MAX_RETRIES = 40;
const RETRY_DELAY_MS = 15_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callEndpoint(path, cronSecret) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-cron-secret": cronSecret },
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  return { status: res.status, payload };
}

function extractProcessedCount(payload) {
  if (!payload || typeof payload !== "object") return 0;
  const obj = payload;
  const candidates = [obj.processed, obj.processedCount, obj.count, obj.totalProcessed];

  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  }

  return 0;
}

async function runWithConflictRetry(label, path, cronSecret) {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    const result = await callEndpoint(path, cronSecret);

    if (result.status === 409) {
      console.log(`[${label}] intento ${i}/${MAX_RETRIES}: lock activo (409), reintentando en ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    return result;
  }

  throw new Error(`${label} quedó bloqueado por lock 409 tras ${MAX_RETRIES} intentos`);
}

async function runPipelineBatches(cronSecret) {
  let totalProcessed = 0;

  for (let batchRun = 1; batchRun <= 20; batchRun++) {
    const result = await runWithConflictRetry(
      `process batch ${batchRun}`,
      `/api/scrape/process?batch=${BATCH_SIZE}`,
      cronSecret,
    );

    if (result.status >= 400) {
      throw new Error(`process batch ${batchRun} falló con ${result.status}: ${JSON.stringify(result.payload)}`);
    }

    const processedNow = extractProcessedCount(result.payload);
    totalProcessed += processedNow;

    console.log(`[process] corrida ${batchRun}: status=${result.status}, processed=${processedNow}`);

    if (processedNow <= 0) {
      break;
    }
  }

  return totalProcessed;
}

async function verifyPanPot() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definido en .env");
  }

  const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

  try {
    const eventRows = await sql`
      SELECT
        e.id,
        e.name,
        e.date,
        e.price_min,
        e.price_max,
        e.updated_at,
        es.source,
        es.source_url
      FROM events e
      JOIN event_sources es ON es.event_id = e.id
      WHERE es.source = 'redtickets'
        AND e.name ILIKE ${"%PAN-POT%"}
      ORDER BY e.updated_at DESC
      LIMIT 5
    `;

    const rawRows = await sql`
      SELECT
        id,
        source_id,
        source_url,
        processed,
        scraped_at,
        raw_data->>'title' AS title,
        raw_data->'prices' AS prices
      FROM raw_events
      WHERE source = 'redtickets'
        AND (
          raw_data->>'title' ILIKE ${"%PAN-POT%"}
          OR source_url ILIKE ${"%PAN-POT%"}
          OR source_url ILIKE ${"%pan-pot%"}
        )
      ORDER BY scraped_at DESC
      LIMIT 10
    `;

    const summarizeRaw = rawRows.map((row) => {
      const prices = Array.isArray(row.prices)
        ? row.prices
            .map((v) => Number.parseFloat(String(v)))
            .filter((n) => Number.isFinite(n) && n > 0)
            .sort((a, b) => a - b)
        : [];

      return {
        sourceId: row.source_id,
        processed: row.processed,
        scrapedAt: row.scraped_at,
        title: row.title,
        minRawPrice: prices.length ? prices[0] : null,
        maxRawPrice: prices.length ? prices[prices.length - 1] : null,
        prices,
        sourceUrl: row.source_url,
      };
    });

    return {
      events: eventRows,
      rawEvents: summarizeRaw,
    };
  } finally {
    await sql.end();
  }
}

async function main() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET no está definido en .env");
  }

  console.log("[step] lanzando scrape redtickets...");
  const scrapeResult = await runWithConflictRetry("scrape redtickets", "/api/scrape/redtickets", cronSecret);

  if (scrapeResult.status >= 400) {
    throw new Error(`scrape redtickets falló con ${scrapeResult.status}: ${JSON.stringify(scrapeResult.payload)}`);
  }

  console.log(`[scrape] status=${scrapeResult.status}`);
  console.log(`[scrape] payload=${JSON.stringify(scrapeResult.payload)}`);

  console.log("[step] ejecutando pipeline por lotes...");
  const processed = await runPipelineBatches(cronSecret);
  console.log(`[process] total procesado en esta ejecución: ${processed}`);

  console.log("[step] verificando PAN-POT en DB...");
  const verification = await verifyPanPot();

  console.log("\n=== VERIFICACION EVENTS (PAN-POT) ===");
  console.log(JSON.stringify(verification.events, null, 2));

  console.log("\n=== VERIFICACION RAW_EVENTS (PAN-POT) ===");
  console.log(JSON.stringify(verification.rawEvents, null, 2));

  const hasExpectedPrice = verification.events.some((e) => e.price_min === 1350);
  console.log(`\nEXPECTED_PRICE_1350=${hasExpectedPrice}`);

  if (!verification.events.length && !verification.rawEvents.length) {
    console.log("PAN-POT no encontrado en esta base. Revisar nombre exacto o source URL.");
  }
}

main().catch((error) => {
  console.error("[run-redtickets-pipeline-and-verify] ERROR:", error);
  process.exit(1);
});
