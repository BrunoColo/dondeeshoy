import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

try {
  const rows = await sql`
    update events
    set event_type = 'otro',
        updated_at = now()
    where status = 'active'
      and event_type in ('bar', 'club', 'fiesta', 'festival', 'recital')
      and (
        lower(name) like '%reserva%'
        or lower(name) like '%fauna%'
        or lower(name) like '%parque%'
        or lower(coalesce(description, '')) like '%reserva%'
        or lower(coalesce(description, '')) like '%fauna%'
        or lower(coalesce(description, '')) like '%parque%'
      )
    returning id, name, city, event_type
  `;

  console.log(`Reclasificados: ${rows.length}`);
  for (const row of rows.slice(0, 20)) {
    console.log(`- ${row.name} (${row.city}) -> ${row.event_type}`);
  }
} catch (error) {
  console.error("Error al reclasificar:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
