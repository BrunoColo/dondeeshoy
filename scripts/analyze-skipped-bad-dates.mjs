import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔍 Analizando eventos con años incorrectos que se skipped...\n');

    // Obtener todos los eventos con años incorrectos
    const badEventsResult = await client.query(`
      SELECT 
        e.id, 
        e.name, 
        e.date, 
        e.venue_name,
        re.raw_data,
        re.source,
        re.id as raw_event_id
      FROM events e
      JOIN event_sources es ON e.id = es.event_id
      JOIN raw_events re ON es.raw_event_id = re.id
      WHERE EXTRACT(YEAR FROM e.date) != 2026
      ORDER BY e.date ASC
    `);

    console.log(`Analyzing ${badEventsResult.rows.length} bad events...\n`);

    const bySource = {};
    const byYear = {};

    for (const row of badEventsResult.rows) {
      const currentYear = new Date(row.date).getFullYear();
      const rawData = row.raw_data || {};
      
      // Track by source
      if (!bySource[row.source]) {
        bySource[row.source] = [];
      }
      bySource[row.source].push({
        name: row.name,
        currentYear,
        rawData
      });

      // Track by year
      if (!byYear[currentYear]) {
        byYear[currentYear] = [];
      }
      byYear[currentYear].push({
        name: row.name,
        source: row.source,
        rawData
      });
    }

    console.log('📊 BY YEAR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const [year, events] of Object.entries(byYear).sort()) {
      console.log(`\n${year}: ${events.length} events`);
      for (const e of events.slice(0, 3)) {
        console.log(`  - ${e.name}`);
        console.log(`    Source: ${e.source}`);
        console.log(`    dateIso: ${e.rawData.dateIso || 'N/A'}`);
        console.log(`    dateText: ${(e.rawData.dateText || 'N/A').substring(0, 50)}`);
      }
      if (events.length > 3) {
        console.log(`  ... and ${events.length - 3} more`);
      }
    }

    console.log('\n\n📊 BY SOURCE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const [source, events] of Object.entries(bySource).sort()) {
      console.log(`\n${source}: ${events.length} events`);
      const years = {};
      for (const e of events) {
        years[e.currentYear] = (years[e.currentYear] || 0) + 1;
      }
      console.log(`  Years: ${Object.entries(years).map(([y, c]) => `${y}(${c})`).join(', ')}`);
    }

  } finally {
    client.release();
    pool.end();
  }
}

main().catch(console.error);
