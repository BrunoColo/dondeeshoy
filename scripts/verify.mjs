import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const evCount = await client.query('SELECT count(*) FROM events');
    const rawCount = await client.query('SELECT count(*) FROM raw_events');
    const processedCount = await client.query('SELECT count(*) FROM raw_events WHERE processed = true');
    const freeCount = await client.query('SELECT count(*) FROM events WHERE is_free = true');
    const noVenue = await client.query(`SELECT count(*) FROM events WHERE venue_name = 'Venue por confirmar'`);
    
    console.log(`Total events: ${evCount.rows[0].count}`);
    console.log(`Total raw_events: ${rawCount.rows[0].count}`);
    console.log(`Processed raw: ${processedCount.rows[0].count}`);
    console.log(`Marked as free: ${freeCount.rows[0].count}`);
    console.log(`Venue "por confirmar": ${noVenue.rows[0].count}`);
    
    // Sample events
    const samples = await client.query(`
      SELECT e.name, e.venue_name, e.price_min, e.price_max, e.is_free, e.image_url, e.date, es.source
      FROM events e
      LEFT JOIN event_sources es ON es.event_id = e.id
      ORDER BY e.date ASC
      LIMIT 15
    `);
    console.log('\nSample events:');
    samples.rows.forEach(r => {
      console.log(`  [${r.source}] ${r.name}`);
      console.log(`    venue: ${r.venue_name} | price: ${r.price_min}-${r.price_max} | free: ${r.is_free} | date: ${r.date}`);
      console.log(`    img: ${(r.image_url || '(none)').substring(0, 80)}`);
    });

    // Check raw data for a few
    const rawSamples = await client.query(`
      SELECT source, source_id, raw_data->>'venueName' as venue, raw_data->>'venueText' as venue_text,
             raw_data->'prices' as prices, raw_data->>'imageUrl' as img, raw_data->>'dateText' as date_text
      FROM raw_events
      ORDER BY scraped_at DESC 
      LIMIT 10
    `);
    console.log('\nRaw data samples:');
    rawSamples.rows.forEach(r => {
      console.log(`  [${r.source}] ${r.source_id}`);
      console.log(`    venue: ${r.venue || r.venue_text || '(null)'} | prices: ${JSON.stringify(r.prices)} | date: ${r.date_text}`);
      console.log(`    img: ${(r.img || '(none)').substring(0, 80)}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
