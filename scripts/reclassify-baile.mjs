/**
 * Reclassify existing events:
 * 1. All "baile" events → "fiesta"
 * 2. Known nightlife events (FOMO, Cloud 7) that got misclassified → "fiesta"
 *
 * Usage: node scripts/reclassify-baile.mjs
 * Requires DATABASE_URL env var.
 */
import pg from "pg";
const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Reclassify all "baile" → "fiesta"
  const r1 = await client.query(`UPDATE events SET event_type = 'fiesta', updated_at = NOW() WHERE event_type = 'baile'`);
  console.log(`[1] baile → fiesta: ${r1.rowCount} rows updated`);

  // 2. Reclassify FOMO events (misclassified as bar/otro)
  const r2 = await client.query(
    `UPDATE events SET event_type = 'fiesta', updated_at = NOW()
     WHERE LOWER(name) LIKE '%fomo%' AND event_type IN ('bar', 'otro', 'club')`,
  );
  console.log(`[2] FOMO → fiesta: ${r2.rowCount} rows updated`);

  // 3. Reclassify Cloud 7 events (misclassified as otro)
  const r3 = await client.query(
    `UPDATE events SET event_type = 'fiesta', updated_at = NOW()
     WHERE LOWER(name) LIKE '%cloud%7%' AND event_type IN ('otro', 'bar', 'club')`,
  );
  console.log(`[3] Cloud 7 → fiesta: ${r3.rowCount} rows updated`);

  // 4. Delete non-event entries (canchas, alquileres, etc.)
  const r4 = await client.query(
    `DELETE FROM events
     WHERE LOWER(name) ~ '(cancha|alquiler de|turnos? (disponibles|abiertos))'
       AND event_type IN ('deportivo', 'otro')`,
  );
  console.log(`[4] Deleted non-events: ${r4.rowCount} rows`);

  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
