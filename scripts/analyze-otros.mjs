import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  // Type distribution
  const types = await sql`SELECT event_type, count(*)::int as cnt FROM events WHERE status = 'active' GROUP BY event_type ORDER BY cnt DESC`;
  console.log("=== TYPE DISTRIBUTION ===");
  for (const t of types) console.log(`  ${t.event_type}: ${t.cnt}`);

  // VIEJO BARREIRO raw events
  console.log("\n=== VIEJO BARREIRO RAW EVENTS ===");
  const vb = await sql`SELECT source, source_id, raw_data->>'title' as title, raw_data->>'dateText' as date_text FROM raw_events WHERE raw_data->>'title' ILIKE '%viejo barreiro%' LIMIT 10`;
  for (const r of vb) console.log(JSON.stringify(r));

  // Top venues for 'otro' events
  console.log("\n=== TOP VENUES FOR OTRO ===");
  const venues = await sql`SELECT venue_name, count(*)::int as cnt FROM events WHERE event_type = 'otro' AND status = 'active' GROUP BY venue_name ORDER BY cnt DESC LIMIT 40`;
  for (const v of venues) console.log(`  ${v.venue_name}: ${v.cnt}`);

  // Total otros
  const total = await sql`SELECT count(*)::int as cnt FROM events WHERE event_type = 'otro' AND status = 'active'`;
  console.log(`\nTOTAL OTROS ACTIVOS: ${total[0].cnt}`);

  // Get all 'otro' events - name + venue for analysis
  console.log("\n=== ALL OTRO EVENT NAMES ===");
  const otros = await sql`SELECT name, venue_name, start_time FROM events WHERE event_type = 'otro' AND status = 'active' ORDER BY name`;
  for (const o of otros) console.log(`  "${o.name}" @ ${o.venue_name} (${o.start_time || 'no time'})`);

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
