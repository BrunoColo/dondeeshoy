import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: 'require',
});

try {
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'source'
          AND e.enumlabel = 'hayplan'
      ) THEN
        ALTER TYPE "public"."source" ADD VALUE 'hayplan';
      END IF;
    END
    $$;
  `;

  const enumRows = await sql`select unnest(enum_range(null::source))::text as value`;
  console.log('ENUM_SOURCE_UPDATED=', enumRows.map((r) => r.value));
} catch (error) {
  console.error('APPLY_ENUM_ERROR', error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
