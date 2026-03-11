import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const total = await client.query(`SELECT COUNT(*) as cnt FROM raw_events WHERE processed = false`);
    console.log('Unprocessed raw events:', total.rows[0].cnt);

    const bySource = await client.query(`SELECT source, processed, COUNT(*) as cnt FROM raw_events GROUP BY source, processed ORDER BY source, processed`);
    console.log('\nBy source and processed:');
    bySource.rows.forEach(r => console.log('  ' + r.source + ' [processed=' + r.processed + '] = ' + r.cnt));

    const nonRT = await client.query(`SELECT source, COUNT(*) as cnt FROM raw_events WHERE source != 'redtickets' AND processed = false GROUP BY source ORDER BY cnt DESC`);
    console.log('\nNon-RedTickets unprocessed:');
    nonRT.rows.forEach(r => console.log('  ' + r.source + ': ' + r.cnt));

    const totalNonRT = await client.query(`SELECT COUNT(*) as cnt FROM raw_events WHERE source != 'redtickets' AND processed = false`);
    console.log('\nTotal non-RedTickets unprocessed:', totalNonRT.rows[0].cnt);

    const samples = await client.query(`SELECT source, raw_data->>'name' as name, raw_data->>'dateText' as date_text, source_url FROM raw_events WHERE source != 'redtickets' AND processed = false ORDER BY source LIMIT 20`);
    console.log('\nSample unprocessed events:');
    samples.rows.forEach(r => console.log('  [' + r.source + '] ' + r.name + ' | date: ' + (r.date_text || 'N/A')));

    const errs = await client.query(`SELECT source, COUNT(*) as cnt FROM raw_events WHERE processing_error IS NOT NULL GROUP BY source ORDER BY cnt DESC`);
    console.log('\nWith processing errors:');
    errs.rows.forEach(r => console.log('  ' + r.source + ': ' + r.cnt));

    // Check raw_data structure
    const cartSample = await client.query(`SELECT raw_data FROM raw_events WHERE source = 'cartelera' AND processed = false LIMIT 2`);
    console.log('\n=== Cartelera raw_data structure ===');
    cartSample.rows.forEach((row, i) => {
      console.log('Event ' + (i+1) + ' keys: ' + Object.keys(row.raw_data).join(', '));
      console.log(JSON.stringify(row.raw_data, null, 2).substring(0, 600));
      console.log('---');
    });

    const mvdSample = await client.query(`SELECT raw_data FROM raw_events WHERE source = 'mvd_eventos' AND processed = false LIMIT 2`);
    console.log('\n=== MVD Eventos raw_data structure ===');
    mvdSample.rows.forEach((row, i) => {
      console.log('Event ' + (i+1) + ' keys: ' + Object.keys(row.raw_data).join(', '));
      console.log(JSON.stringify(row.raw_data, null, 2).substring(0, 600));
      console.log('---');
    });
  } finally {
    client.release();
    await pool.end();
  }
}
main();
