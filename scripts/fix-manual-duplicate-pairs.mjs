import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });
const APPLY = process.argv.includes("--apply");

/**
 * Pairs that were manually verified as true duplicates and should be merged.
 * keepId survives, dropId is removed after re-linking sources.
 */
const PAIRS = [
  {
    keepId: "4ee72452-aec9-48fe-a2b0-cd7596ad71f1", // Expo Experiencia Jurásica (RedTickets)
    dropId: "63ed871a-749d-42d6-ab09-bd62a1ffcb8e", // Expo Experiencia Jurásica en Nuevocentro (HayPlan)
    reason: "Mismo día/hora y misma ticket URL (cross-source duplicate)",
  },
];

async function main() {
  console.log(`=== Manual duplicate merge (${APPLY ? "APPLY" : "DRY RUN"}) ===`);

  for (const pair of PAIRS) {
    const [keepRows, dropRows] = await Promise.all([
      sql`select id, name, date, start_time, venue_name, ticket_url, is_recurring from events where id = ${pair.keepId} limit 1`,
      sql`select id, name, date, start_time, venue_name, ticket_url, is_recurring from events where id = ${pair.dropId} limit 1`,
    ]);

    const keep = keepRows[0];
    const drop = dropRows[0];

    if (!keep || !drop) {
      console.log(`- SKIP pair keep=${pair.keepId} drop=${pair.dropId} (faltan filas)`);
      continue;
    }

    console.log(`\n• ${pair.reason}`);
    console.log(`  keep: ${keep.name} [${keep.id}] ${String(keep.date).slice(0, 10)} ${keep.start_time ?? "(null)"}`);
    console.log(`  drop: ${drop.name} [${drop.id}] ${String(drop.date).slice(0, 10)} ${drop.start_time ?? "(null)"}`);
    console.log(`  keep.ticket_url=${keep.ticket_url ?? "(null)"}`);
    console.log(`  drop.ticket_url=${drop.ticket_url ?? "(null)"}`);

    const sourceRows = await sql`
      select es.id, es.raw_event_id, es.source, re.source_id
      from event_sources es
      join raw_events re on re.id = es.raw_event_id
      where es.event_id = ${drop.id}
    `;

    console.log(`  fuentes a mover: ${sourceRows.length}`);

    if (!APPLY) {
      continue;
    }

    let moved = 0;
    let removedDuplicateLinks = 0;

    for (const src of sourceRows) {
      const existing = await sql`
        select id from event_sources
        where event_id = ${keep.id}
          and raw_event_id = ${src.raw_event_id}
        limit 1
      `;

      if (existing.length === 0) {
        await sql`
          update event_sources
          set event_id = ${keep.id}
          where id = ${src.id}
        `;
        moved += 1;
      } else {
        await sql`delete from event_sources where id = ${src.id}`;
        removedDuplicateLinks += 1;
      }
    }

    const deleted = await sql`
      delete from events
      where id = ${drop.id}
      returning id
    `;

    console.log(`  moved=${moved} removedDuplicateLinks=${removedDuplicateLinks} deleted=${deleted.length}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
