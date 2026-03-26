import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

try {
  const rows = await sql`
    SELECT
      r.id AS raw_id,
      r.source_id,
      r.processed,
      r.scraped_at,
      r.raw_data->>'title' AS raw_title,
      r.raw_data->'prices' AS raw_prices,
      es.event_id,
      e.name AS event_name,
      e.price_min,
      e.price_max,
      e.updated_at
    FROM raw_events r
    LEFT JOIN event_sources es ON es.raw_event_id = r.id
    LEFT JOIN events e ON e.id = es.event_id
    WHERE r.source = 'redtickets'
      AND r.source_id = '26829'
    ORDER BY r.scraped_at DESC
    LIMIT 20
  `;

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await sql.end();
}
