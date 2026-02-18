import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();
try {
  // Raw events by source
  const bySource = await client.query("SELECT source, COUNT(*) as count, SUM(CASE WHEN processed THEN 1 ELSE 0 END) as processed FROM raw_events GROUP BY source ORDER BY count DESC");
  console.log('Raw events by source:');
  bySource.rows.forEach(r => console.log(`  ${r.source}: ${r.count} total, ${r.processed} processed`));

  // TicketFacil raw events
  const tfRaw = await client.query("SELECT id, source_id, processed, processing_error, scraped_at FROM raw_events WHERE source = 'ticketfacil' LIMIT 5");
  console.log('\nTicketFacil raw events:', tfRaw.rows.length);
  tfRaw.rows.forEach(e => console.log(`  [${e.scraped_at?.toISOString()?.substring(0,10)}] ${e.source_id} processed=${e.processed} error=${e.processing_error}`));

  // Event sources
  const esBySource = await client.query("SELECT source, COUNT(*) FROM event_sources GROUP BY source ORDER BY count DESC");
  console.log('\nEvent sources table:');
  esBySource.rows.forEach(r => console.log(`  ${r.source}: ${r.count}`));

  // Total events
  const total = await client.query('SELECT COUNT(*) FROM events');
  console.log('\nTotal finalized events:', total.rows[0].count);
} finally {
  client.release();
  pool.end();
}
