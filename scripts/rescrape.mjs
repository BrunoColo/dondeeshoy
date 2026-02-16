// Reset database and re-run scrapers + pipeline
// Usage: node scripts/rescrape.mjs
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Suppress SSL warnings
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('=== RESETTING DATABASE ===');
    
    // Delete event_sources and events (cascade handles it)
    const ev = await client.query('DELETE FROM events');
    console.log(`Deleted ${ev.rowCount} events (event_sources cascade)`);
    
    // Delete all raw_events so we re-scrape with new selectors
    const raw = await client.query('DELETE FROM raw_events');
    console.log(`Deleted ${raw.rowCount} raw_events`);
    
    console.log('\nDatabase wiped. Now scraping...\n');
    
    // Get the CRON_SECRET for API calls
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('CRON_SECRET not set in .env');
      process.exit(1);
    }
    
    const baseUrl = 'http://localhost:3000';
    const headers = { 'x-cron-secret': cronSecret };
    
    // Scrape Entraste
    console.log('--- Scraping Entraste ---');
    const entrRes = await fetch(`${baseUrl}/api/scrape/entraste`, { headers });
    const entrData = await entrRes.json();
    console.log('Entraste result:', JSON.stringify(entrData, null, 2));
    
    // Scrape RedTickets
    console.log('\n--- Scraping RedTickets ---');
    const rtRes = await fetch(`${baseUrl}/api/scrape/redtickets`, { headers });
    const rtData = await rtRes.json();
    console.log('RedTickets result:', JSON.stringify(rtData, null, 2));
    
    // Process pipeline
    console.log('\n--- Running Processing Pipeline ---');
    const procRes = await fetch(`${baseUrl}/api/scrape/process?batch=200`, { headers });
    const procData = await procRes.json();
    console.log('Pipeline result:', JSON.stringify(procData, null, 2));
    
    // Verify results
    console.log('\n=== VERIFICATION ===');
    const evCount = await client.query('SELECT count(*) FROM events');
    const rawCount = await client.query('SELECT count(*) FROM raw_events WHERE processed = true');
    const freeCount = await client.query('SELECT count(*) FROM events WHERE is_free = true');
    const noVenue = await client.query(`SELECT count(*) FROM events WHERE venue_name = 'Venue por confirmar'`);
    
    console.log(`Events created: ${evCount.rows[0].count}`);
    console.log(`Raw events processed: ${rawCount.rows[0].count}`);
    console.log(`Marked as free: ${freeCount.rows[0].count}`);
    console.log(`Venue "por confirmar": ${noVenue.rows[0].count}`);
    
    // Show sample events
    const samples = await client.query(`
      SELECT name, venue_name, price_min, price_max, is_free, image_url, date, source
      FROM events e
      JOIN event_sources es ON es.event_id = e.id
      ORDER BY e.created_at DESC
      LIMIT 10
    `);
    console.log('\nSample events:');
    samples.rows.forEach(r => {
      console.log(`  [${r.source}] ${r.name}`);
      console.log(`    venue: ${r.venue_name} | price: ${r.price_min}-${r.price_max} | free: ${r.is_free} | date: ${r.date}`);
      console.log(`    img: ${r.image_url?.substring(0, 60) || '(none)'}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
