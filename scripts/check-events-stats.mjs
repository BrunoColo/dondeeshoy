import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== ESTADÍSTICAS DE EVENTOS ===\n');

    // === EVENTOS PUBLICADOS (events con status = 'active') ===
    console.log('--- EVENTOS PUBLICADOS (status = active) ---');
    
    // Total de eventos activos
    const totalActive = await client.query('SELECT count(*) FROM events WHERE status = \'active\'');
    console.log(`Total eventos activos: ${totalActive.rows[0].count}`);

    // Eventos con precio (priceMin, priceMax o isFree)
    const withPrice = await client.query(`
      SELECT count(*) FROM events 
      WHERE status = 'active' 
      AND (price_min IS NOT NULL OR price_max IS NOT NULL OR is_free = true)
    `);
    console.log(`Con precio: ${withPrice.rows[0].count}`);

    // Eventos con imagen
    const withImage = await client.query(`
      SELECT count(*) FROM events 
      WHERE status = 'active' AND image_url IS NOT NULL
    `);
    console.log(`Con imagen: ${withImage.rows[0].count}`);

    // Eventos con ubicación (latitud y longitud)
    const withLocation = await client.query(`
      SELECT count(*) FROM events 
      WHERE status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL
    `);
    console.log(`Con ubicación: ${withLocation.rows[0].count}`);

    // Eventos con los 3: precio, imagen y ubicación
    const withAllThree = await client.query(`
      SELECT count(*) FROM events 
      WHERE status = 'active' 
      AND (price_min IS NOT NULL OR price_max IS NOT NULL OR is_free = true)
      AND image_url IS NOT NULL
      AND latitude IS NOT NULL 
      AND longitude IS NOT NULL
    `);
    console.log(`Con precio + imagen + ubicación: ${withAllThree.rows[0].count}`);

    // Desglose adicional
    console.log('\n--- DETALLE ---');
    const freeOnly = await client.query('SELECT count(*) FROM events WHERE status = \'active\' AND is_free = true');
    console.log(`Eventos gratuitos (is_free = true): ${freeOnly.rows[0].count}`);
    
    const paidOnly = await client.query('SELECT count(*) FROM events WHERE status = \'active\' AND is_free = false AND (price_min IS NOT NULL OR price_max IS NOT NULL)');
    console.log(`Eventos pagos (sin is_free pero con price): ${paidOnly.rows[0].count}`);

    const noPrice = await client.query('SELECT count(*) FROM events WHERE status = \'active\' AND price_min IS NULL AND price_max IS NULL AND is_free = false');
    console.log(`Sin precio definido: ${noPrice.rows[0].count}`);

    console.log('\n');

    // === RAW EVENTS ===
    console.log('--- RAW EVENTS ---');

    // Total de raw events
    const totalRaw = await client.query('SELECT count(*) FROM raw_events');
    console.log(`Total raw events: ${totalRaw.rows[0].count}`);

    // Raw events no procesados
    const unprocessedRaw = await client.query('SELECT count(*) FROM raw_events WHERE processed = false');
    console.log(`Sin procesar (processed = false): ${unprocessedRaw.rows[0].count}`);

    // Raw events procesados
    const processedRaw = await client.query('SELECT count(*) FROM raw_events WHERE processed = true');
    console.log(`Procesados (processed = true): ${processedRaw.rows[0].count}`);

    // Raw events con información de precio en rawData
    const rawWithPrice = await client.query(`
      SELECT count(*) FROM raw_events 
      WHERE raw_data->>'price' IS NOT NULL 
      OR raw_data->>'priceMin' IS NOT NULL 
      OR raw_data->>'priceMax' IS NOT NULL
      OR raw_data->'prices' IS NOT NULL
    `);
    console.log(`Con precio en rawData: ${rawWithPrice.rows[0].count}`);

    // Raw events con imagen en rawData
    const rawWithImage = await client.query(`
      SELECT count(*) FROM raw_events 
      WHERE raw_data->>'imageUrl' IS NOT NULL 
      OR raw_data->>'image' IS NOT NULL
    `);
    console.log(`Con imagen en rawData: ${rawWithImage.rows[0].count}`);

    // Raw events con ubicación en rawData (lat/lng o venueAddress)
    const rawWithLocation = await client.query(`
      SELECT count(*) FROM raw_events 
      WHERE (raw_data->>'latitude' IS NOT NULL AND raw_data->>'longitude' IS NOT NULL)
      OR raw_data->>'venueAddress' IS NOT NULL
    `);
    console.log(`Con ubicación en rawData: ${rawWithLocation.rows[0].count}`);

    // Raw events con los 3: precio, imagen y ubicación
    const rawWithAllThree = await client.query(`
      SELECT count(*) FROM raw_events 
      WHERE (raw_data->>'price' IS NOT NULL OR raw_data->>'priceMin' IS NOT NULL OR raw_data->>'priceMax' IS NOT NULL OR raw_data->'prices' IS NOT NULL)
      AND (raw_data->>'imageUrl' IS NOT NULL OR raw_data->>'image' IS NOT NULL)
      AND ((raw_data->>'latitude' IS NOT NULL AND raw_data->>'longitude' IS NOT NULL) OR raw_data->>'venueAddress' IS NOT NULL)
    `);
    console.log(`Con precio + imagen + ubicación: ${rawWithAllThree.rows[0].count}`);

    // Raw events no procesados con los 3
    const rawUnprocessedWithAll = await client.query(`
      SELECT count(*) FROM raw_events 
      WHERE processed = false
      AND ((raw_data->>'price' IS NOT NULL OR raw_data->>'priceMin' IS NOT NULL OR raw_data->>'priceMax' IS NOT NULL OR raw_data->'prices' IS NOT NULL)
      AND (raw_data->>'imageUrl' IS NOT NULL OR raw_data->>'image' IS NOT NULL)
      AND ((raw_data->>'latitude' IS NOT NULL AND raw_data->>'longitude' IS NOT NULL) OR raw_data->>'venueAddress' IS NOT NULL))
    `);
    console.log(`Sin procesar + con precio + imagen + ubicación: ${rawUnprocessedWithAll.rows[0].count}`);

    console.log('\n=== FIN ===');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
