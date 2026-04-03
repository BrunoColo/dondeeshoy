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

const terms = process.argv.slice(2);
if (terms.length === 0) {
  console.error("Uso: node scripts/investigate-duplicate-names.mjs <term1> <term2> ...");
  process.exit(1);
}

const normalizedTerms = terms
  .map((term) => term.trim().toLowerCase())
  .filter(Boolean);

if (normalizedTerms.length === 0) {
  console.error("Debes pasar al menos un término válido.");
  process.exit(1);
}

const whereOr = normalizedTerms
  .map((term) => `${normalizeExpr("e.name")} LIKE '%${term.replace(/'/g, "''") }%'`)
  .join(" OR ");

async function main() {
  const client = await pool.connect();
  try {
    const query = `
      WITH target AS (
        SELECT
          e.id,
          e.name,
          e.date,
          e.start_time,
          e.venue_name,
          e.department,
          e.slug,
          e.event_type,
          e.is_recurring,
          e.status,
          ${normalizeExpr("e.name")} AS norm_name
        FROM events e
        WHERE e.status = 'active'
          AND (${whereOr})
      )
      SELECT
        t.*,
        es.source,
        re.source_id,
        re.source_url
      FROM target t
      LEFT JOIN event_sources es ON es.event_id = t.id
      LEFT JOIN raw_events re ON re.id = es.raw_event_id
      ORDER BY t.date, t.start_time NULLS FIRST, t.name, es.source, re.source_id;
    `;

    const { rows } = await client.query(query);

    console.log(`rows=${rows.length}`);
    for (const row of rows) {
      console.log(JSON.stringify(row));
    }

    const duplicatesQuery = `
      WITH normalized AS (
        SELECT
          e.id,
          e.name,
          e.date,
          e.start_time,
          e.venue_name,
          ${normalizeExpr("e.name")} AS norm_name
        FROM events e
        WHERE e.status = 'active'
          AND (${whereOr})
      )
      SELECT
        norm_name,
        date,
        start_time,
        count(*) AS count,
        array_agg(id ORDER BY id) AS ids,
        array_agg(name ORDER BY name) AS names,
        array_agg(venue_name ORDER BY venue_name) AS venues
      FROM normalized
      GROUP BY norm_name, date, start_time
      HAVING count(*) > 1
      ORDER BY date, start_time NULLS FIRST, norm_name;
    `;

    const dup = await client.query(duplicatesQuery);

    console.log("\nDUP_GROUPS");
    if (dup.rows.length === 0) {
      console.log("none");
    } else {
      for (const row of dup.rows) {
        console.log(JSON.stringify(row));
      }
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
