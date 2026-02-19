// Test cobraticket scraper quality via API
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const client = await pool.connect();
  
  try {
    // Delete existing cobraticket raw events
    await client.query(`DELETE FROM raw_events WHERE source = 'cobraticket'`);
    console.log('Deleted existing cobraticket raw events\n');
    
  } finally {
    client.release();
    await pool.end();
  }
  
  // Run scraper via API
  console.log('Running cobraticket scraper via API...\n');
  
  const res = await fetch('http://localhost:3000/api/scrape/cobraticket', {
    headers: {
      'x-cron-secret': process.env.CRON_SECRET
    },
    signal: AbortSignal.timeout(180000)
  });
  
  const data = await res.json();
  console.log('Scraper result:', JSON.stringify(data, null, 2));
  
  // Wait a bit for DB to update
  await new Promise(r => setTimeout(r, 2000));
  
  // Check quality
  const pool2 = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  const client2 = await pool2.connect();
  
  try {
    // Get sample
    const raw = await client2.query(`
      SELECT raw_data->>'title' as title, 
             raw_data->>'imageUrl' as image,
             raw_data->>'venueName' as venue,
             raw_data->>'venueAddress' as address,
             raw_data->>'priceText' as price,
             raw_data->>'prices' as prices
      FROM raw_events 
      WHERE source = 'cobraticket'
      ORDER BY scraped_at DESC
      LIMIT 5
    `);
    
    console.log('\n=== MUESTRA DE EVENTOS ===');
    raw.rows.forEach(r => {
      console.log(`\nTítulo: ${r.title}`);
      console.log(`  Imagen: ${r.image ? '✓ ' + r.image.substring(0,50)+'...' : '✗'}`);
      console.log(`  Venue: ${r.venue || '✗'}`);
      console.log(`  Dirección: ${r.address || '✗'}`);
      console.log(`  Precio text: ${r.price || '✗'}`);
      console.log(`  Prices array: ${r.prices || '✗'}`);
    });
    
    // Get stats
    const stats = await client2.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE raw_data->>'imageUrl' IS NOT NULL AND raw_data->>'imageUrl' != '') as with_image,
        COUNT(*) FILTER (WHERE raw_data->>'venueName' IS NOT NULL AND raw_data->>'venueName' != '') as with_venue,
        COUNT(*) FILTER (WHERE raw_data->>'venueAddress' IS NOT NULL AND raw_data->>'venueAddress' != '') as with_address,
        COUNT(*) FILTER (WHERE (raw_data->>'priceText' IS NOT NULL AND raw_data->>'priceText' != '') OR (raw_data->>'prices' IS NOT NULL AND raw_data->>'prices' != '[]')) as with_price
      FROM raw_events 
      WHERE source = 'cobraticket'
    `);
    
    const s = stats.rows[0];
    console.log('\n=== RESUMEN CALIDAD ===');
    console.log(`Total eventos: ${s.total}`);
    console.log(`Con imagen: ${s.with_image} (${s.total > 0 ? ((s.with_image/s.total)*100).toFixed(0) : 0}%)`);
    console.log(`Con venue: ${s.with_venue} (${s.total > 0 ? ((s.with_venue/s.total)*100).toFixed(0) : 0}%)`);
    console.log(`Con dirección: ${s.with_address} (${s.total > 0 ? ((s.with_address/s.total)*100).toFixed(0) : 0}%)`);
    console.log(`Con precio: ${s.with_price} (${s.total > 0 ? ((s.with_price/s.total)*100).toFixed(0) : 0}%)`);
    
  } finally {
    client2.release();
    await pool2.end();
  }
}

main().catch(console.error);
