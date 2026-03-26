import "dotenv/config";
import postgres from "postgres";
import { decode } from "html-entities";

const EVENT_URL = "https://redtickets.uy/evento/PANPOT-in-Montevideo/26829/";
const SOURCE = "redtickets";
const SOURCE_ID = "26829";
const BASE_URL = "http://localhost:3000";

function toNumber(val) {
  if (typeof val === "number") return Number.isNaN(val) ? null : val;
  if (typeof val === "string") {
    const n = Number.parseFloat(val);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function uniqueNumbers(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function shouldSkipTicketForPricing(ticket, ticketText) {
  const stock = toNumber(ticket.stock);
  const availableStock = toNumber(ticket.availableStock);

  const isSoldOutByFlag =
    ticket.soldOut === true ||
    ticket.available === false ||
    (stock !== null && stock <= 0) ||
    (availableStock !== null && availableStock <= 0);

  const isSoldOutByText = /\b(agotad[oa]s?|sold\s*out|no\s+disponible)\b/i.test(ticketText);
  const isNonAdmission = /\b(parking|estacionamiento)\b/i.test(ticketText);

  return isSoldOutByFlag || isSoldOutByText || isNonAdmission;
}

function extractPurchaseResponseFromHtml(html) {
  const gxStateMatch = html.match(/<input[^>]*name=["']GXState["'][^>]*value=["']([\s\S]*?)["'][^>]*>/i);
  if (gxStateMatch?.[1]) {
    try {
      const decodedState = decode(gxStateMatch[1]);
      const state = JSON.parse(decodedState);
      const purchaseKey = Object.keys(state).find((k) => k.endsWith("vPURCHASEOPTIONSRESPONSE"));
      if (purchaseKey && typeof state[purchaseKey] === "object") {
        return state[purchaseKey];
      }
    } catch {
      // fallback below
    }
  }

  const marker = 'vPURCHASEOPTIONSRESPONSE":';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  let i = idx + marker.length;
  while (i < html.length && html[i] === " ") i++;
  if (html[i] !== "{") return null;

  let depth = 0;
  let end = i;
  for (let j = i; j < html.length; j++) {
    if (html[j] === "{") depth++;
    else if (html[j] === "}") depth--;
    if (depth === 0) {
      end = j + 1;
      break;
    }
  }

  try {
    return JSON.parse(html.substring(i, end));
  } catch {
    return null;
  }
}

function extractPricesFromPurchaseData(purchaseData) {
  const prices = [];
  const evt = purchaseData?.Evt;
  if (!evt || evt.isFree === true) return [];

  const dates = Array.isArray(evt.Dates) ? evt.Dates : [];
  for (const date of dates) {
    if (date?.soldOut === true) continue;
    const times = Array.isArray(date?.Times) ? date.Times : [];

    for (const time of times) {
      if (time?.soldOut === true) continue;
      const tickets = Array.isArray(time?.Tickets) ? time.Tickets : [];

      for (const ticket of tickets) {
        const ticketText = `${ticket?.caption ?? ""} ${ticket?.name ?? ""} ${ticket?.description ?? ""}`
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

        if (shouldSkipTicketForPricing(ticket, ticketText)) continue;

        // IMPORTANT: for RedTickets business display, use final price first.
        const priceStr = ticket?.price ?? ticket?.unitPrice;
        const amount = Number.parseFloat(String(priceStr ?? ""));

        if (Number.isFinite(amount) && amount > 0) {
          prices.push(Math.round(amount));
        }
      }
    }
  }

  return uniqueNumbers(prices);
}

async function callProcessWithRetry(cronSecret) {
  const headers = { "x-cron-secret": cronSecret };

  for (let i = 1; i <= 20; i++) {
    const res = await fetch(`${BASE_URL}/api/scrape/process?batch=200`, { headers });
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (res.status === 409) {
      console.log(`[process] intento ${i}: lock 409, reintento en 10s`);
      await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }

    console.log(`[process] status=${res.status} payload=${JSON.stringify(payload)}`);
    if (res.status >= 400) {
      throw new Error(`process falló con ${res.status}`);
    }

    return payload;
  }

  throw new Error("No se pudo ejecutar process: lock persistente");
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no definido");
  if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET no definido");

  const htmlRes = await fetch(EVENT_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!htmlRes.ok) {
    throw new Error(`No se pudo descargar evento: HTTP ${htmlRes.status}`);
  }

  const html = await htmlRes.text();
  const purchaseData = extractPurchaseResponseFromHtml(html);
  if (!purchaseData) throw new Error("No se pudo extraer vPURCHASEOPTIONSRESPONSE");

  const prices = extractPricesFromPurchaseData(purchaseData);
  if (!prices.length) throw new Error("No se extrajeron precios válidos");

  console.log(`[panpot] precios extraídos: ${JSON.stringify(prices)}`);

  const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

  try {
    const rows = await sql`
      SELECT id, raw_data
      FROM raw_events
      WHERE source = ${SOURCE}
        AND source_id = ${SOURCE_ID}
      ORDER BY scraped_at DESC
      LIMIT 1
    `;

    if (!rows.length) throw new Error("No existe raw_event para PAN-POT (source_id=26829)");

    const raw = rows[0];
    const newRawData = {
      ...(raw.raw_data ?? {}),
      prices,
      extractedAt: new Date().toISOString(),
    };

    await sql`
      UPDATE raw_events
      SET raw_data = ${newRawData},
          scraped_at = NOW(),
          processed = false,
          processing_error = NULL
      WHERE id = ${raw.id}
    `;

    console.log("[panpot] raw_event actualizado y marcado para reproceso");

    await callProcessWithRetry(process.env.CRON_SECRET);

    const eventRows = await sql`
      SELECT
        e.id,
        e.name,
        e.price_min,
        e.price_max,
        e.updated_at,
        es.source_url
      FROM events e
      JOIN event_sources es ON es.event_id = e.id
      WHERE es.source = ${SOURCE}
        AND e.name ILIKE ${"%PAN-POT%"}
      ORDER BY e.updated_at DESC
      LIMIT 5
    `;

    console.log("[panpot] eventos post-proceso:");
    console.log(JSON.stringify(eventRows, null, 2));

    const has1350 = eventRows.some((row) => row.price_min === 1350);
    console.log(`PANPOT_EXPECTED_1350=${has1350}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[refresh-panpot-price-and-process] ERROR", err);
  process.exit(1);
});
