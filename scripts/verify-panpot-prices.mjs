import "dotenv/config";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no está definido");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

try {
  const events = await sql`
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
    LIMIT 10
  `;

  const raws = await sql`
    SELECT
      id,
      source_id,
      source_url,
      scraped_at,
      processed,
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
    LIMIT 20
  `;

  const mappedRaws = raws.map((r) => {
    const prices = Array.isArray(r.prices)
      ? r.prices.map((v) => Number.parseFloat(String(v))).filter((n) => Number.isFinite(n)).sort((a,b)=>a-b)
      : [];

    return {
      source_id: r.source_id,
      processed: r.processed,
      scraped_at: r.scraped_at,
      title: r.title,
      min_price_from_raw: prices.length ? prices[0] : null,
      max_price_from_raw: prices.length ? prices[prices.length - 1] : null,
      prices,
      source_url: r.source_url,
    };
  });

  console.log("EVENTS", JSON.stringify(events, null, 2));
  console.log("RAW_EVENTS", JSON.stringify(mappedRaws, null, 2));

  const has1350 = events.some((e) => e.price_min === 1350);
  console.log(`HAS_EXPECTED_1350=${has1350}`);
} finally {
  await sql.end();
}
