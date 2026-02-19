import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== INVESTIGACIÓN: PRECIO EN RAW VS PUBLICADOS ===\n');

    // 1. Ver ejemplos de raw events con precio
    console.log('--- RAW EVENTS CON PRECIO (muestra 5) ---');
    const rawWithPrice = await client.query(`
      SELECT source, source_id, 
             raw_data->>'name' as name,
             raw_data->>'price' as price,
             raw_data->>'priceMin' as price_min,
             raw_data->>'priceMax' as price_max,
             raw_data->'prices' as prices,
             processed
      FROM raw_events 
      WHERE raw_data->>'price' IS NOT NULL 
         OR raw_data->>'priceMin' IS NOT NULL 
         OR raw_data->>'priceMax' IS NOT NULL
         OR raw_data->'prices' IS NOT NULL
      LIMIT 10
    `);
    
    rawWithPrice.rows.forEach(r => {
      console.log(`[${r.source}] ${r.name}`);
      console.log(`  price: ${r.price} | priceMin: ${r.price_min} | priceMax: ${r.price_max} | prices: ${JSON.stringify(r.prices)}`);
      console.log(`  processed: ${r.processed}`);
      console.log();
    });

    // 2. Ver distribución por fuente de los raw events con precio
    console.log('--- DISTRIBUCIÓN POR FUENTE (raw events con precio) ---');
    const bySource = await client.query(`
      SELECT source, 
             count(*) as total,
             count(CASE WHEN raw_data->>'price' IS NOT NULL OR raw_data->>'priceMin' IS NOT NULL OR raw_data->>'priceMax' IS NOT NULL OR raw_data->'prices' IS NOT NULL THEN 1 END) as con_precio
      FROM raw_events 
      GROUP BY source
      ORDER BY total DESC
    `);
    
    bySource.rows.forEach(r => {
      console.log(`${r.source}: ${r.con_precio}/${r.total} con precio`);
    });

    // 3. Ver eventos publicados con precio por fuente
    console.log('\n--- DISTRIBUCIÓN POR FUENTE (eventos publicados con precio) ---');
    const publishedBySource = await client.query(`
      SELECT es.source, 
             count(*) as total,
             count(CASE WHEN e.price_min IS NOT NULL OR e.price_max IS NOT NULL OR e.is_free = true THEN 1 END) as con_precio
      FROM events e
      JOIN event_sources es ON es.event_id = e.id
      WHERE e.status = 'active'
      GROUP BY es.source
      ORDER BY total DESC
    `);
    
    publishedBySource.rows.forEach(r => {
      console.log(`${r.source}: ${r.con_precio}/${r.total} con precio`);
    });

    // 4. Comparar mismo evento en raw vs publicado
    console.log('\n--- COMPARACIÓN: mismo evento en raw vs publicado ---');
    const compare = await client.query(`
      SELECT 
        e.name as published_name,
        e.price_min as pub_price_min,
        e.price_max as pub_price_max,
        e.is_free as pub_is_free,
        re.raw_data->>'price' as raw_price,
        re.raw_data->>'priceMin' as raw_price_min,
        re.raw_data->>'priceMax' as raw_price_max,
        es.source
      FROM events e
      JOIN event_sources es ON es.event_id = e.id
      JOIN raw_events re ON re.id = es.raw_event_id
      WHERE e.status = 'active' 
        AND (e.price_min IS NOT NULL OR e.price_max IS NOT NULL)
      LIMIT 10
    `);
    
    compare.rows.forEach(r => {
      console.log(`[${r.source}] ${r.published_name}`);
      console.log(`  PUBLICADO: price_min=${r.pub_price_min}, price_max=${r.pub_price_max}, is_free=${r.pub_is_free}`);
      console.log(`  RAW: price=${r.raw_price}, priceMin=${r.raw_price_min}, priceMax=${r.raw_price_max}`);
      console.log();
    });

    // 5. Ver raw events sin procesar que tienen precio
    console.log('--- RAW EVENTS SIN PROCESAR CON PRECIO (muestra 5) ---');
    const unprocessedWithPrice = await client.query(`
      SELECT source, source_id, 
             raw_data->>'name' as name,
             raw_data->>'price' as price,
             raw_data->>'priceMin' as price_min,
             raw_data->>'priceMax' as price_max,
             raw_data->'prices' as prices
      FROM raw_events 
      WHERE processed = false
        AND (raw_data->>'price' IS NOT NULL 
          OR raw_data->>'priceMin' IS NOT NULL 
          OR raw_data->>'priceMax' IS NOT NULL
          OR raw_data->'prices' IS NOT NULL)
      LIMIT 5
    `);
    
    unprocessedWithPrice.rows.forEach(r => {
      console.log(`[${r.source}] ${r.name}`);
      console.log(`  price: ${r.price} | priceMin: ${r.price_min} | priceMax: ${r.price_max} | prices: ${JSON.stringify(r.prices)}`);
      console.log();
    });

    // 6. Ver eventos publicados SIN precio pero que el raw SI tiene precio
    console.log('--- PUBLICADOS SIN PRECIO PERO RAW SI TIENE (muestra 5) ---');
    const lostPrice = await client.query(`
      SELECT 
        e.name as published_name,
        e.price_min as pub_price_min,
        e.price_max as pub_price_max,
        re.raw_data->>'price' as raw_price,
        re.raw_data->>'priceMin' as raw_price_min,
        re.raw_data->>'priceMax' as raw_price_max,
        es.source
      FROM events e
      JOIN event_sources es ON es.event_id = e.id
      JOIN raw_events re ON re.id = es.raw_event_id
      WHERE e.status = 'active' 
        AND e.price_min IS NULL 
        AND e.price_max IS NULL
        AND e.is_free = false
        AND (re.raw_data->>'price' IS NOT NULL 
          OR re.raw_data->>'priceMin' IS NOT NULL 
          OR re.raw_data->>'priceMax' IS NOT NULL
          OR re.raw_data->'prices' IS NOT NULL)
      LIMIT 10
    `);
    
    if (lostPrice.rows.length === 0) {
      console.log('No hay casos donde se perdió el precio (todos los que tienen raw con precio tienen publicado con precio)');
    } else {
      lostPrice.rows.forEach(r => {
        console.log(`[${r.source}] ${r.published_name}`);
        console.log(`  PUBLICADO: price_min=${r.pub_price_min}, price_max=${r.pub_price_max}`);
        console.log(`  RAW: price=${r.raw_price}, priceMin=${r.raw_price_min}, priceMax=${r.raw_price_max}`);
        console.log();
      });
    }

    console.log('\n=== FIN ===');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
