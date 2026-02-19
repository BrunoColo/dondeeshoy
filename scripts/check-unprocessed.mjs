import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== RAW EVENTS SIN PROCESAR ===\n');

    // Distribución por fuente de los sin procesar
    const bySource = await client.query(`
      SELECT source, count(*) as total
      FROM raw_events 
      WHERE processed = false
      GROUP BY source
      ORDER BY total DESC
    `);
    
    console.log('Por fuente:');
    bySource.rows.forEach(r => {
      console.log(`  ${r.source}: ${r.total}`);
    });

    // Ver si hay errores de procesamiento
    console.log('\n--- RAW EVENTS CON ERROR ---');
    const withError = await client.query(`
      SELECT source, source_id, processing_error, 
             raw_data->>'name' as name,
             raw_data->>'prices' as prices
      FROM raw_events 
      WHERE processed = false AND processing_error IS NOT NULL
      LIMIT 10
    `);
    
    if (withError.rows.length === 0) {
      console.log('No hay errores registrados');
    } else {
      withError.rows.forEach(r => {
        console.log(`[${r.source}] ${r.name}`);
        console.log(`  Error: ${r.processing_error}`);
        console.log();
      });
    }

    // Ver examples de raw events sin procesar de redtickets
    console.log('\n--- MUESTRA: redtickets sin procesar ---');
    const redticketsUnprocessed = await client.query(`
      SELECT source_id, 
             raw_data->>'name' as name,
             raw_data->>'prices' as prices,
             raw_data->>'imageUrl' as image,
             raw_data->>'venueAddress' as venue_address,
             raw_data->>'latitude' as lat,
             raw_data->>'longitude' as lng
      FROM raw_events 
      WHERE processed = false AND source = 'redtickets'
      LIMIT 5
    `);
    
    redticketsUnprocessed.rows.forEach(r => {
      console.log(`ID: ${r.source_id}`);
      console.log(`  name: ${r.name}`);
      console.log(`  prices: ${r.prices}`);
      console.log(`  image: ${(r.image || 'null')?.substring(0, 60)}`);
      console.log(`  venue_address: ${r.venue_address}`);
      console.log(`  lat/lng: ${r.lat}/${r.lng}`);
      console.log();
    });

    // Ver si los eventos ya publicados de redtickets tienen o no precio
    console.log('\n--- PUBLICADOS DE REDTICKS: precio vs sin precio ---');
    const redticketsPublished = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN e.price_min IS NOT NULL OR e.price_max IS NOT NULL OR e.is_free = true THEN 1 END) as con_precio,
        COUNT(CASE WHEN e.price_min IS NULL AND e.price_max IS NULL AND e.is_free = false THEN 1 END) as sin_precio
      FROM events e
      JOIN event_sources es ON es.event_id = e.id
      WHERE e.status = 'active' AND es.source = 'redtickets'
    `);
    
    console.log(`Total publicados de redtickets: ${redticketsPublished.rows[0].total}`);
    console.log(`Con precio: ${redticketsPublished.rows[0].con_precio}`);
    console.log(`Sin precio: ${redticketsPublished.rows[0].sin_precio}`);

    // Ver la fecha de los últimos scrapeos
    console.log('\n--- ÚLTIMOS SCRAPES DE REDTICKS ---');
    const lastScrape = await client.query(`
      SELECT source, scraped_at, processed, 
             raw_data->>'prices' as prices
      FROM raw_events 
      WHERE source = 'redtickets'
      ORDER BY scraped_at DESC
      LIMIT 10
    `);
    
    lastScrape.rows.forEach(r => {
      console.log(`Fecha: ${r.scraped_at} | processed: ${r.processed} | prices: ${r.prices}`);
    });

    console.log('\n=== FIN ===');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
