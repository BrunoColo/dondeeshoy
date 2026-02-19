import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== RAW DATA COMPLETO DE UN EVENTO ===\n');

    // Ver un raw event completo
    const fullRaw = await client.query(`
      SELECT id, source, source_id, source_url, raw_data, processed
      FROM raw_events 
      WHERE source = 'redtickets' AND processed = false
      LIMIT 1
    `);
    
    if (fullRaw.rows.length > 0) {
      const r = fullRaw.rows[0];
      console.log('ID:', r.id);
      console.log('source_id:', r.source_id);
      console.log('source_url:', r.source_url);
      console.log('processed:', r.processed);
      console.log('\nraw_data keys:', Object.keys(r.raw_data).join(', '));
      console.log('\nraw_data completo:');
      console.log(JSON.stringify(r.raw_data, null, 2));
    }

    // Ver más ejemplos
    console.log('\n\n=== 5 EJEMPLOS DE RAW DATA ===\n');
    const examples = await client.query(`
      SELECT raw_data->>'title' as title,
             raw_data->>'name' as name,
             raw_data->>'category' as category,
             raw_data->>'prices' as prices,
             raw_data->>'venueText' as venue_text,
             raw_data->>'venueAddress' as venue_address
      FROM raw_events 
      WHERE source = 'redtickets' AND processed = false
      LIMIT 5
    `);
    
    examples.rows.forEach((r, i) => {
      console.log(`--- Ejemplo ${i+1} ---`);
      console.log('title:', r.title);
      console.log('name:', r.name);
      console.log('category:', r.category);
      console.log('prices:', r.prices);
      console.log('venueText:', r.venue_text);
      console.log('venueAddress:', r.venue_address);
      console.log();
    });

    console.log('\n=== FIN ===');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
