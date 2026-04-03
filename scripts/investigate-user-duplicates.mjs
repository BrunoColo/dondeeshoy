import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const normalizeExpr = (column) =>
  `translate(lower(${column}), 'áéíóúñüÁÉÍÓÚÑÜ', 'aeiounuAEIOUNU')`;

async function main() {
  const client = await pool.connect();
  try {
    const query = `
      WITH target_events AS (
        SELECT
          e.id,
          e.name,
          e.date,
          e.start_time,
          e.venue_name,
          e.department,
          e.event_type,
          e.is_recurring,
          e.price_min,
          e.price_max,
          e.slug,
          e.status,
          ${normalizeExpr("e.name")} AS norm_name
        FROM events e
        WHERE e.status = 'active'
      )
      SELECT
        te.*,
        es.source,
        re.source_id,
        re.source_url,
        re.scraped_at,
        re.processed,
        re.processing_error
      FROM target_events te
      LEFT JOIN event_sources es ON es.event_id = te.id
      LEFT JOIN raw_events re ON re.id = es.raw_event_id
      WHERE
        te.norm_name LIKE '%circo fantasy%'
        OR te.norm_name LIKE '%expo experiencia jurasica%'
        OR te.norm_name LIKE '%danza arabe%'
        OR te.norm_name LIKE '%rueda candombe%'
        OR te.norm_name LIKE '%nu 06 de abril%'
      ORDER BY te.date, te.start_time NULLS FIRST, te.name, es.source, re.source_id;
    `;

    const { rows } = await client.query(query);

    console.log(`\n=== MATCHES EN EVENTS + EVENT_SOURCES ===`);
    console.log(`Total filas (evento x source): ${rows.length}\n`);

    const byEvent = new Map();

    for (const row of rows) {
      const key = row.id;
      if (!byEvent.has(key)) {
        byEvent.set(key, {
          id: row.id,
          name: row.name,
          date: row.date,
          start_time: row.start_time,
          venue_name: row.venue_name,
          department: row.department,
          event_type: row.event_type,
          is_recurring: row.is_recurring,
          price_min: row.price_min,
          price_max: row.price_max,
          slug: row.slug,
          sources: [],
        });
      }

      if (row.source) {
        byEvent.get(key).sources.push({
          source: row.source,
          source_id: row.source_id,
          source_url: row.source_url,
          scraped_at: row.scraped_at,
          processing_error: row.processing_error,
        });
      }
    }

    const events = [...byEvent.values()];

    console.log(`Eventos únicos encontrados: ${events.length}\n`);

    for (const event of events) {
      console.log(`- ${event.name}`);
      console.log(`  id=${event.id}`);
      console.log(`  date=${String(event.date).slice(0, 10)} start=${event.start_time ?? "(null)"}`);
      console.log(`  venue=${event.venue_name} | dept=${event.department}`);
      console.log(`  type=${event.event_type} recurring=${event.is_recurring}`);
      console.log(`  price=${event.price_min ?? "null"}-${event.price_max ?? "null"}`);
      console.log(`  slug=${event.slug}`);
      if (event.sources.length === 0) {
        console.log(`  sources=(sin links)`);
      } else {
        for (const src of event.sources) {
          console.log(`  source=${src.source} sourceId=${src.source_id}`);
          console.log(`    url=${src.source_url}`);
        }
      }
      console.log("");
    }

    const duplicateSummaryQuery = `
      WITH normalized AS (
        SELECT
          id,
          name,
          date,
          start_time,
          venue_name,
          department,
          ${normalizeExpr("name")} AS norm_name,
          ${normalizeExpr("venue_name")} AS norm_venue
        FROM events
        WHERE status = 'active'
      )
      SELECT
        norm_name,
        date,
        start_time,
        count(*) AS count,
        array_agg(id ORDER BY id) AS ids,
        array_agg(venue_name ORDER BY venue_name) AS venues
      FROM normalized
      WHERE
        norm_name LIKE '%circo fantasy%'
        OR norm_name LIKE '%expo experiencia jurasica%'
        OR norm_name LIKE '%danza arabe%'
        OR norm_name LIKE '%rueda candombe%'
        OR norm_name LIKE '%nu 06 de abril%'
      GROUP BY norm_name, date, start_time
      HAVING count(*) > 1
      ORDER BY date, start_time NULLS FIRST, norm_name;
    `;

    const dup = await client.query(duplicateSummaryQuery);

    console.log("=== POSIBLES DUPLICADOS (MISMO NOMBRE NORMALIZADO + FECHA + HORA) ===");
    if (dup.rows.length === 0) {
      console.log("Sin grupos duplicados exactos por nombre+fecha+hora.");
    } else {
      for (const row of dup.rows) {
        console.log(`* ${row.norm_name} | ${String(row.date).slice(0, 10)} ${row.start_time ?? "(null)"} | count=${row.count}`);
        console.log(`  ids=${JSON.stringify(row.ids)}`);
        console.log(`  venues=${JSON.stringify(row.venues)}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
