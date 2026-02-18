import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const r = await client.query(`
      SELECT name, venue_name, venue_address, city
      FROM events
      WHERE name ILIKE '%VIEJAR%'
         OR name ILIKE '%SALASTKBRON%'
         OR name ILIKE '%Carnaval de Artigas%'
         OR name ILIKE '%DESAFIO ROSARIO%'
         OR name ILIKE '%Rosario MTB%'
      ORDER BY name
    `);
    console.log('Edge case events:');
    r.rows.forEach(row => {
      console.log(`  [${row.city}] ${row.name}`);
      console.log(`    venue: ${row.venue_name} | addr: ${row.venue_address || '(null)'}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(err => { console.error(err); process.exit(1); });
