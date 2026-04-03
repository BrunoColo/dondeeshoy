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
      WITH base AS (
        SELECT
          e.id,
          e.name,
          e.date,
          e.start_time,
          e.venue_name,
          e.department,
          e.ticket_url,
          e.is_recurring,
          e.slug,
          ${normalizeExpr("e.name")} AS norm_name,
          regexp_replace(lower(trim(coalesce(e.ticket_url, ''))), '/+$', '') AS norm_ticket_url
        FROM events e
        WHERE e.status = 'active'
          AND e.ticket_url IS NOT NULL
          AND trim(e.ticket_url) <> ''
      )
      SELECT
        date,
        start_time,
        norm_ticket_url,
        count(*) AS count,
        array_agg(id ORDER BY id) AS ids,
        array_agg(name ORDER BY name) AS names,
        array_agg(venue_name ORDER BY venue_name) AS venues,
        array_agg(is_recurring ORDER BY is_recurring DESC) AS recurrings
      FROM base
      GROUP BY date, start_time, norm_ticket_url
      HAVING count(*) > 1
      ORDER BY date, start_time;
    `;

    const { rows } = await client.query(query);

    console.log(`groups=${rows.length}`);
    for (const row of rows) {
      console.log(JSON.stringify(row));
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
