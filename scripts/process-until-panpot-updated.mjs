import "dotenv/config";
import postgres from "postgres";

const SOURCE = "redtickets";
const SOURCE_ID = "26829";
const BASE_URL = "http://localhost:3000";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPanpotState(sql) {
  const rawRows = await sql`
    SELECT id, processed, scraped_at, raw_data->'prices' AS prices
    FROM raw_events
    WHERE source = ${SOURCE}
      AND source_id = ${SOURCE_ID}
    ORDER BY scraped_at DESC
    LIMIT 1
  `;

  const eventRows = await sql`
    SELECT
      e.id,
      e.name,
      e.price_min,
      e.price_max,
      e.updated_at
    FROM events e
    JOIN event_sources es ON es.event_id = e.id
    WHERE es.source = ${SOURCE}
      AND e.name ILIKE ${"%PAN-POT%"}
    ORDER BY e.updated_at DESC
    LIMIT 1
  `;

  return {
    raw: rawRows[0] ?? null,
    event: eventRows[0] ?? null,
  };
}

async function triggerProcess(cronSecret, batch = 1) {
  const res = await fetch(`${BASE_URL}/api/scrape/process?batch=${batch}`, {
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

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no definido");
  if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET no definido");

  const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

  try {
    for (let i = 1; i <= 60; i++) {
      const state = await getPanpotState(sql);

      console.log(`[check ${i}] raw.processed=${state.raw?.processed} raw.scraped_at=${state.raw?.scraped_at} event.price_min=${state.event?.price_min}`);

      if (state.raw?.processed === true && state.event?.price_min === 1350) {
        console.log("PANPOT_READY=true");
        console.log(JSON.stringify(state, null, 2));
        return;
      }

      const proc = await triggerProcess(process.env.CRON_SECRET, 1);
      if (proc.status === 409) {
        console.log(`[process ${i}] 409 lock, esperando 8s`);
        await sleep(8000);
        continue;
      }

      console.log(`[process ${i}] status=${proc.status} payload=${JSON.stringify(proc.payload)}`);
      if (proc.status >= 400) {
        throw new Error(`process falló con ${proc.status}`);
      }

      await sleep(1500);
    }

    const finalState = await getPanpotState(sql);
    console.log("PANPOT_READY=false");
    console.log(JSON.stringify(finalState, null, 2));
    process.exit(2);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[process-until-panpot-updated] ERROR", err);
  process.exit(1);
});
