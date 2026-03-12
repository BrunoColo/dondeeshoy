import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔍 Buscando eventos con fechas incorrectas (no 2026)...\n');

    // Buscar eventos con años incorrectos
    const badEvents = await client.query(
      `SELECT e.id, e.name, e.date, e.venue_name, e.created_at
       FROM events e
       WHERE EXTRACT(YEAR FROM e.date) != 2026
       ORDER BY e.date ASC
       LIMIT 50`
    );

    console.log(`❌ Encontrados ${badEvents.rows.length} eventos con años incorrectos:\n`);

    // Para cada evento mal fechado, obtener su rawData
    for (const badEvent of badEvents.rows) {
      const sourcesResult = await client.query(
        `SELECT es.id, es.source, re.raw_data, re.id as raw_event_id
         FROM event_sources es
         JOIN raw_events re ON es.raw_event_id = re.id
         WHERE es.event_id = $1`,
        [badEvent.id]
      );

      for (const source of sourcesResult.rows) {
        const rawData = source.raw_data || {};
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`❌ Event: ${badEvent.name}`);
        console.log(`   Date: ${badEvent.date} (WRONG!)`);
        console.log(`   Venue: ${badEvent.venue_name}`);
        console.log(`   Source: ${source.source}`);
        console.log(`   Raw Scraper Data:`);
        console.log(`     - dateIso: ${rawData.dateIso || 'N/A'}`);
        console.log(`     - dateText: ${rawData.dateText || 'N/A'}`);
        console.log(`     - searchDateText: ${rawData.searchDateText || 'N/A'}`);
        if (Array.isArray(rawData.dates)) {
          console.log(`     - dates (array): ${JSON.stringify(rawData.dates.slice(0, 3))}`);
        } else {
          console.log(`     - dates (array): N/A`);
        }
        const titleOrName = rawData.name || rawData.title || '';
        console.log(`     - name/title: ${titleOrName.substring(0, 80)}`);
        console.log(`     - source: ${rawData.source || 'N/A'}`);
      }
    }

    // Ahora buscar eventos bien hechos (2026, fecha cercana a hoy)
    console.log(`\n\n✅ Buscando eventos bien scrapeados (2026, cercanos a hoy)...\n`);

    const goodEventsResult = await client.query(
      `SELECT e.id, e.name, e.date, e.venue_name, e.created_at
       FROM events e
       WHERE EXTRACT(YEAR FROM e.date) = 2026 
       AND e.date >= CURRENT_DATE
       AND e.date <= CURRENT_DATE + INTERVAL '14 days'
       ORDER BY e.date ASC
       LIMIT 5`
    );

    console.log(`✅ Encontrados ${goodEventsResult.rows.length} eventos bien scrapeados:\n`);

    for (const goodEvent of goodEventsResult.rows) {
      const sourcesResult = await client.query(
        `SELECT es.id, es.source, re.raw_data, re.id as raw_event_id
         FROM event_sources es
         JOIN raw_events re ON es.raw_event_id = re.id
         WHERE es.event_id = $1`,
        [goodEvent.id]
      );

      for (const source of sourcesResult.rows) {
        const rawData = source.raw_data || {};
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✅ Event: ${goodEvent.name}`);
        console.log(`   Date: ${goodEvent.date} (CORRECT!)`);
        console.log(`   Venue: ${goodEvent.venue_name}`);
        console.log(`   Source: ${source.source}`);
        console.log(`   Raw Scraper Data:`);
        console.log(`     - dateIso: ${rawData.dateIso || 'N/A'}`);
        console.log(`     - dateText: ${rawData.dateText || 'N/A'}`);
        console.log(`     - searchDateText: ${rawData.searchDateText || 'N/A'}`);
        if (Array.isArray(rawData.dates)) {
          console.log(`     - dates (array): ${JSON.stringify(rawData.dates.slice(0, 3))}`);
        } else {
          console.log(`     - dates (array): N/A`);
        }
        const titleOrName = rawData.name || rawData.title || '';
        console.log(`     - name/title: ${titleOrName.substring(0, 80)}`);
        console.log(`     - source: ${rawData.source || 'N/A'}`);
      }
    }

    console.log(`\n\n📊 SUMMARY`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Bad dates found: ${badEvents.rows.length}`);
    console.log(`Good dates analyzed: ${goodEventsResult.rows.length}`);

  } finally {
    client.release();
    pool.end();
  }
}

main().catch(console.error);
