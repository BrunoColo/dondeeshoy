import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const dateArg = process.argv[2]?.trim() || "2026-04-09";
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error("Uso: node scripts/check-date-duplicates.mjs YYYY-MM-DD");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const normalizeExpr = (column) =>
  `regexp_replace(translate(lower(${column}), 'áéíóúñüÁÉÍÓÚÑÜ', 'aeiounuAEIOUNU'), '\\s+', ' ', 'g')`;

async function main() {
  const client = await pool.connect();

  try {
    const eventsQuery = `
      SELECT
        e.id,
        e.name,
        e.start_time,
        e.venue_name,
        e.department,
        e.event_type,
        e.is_recurring,
        e.ticket_url,
        e.slug
      FROM events e
      WHERE e.status = 'active'
        AND e.date = $1
      ORDER BY e.start_time NULLS FIRST, e.name, e.id;
    `;

    const duplicateGroupsQuery = `
      WITH base AS (
        SELECT
          e.id,
          e.name,
          e.start_time,
          e.venue_name,
          e.ticket_url,
          ${normalizeExpr("e.name")} AS normalized_name
        FROM events e
        WHERE e.status = 'active'
          AND e.date = $1
      )
      SELECT
        normalized_name,
        start_time,
        COUNT(*)::int AS count,
        ARRAY_AGG(id ORDER BY id) AS ids,
        ARRAY_AGG(name ORDER BY name) AS names,
        ARRAY_AGG(venue_name ORDER BY venue_name) AS venues,
        ARRAY_AGG(ticket_url ORDER BY ticket_url) AS urls
      FROM base
      GROUP BY normalized_name, start_time
      HAVING COUNT(*) > 1
      ORDER BY count DESC, start_time NULLS FIRST, normalized_name;
    `;

    const sourcesQuery = `
      SELECT
        e.id AS event_id,
        e.name,
        e.start_time,
        es.source,
        re.source_id,
        re.source_url
      FROM events e
      JOIN event_sources es ON es.event_id = e.id
      JOIN raw_events re ON re.id = es.raw_event_id
      WHERE e.status = 'active'
        AND e.date = $1
      ORDER BY e.name, e.start_time NULLS FIRST, e.id, es.source, re.source_id;
    `;

    const [eventsResult, duplicateResult, sourcesResult] = await Promise.all([
      client.query(eventsQuery, [dateArg]),
      client.query(duplicateGroupsQuery, [dateArg]),
      client.query(sourcesQuery, [dateArg]),
    ]);

    console.log(`Fecha: ${dateArg}`);
    console.log(`Total eventos activos: ${eventsResult.rows.length}`);

    console.log("\n=== DUPLICADOS POR NOMBRE+HORA ===");
    if (duplicateResult.rows.length === 0) {
      console.log("Sin duplicados exactos por nombre+hora");
    } else {
      for (const row of duplicateResult.rows) {
        console.log(`\\n- ${row.normalized_name} @ ${row.start_time ?? "(sin hora)"} | count=${row.count}`);
        console.log(`  ids=${JSON.stringify(row.ids)}`);
        console.log(`  names=${JSON.stringify(row.names)}`);
        console.log(`  venues=${JSON.stringify(row.venues)}`);
        console.log(`  urls=${JSON.stringify(row.urls)}`);
      }
    }

    console.log("\n=== EVENTOS DEL DÍA ===");
    for (const row of eventsResult.rows) {
      console.log(
        `${row.start_time ?? "(sin hora)"} | ${row.name} | ${row.venue_name} | ${row.department} | type=${row.event_type} | recurring=${row.is_recurring} | ${row.id}`,
      );
    }

    console.log("\n=== SOURCE LINKS ===");
    for (const row of sourcesResult.rows) {
      console.log(
        `${row.event_id} | ${row.name} | ${row.start_time ?? "(sin hora)"} | ${row.source} | ${row.source_id}`,
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
