import "dotenv/config";
import postgres from "postgres";

const SOURCES = ["mvd-eventos", "cartelera"];
const ports = [3000, 3001];

async function detectBaseUrl(cronSecret) {
  for (const port of ports) {
    try {
      const res = await fetch(`http://localhost:${port}/api/scrape/process?batch=1`, {
        headers: { "x-cron-secret": cronSecret },
      });
      if (res.status !== 404) {
        return `http://localhost:${port}`;
      }
    } catch {
      // try next port
    }
  }
  return null;
}

async function callEndpoint(baseUrl, path, cronSecret) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "x-cron-secret": cronSecret },
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  return { status: res.status, payload };
}

async function printStats() {
  if (!process.env.DATABASE_URL) {
    console.log("[stats] DATABASE_URL no configurado, se omite verificación.");
    return;
  }

  const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

  try {
    const bySource = await sql`
      select es.source,
             count(*)::int as total,
             count(*) filter (where e.venue_name = 'Venue por confirmar')::int as venue_por_confirmar,
             count(*) filter (where e.is_recurring = true)::int as recurrentes
      from events e
      join event_sources es on es.event_id = e.id
      where es.source in ('mvd_eventos', 'cartelera')
      group by es.source
      order by es.source
    `;

    console.log("\n[stats] Estado de eventos por fuente:");
    for (const row of bySource) {
      console.log(`- ${row.source}: total=${row.total}, venue_por_confirmar=${row.venue_por_confirmar}, recurrentes=${row.recurrentes}`);
    }
  } finally {
    await sql.end();
  }
}

async function main() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error("CRON_SECRET no está configurado en .env");
  }

  const baseUrl = await detectBaseUrl(cronSecret);
  if (!baseUrl) {
    throw new Error("No se encontró servidor local en http://localhost:3000 ni 3001. Iniciá la app con npm run dev.");
  }

  console.log(`[rescrape] Usando API en ${baseUrl}`);

  for (const source of SOURCES) {
    const path = `/api/scrape/${source}`;
    const result = await callEndpoint(baseUrl, path, cronSecret);
    console.log(`\n[rescrape] ${path} -> ${result.status}`);
    console.log(JSON.stringify(result.payload, null, 2));
  }

  const processResult = await callEndpoint(baseUrl, "/api/scrape/process?batch=200", cronSecret);
  console.log(`\n[rescrape] /api/scrape/process?batch=200 -> ${processResult.status}`);
  console.log(JSON.stringify(processResult.payload, null, 2));

  await printStats();
}

main().catch((error) => {
  console.error("[rescrape] error:", error);
  process.exit(1);
});
