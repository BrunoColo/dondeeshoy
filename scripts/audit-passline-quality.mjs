import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const PASSLINE_ENDPOINT = "https://api.passline.com/v1/event/GetCountryByBillboardHome";

function isValidIsoDate(value) {
  if (typeof value !== "string") return false;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10);
  const d = Number.parseInt(m[3], 10);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function isValidTime(value) {
  if (typeof value !== "string") return false;
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

function normalizeId(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function summarizeApiEvents(apiPayload) {
  const sections = [];
  const events = [];

  for (const [section, value] of Object.entries(apiPayload ?? {})) {
    if (!Array.isArray(value)) continue;
    sections.push({ section, count: value.length });
    for (const row of value) {
      if (!row || typeof row !== "object") continue;
      const event = row;
      const id = normalizeId(event.id);
      if (!id) continue;
      events.push({
        section,
        id,
        nombre: (event.nombre ?? "").toString().trim(),
        slug: (event.slug ?? "").toString().trim(),
        url: (event.url ?? "").toString().trim(),
        fecha_inicio: (event.fecha_inicio ?? "").toString().trim(),
        hora_inicio: (event.hora_inicio ?? "").toString().trim(),
        fecha_termino: (event.fecha_termino ?? "").toString().trim(),
        hora_termino: (event.hora_termino ?? "").toString().trim(),
        lugar: (event.lugar ?? "").toString().trim(),
        image: (event.image ?? "").toString().trim(),
        price: event.price,
        prices: event.prices,
      });
    }
  }

  return { sections, events };
}

async function fetchPasslineApi() {
  const response = await fetch(PASSLINE_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "*/*",
      "accept-language": "es-419,es;q=0.9,en;q=0.8",
      "content-type": "text/plain;charset=UTF-8",
      origin: "https://home.passline.com",
      referer: "https://home.passline.com/",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
    },
    body: JSON.stringify({ country: "uruguay", limit: "0,48" }),
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text();

  let parsed = null;
  if (contentType.includes("application/json")) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  return {
    status: response.status,
    contentType,
    rawText,
    parsed,
  };
}

async function loadDbState(client) {
  const [rawRows, linkedRows] = await Promise.all([
    client.query(`
      SELECT source_id, processed, processing_error,
             raw_data->>'dateIso' AS date_iso,
             raw_data->>'dateText' AS date_text,
             raw_data->>'startTime' AS start_time,
             raw_data->>'endTime' AS end_time,
             raw_data->>'title' AS title,
             raw_data->'prices' AS prices
      FROM raw_events
      WHERE source::text = 'passline'
    `),
    client.query(`
      SELECT DISTINCT re.source_id
      FROM event_sources es
      JOIN raw_events re ON re.id = es.raw_event_id
      WHERE es.source::text = 'passline'
    `),
  ]);

  const knownRawIds = new Set(rawRows.rows.map((r) => String(r.source_id)));
  const linkedIds = new Set(linkedRows.rows.map((r) => String(r.source_id)));

  return {
    rawRows: rawRows.rows,
    knownRawIds,
    linkedIds,
  };
}

function buildApiQualityReport(apiEvents, dbState) {
  const uniqueIds = new Set(apiEvents.map((e) => e.id));

  const missingTitle = apiEvents.filter((e) => !e.nombre).length;
  const missingVenue = apiEvents.filter((e) => !e.lugar).length;
  const missingUrl = apiEvents.filter((e) => !e.url).length;
  const missingImage = apiEvents.filter((e) => !e.image).length;

  const badStartDate = apiEvents.filter((e) => !isValidIsoDate(e.fecha_inicio)).length;
  const badEndDate = apiEvents.filter((e) => e.fecha_termino && !isValidIsoDate(e.fecha_termino)).length;
  const badStartTime = apiEvents.filter((e) => e.hora_inicio && !isValidTime(e.hora_inicio)).length;
  const badEndTime = apiEvents.filter((e) => e.hora_termino && !isValidTime(e.hora_termino)).length;

  const byIdDates = new Map();
  for (const e of apiEvents) {
    const key = e.id;
    const set = byIdDates.get(key) ?? new Set();
    if (e.fecha_inicio) set.add(e.fecha_inicio);
    byIdDates.set(key, set);
  }

  const multiDateIds = [...byIdDates.entries()]
    .filter(([, dateSet]) => dateSet.size > 1)
    .map(([id, dateSet]) => ({ id, dates: [...dateSet] }));

  const withAnyPriceField = apiEvents.filter(
    (e) => e.price != null || (Array.isArray(e.prices) && e.prices.length > 0),
  ).length;

  const newIds = [...uniqueIds].filter((id) => !dbState.knownRawIds.has(id));
  const existingRawIds = [...uniqueIds].filter((id) => dbState.knownRawIds.has(id));
  const potentiallyMergeable = [...uniqueIds].filter((id) => dbState.linkedIds.has(id));

  return {
    totalRows: apiEvents.length,
    uniqueIds: uniqueIds.size,
    newIds: newIds.length,
    existingRawIds: existingRawIds.length,
    potentiallyMergeable: potentiallyMergeable.length,
    quality: {
      missingTitle,
      missingVenue,
      missingUrl,
      missingImage,
      badStartDate,
      badEndDate,
      badStartTime,
      badEndTime,
      withAnyPriceField,
      multiDateIds,
    },
    sample: {
      newIds: newIds.slice(0, 15),
      existingRawIds: existingRawIds.slice(0, 15),
      potentiallyMergeable: potentiallyMergeable.slice(0, 15),
    },
  };
}

function summarizeDbQuality(rawRows) {
  const total = rawRows.length;
  const processed = rawRows.filter((r) => r.processed === true).length;
  const unprocessed = rawRows.filter((r) => r.processed === false).length;
  const withErrors = rawRows.filter((r) => !!r.processing_error).length;

  const goodDateIso = rawRows.filter((r) => isValidIsoDate(r.date_iso)).length;
  const goodDateTextIso = rawRows.filter((r) => isValidIsoDate(r.date_text)).length;
  const goodStartTime = rawRows.filter((r) => r.start_time && isValidTime(r.start_time)).length;
  const goodEndTime = rawRows.filter((r) => r.end_time && isValidTime(r.end_time)).length;

  const withPricesArray = rawRows.filter((r) => Array.isArray(r.prices) && r.prices.length > 0).length;

  return {
    total,
    processed,
    unprocessed,
    withErrors,
    goodDateIso,
    goodDateTextIso,
    goodStartTime,
    goodEndTime,
    withPricesArray,
  };
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("=== PASSLINE QUALITY AUDIT ===");
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    const dbState = await loadDbState(client);
    const dbSummary = summarizeDbQuality(dbState.rawRows);

    console.log("--- DB snapshot (source=passline) ---");
    console.log(JSON.stringify(dbSummary, null, 2));

    const api = await fetchPasslineApi();

    console.log("\n--- API fetch status ---");
    console.log(
      JSON.stringify(
        {
          status: api.status,
          contentType: api.contentType,
          bodyPreview: api.rawText.slice(0, 260),
        },
        null,
        2,
      ),
    );

    if (!api.parsed) {
      console.log("\nNo se pudo parsear JSON de Passline API. (Probable challenge/captcha o bloqueo)");
      return;
    }

    const { sections, events } = summarizeApiEvents(api.parsed);

    console.log("\n--- API sections ---");
    console.log(JSON.stringify(sections, null, 2));

    const report = buildApiQualityReport(events, dbState);

    console.log("\n--- Quality report (API vs DB) ---");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Audit failed:", error);
  process.exit(1);
});
