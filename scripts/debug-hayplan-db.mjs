import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: 'require',
});

try {
  const enumRows = await sql`select unnest(enum_range(null::source))::text as value`;
  const countRows = await sql`select source::text as source, count(*)::int as count from raw_events group by source order by count desc`;
  console.log('ENUM_SOURCE=', enumRows.map((r) => r.value));
  console.log('RAW_COUNTS=', countRows);
} catch (error) {
  console.error('DB_DEBUG_ERROR', error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
