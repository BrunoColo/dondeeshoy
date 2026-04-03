import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function avg(rows, key) {
  if (!rows.length) return 0;
  const sum = rows.reduce((acc, row) => {
    const value = row[key] === null || row[key] === undefined ? 0 : Number(row[key]);
    return acc + value;
  }, 0);
  return sum / rows.length;
}

async function main() {
  const client = await pool.connect();
  try {
    const activeNow = await client.query(
      "SELECT COUNT(*)::int AS c FROM events WHERE status = 'active'",
    );

    const events = await client.query(
      "SELECT (created_at AT TIME ZONE 'America/Montevideo')::date AS day, COUNT(*)::int AS created_events, COUNT(*) FILTER (WHERE status = 'active')::int AS created_active FROM events WHERE created_at >= NOW() - INTERVAL '30 day' GROUP BY 1 ORDER BY 1 DESC",
    );

    const raw = await client.query(
      "SELECT (scraped_at AT TIME ZONE 'America/Montevideo')::date AS day, COUNT(*)::int AS scraped_rows FROM raw_events WHERE scraped_at >= NOW() - INTERVAL '30 day' GROUP BY 1 ORDER BY 1 DESC",
    );

    const output = {
      activeEventsNow: Number(activeNow.rows[0].c ?? 0),
      eventsLast30d: {
        daysWithData: events.rows.length,
        avgNewEventsPerDay: Number(avg(events.rows, "created_events").toFixed(2)),
        avgNewActiveEventsPerDay: Number(avg(events.rows, "created_active").toFixed(2)),
        latest7: events.rows.slice(0, 7),
      },
      rawLast30d: {
        daysWithData: raw.rows.length,
        avgScrapedRowsPerDay: Number(avg(raw.rows, "scraped_rows").toFixed(2)),
        latest7: raw.rows.slice(0, 7),
      },
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
