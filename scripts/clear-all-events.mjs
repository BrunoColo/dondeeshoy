import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    console.log('⚠️  BORRANDO TODOS LOS EVENTOS\n');
    console.log('Tablas a borrar:');
    console.log('  - event_sources');
    console.log('  - raw_events');
    console.log('  - events');
    console.log('  - event_submissions (si existe)');
    console.log('');

    // Borrar en orden (por foreign keys)
    await client.query('DELETE FROM event_sources');
    console.log('✓ event_sources borrados');

    await client.query('DELETE FROM raw_events');
    console.log('✓ raw_events borrados');

    await client.query('DELETE FROM events');
    console.log('✓ events borrados');

    try {
      await client.query('DELETE FROM event_submissions');
      console.log('✓ event_submissions borrados');
    } catch (e) {
      // Tabla puede no existir
      console.log('○ event_submissions no existe (ignorado)');
    }

    console.log('\n✅ Base de datos vaciada correctamente');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
