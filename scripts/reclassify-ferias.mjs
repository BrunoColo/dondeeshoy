import "dotenv/config";
import postgres from "postgres";

const DRY_RUN = process.argv.includes("--dry-run");
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

const FERIA_TITLE_REGEX = "\\mferia\\M";

try {
  const candidates = await sql`
    select id, name, date, venue_name, event_type
    from events
    where status = 'active'
      and event_type <> 'feria'
      and lower(name) ~ ${FERIA_TITLE_REGEX}
    order by date asc, name asc
  `;

  if (candidates.length === 0) {
    console.log("No hay eventos activos para reclasificar a feria.");
    process.exit(0);
  }

  console.log(`Encontrados ${candidates.length} evento(s) con 'feria' en el título.`);

  if (DRY_RUN) {
    console.log("Modo dry-run: no se aplican cambios. Muestra (hasta 50):");
    for (const row of candidates.slice(0, 50)) {
      console.log(`- [${row.date}] ${row.name} (${row.venue_name ?? "sin venue"}) | tipo actual: ${row.event_type}`);
    }
    process.exit(0);
  }

  const updated = await sql`
    update events
    set event_type = 'feria',
        updated_at = now()
    where status = 'active'
      and event_type <> 'feria'
      and lower(name) ~ ${FERIA_TITLE_REGEX}
    returning id, name, date, venue_name, event_type
  `;

  console.log(`Reclasificados a feria: ${updated.length}`);
  for (const row of updated.slice(0, 50)) {
    console.log(`- [${row.date}] ${row.name} (${row.venue_name ?? "sin venue"}) -> ${row.event_type}`);
  }
} catch (error) {
  console.error("Error al reclasificar ferias:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
