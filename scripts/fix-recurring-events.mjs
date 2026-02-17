import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

const recurringRegex = [
  "todos\\s+los\\s+d[ií]as",
  "todo\\s+el\\s+a[nñ]o",
  "durante\\s+todo\\s+el\\s+a[nñ]o",
  "abierto\\s+todo\\s+el\\s+a[nñ]o",
  "de\\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\\s+a\\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)",
  "lunes\\s+a\\s+viernes",
  "lunes\\s+a\\s+s[aá]bado",
  "lunes\\s+a\\s+domingo",
  "martes\\s+a\\s+domingo",
  "mi[eé]rcoles\\s+a\\s+domingo",
  "jueves\\s+a\\s+domingo",
  "viernes\\s+a\\s+domingo",
  "s[aá]bados?\\s+y\\s+domingos?",
  "todos?\\s+los?\\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)",
  "cada\\s+fin\\s*de\\s*semana",
  "todos\\s+los\\s+fines?\\s*de\\s*semana",
  "horarios?\\s*:\\s*\\d",
  "horario\\s+regular",
  "horario\\s+habitual",
  "semanal(?:mente)?",
  "permanente",
].join("|");

try {
  const updated = await sql`
    update events e
    set is_recurring = true,
        updated_at = now()
    where e.status = 'active'
      and e.is_recurring = false
      and (
        lower(e.name) ~ ${recurringRegex}
        or lower(coalesce(e.description, '')) ~ ${recurringRegex}
        or exists (
          select 1
          from event_sources es
          join raw_events r on r.id = es.raw_event_id
          where es.event_id = e.id
            and lower(coalesce(r.raw_data->>'dateText', '')) ~ ${recurringRegex}
        )
      )
    returning e.id, e.name, e.date, e.is_recurring
  `;

  console.log(`Marcados como recurrentes: ${updated.length}`);
  for (const row of updated.slice(0, 20)) {
    console.log(`- ${row.name} (${row.date})`);
  }
} catch (error) {
  console.error("Error al actualizar recurrentes:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
