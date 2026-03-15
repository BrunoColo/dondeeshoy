import 'dotenv/config';
import postgres from 'postgres';

const baseUrl = 'http://localhost:3000';
const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
  throw new Error('CRON_SECRET no configurado en entorno/.env');
}

async function call(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: 'require',
});

try {
  const scrape = await call('/api/scrape/hayplan');
  console.log('SCRAPE_RESULT=', JSON.stringify(scrape, null, 2));

  const process = await call('/api/scrape/process?batch=200');
  console.log('PROCESS_RESULT=', JSON.stringify(process, null, 2));

  const [rawCount] = await sql`select count(*)::int as count from raw_events where source = 'hayplan'`;
  const [eventCount] = await sql`
    select count(*)::int as count
    from events e
    inner join event_sources es on es.event_id = e.id
    where es.source = 'hayplan'
  `;

  console.log('DB_COUNTS=', {
    hayplan_raw_events: rawCount?.count ?? 0,
    hayplan_linked_events: eventCount?.count ?? 0,
  });
} catch (error) {
  console.error('RUN_HAYPLAN_INGEST_ERROR', error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
