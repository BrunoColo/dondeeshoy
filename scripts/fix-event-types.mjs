import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

try {
  const fiestaRows = await sql`
    update events
    set event_type = 'fiesta',
        updated_at = now()
    where status = 'active'
      and event_type <> 'fiesta'
      and (
        (
          event_type in ('club', 'bar', 'otro')
          and start_time is not null
          and extract(hour from start_time) >= 23
        )
        or lower(name) ~ '(fiesta|party|boliche|dj|dance|cloud\\s*sessions?|perreo|reggaeton|reggeaton|regueton)'
        or lower(coalesce(description, '')) ~ '(fiesta|party|boliche|dj|dance|cloud\\s*sessions?|perreo|reggaeton|reggeaton|regueton)'
      )
    returning id, name, city, event_type
  `;

  const deportivoRows = await sql`
    update events
    set event_type = 'deportivo',
        updated_at = now()
    where status = 'active'
      and event_type <> 'deportivo'
      and (
        lower(name) ~ '(box|boxeo|velada\\s+de\\s+box|mma|ufc|kick\\s*boxing|combate|pelea|torneo|maraton|futbol|basquet|basket)'
        or lower(coalesce(description, '')) ~ '(box|boxeo|velada\\s+de\\s+box|mma|ufc|kick\\s*boxing|combate|pelea|torneo|maraton|futbol|basquet|basket)'
      )
    returning id, name, city, event_type
  `;

  const teatroRows = await sql`
    update events
    set event_type = 'teatro',
        updated_at = now()
    where status = 'active'
      and event_type <> 'teatro'
      and event_type = 'otro'
      and (
        lower(name) ~ '(teatro|obra|funcion|dramaturgia|monologo|elenco|comedia|the\\s+crucible)'
        or lower(coalesce(description, '')) ~ '(teatro|obra|funcion|dramaturgia|monologo|elenco|comedia)'
      )
    returning id, name, city, event_type
  `;

  const culturalRows = await sql`
    update events
    set event_type = 'cultural',
        updated_at = now()
    where status = 'active'
      and event_type <> 'cultural'
      and event_type in ('otro', 'teatro')
      and (
        lower(name) ~ '(cine|pelicula|film|documental|proyeccion|museo|exposicion|galeria|audiovisual|literatura|poesia)'
        or lower(coalesce(description, '')) ~ '(cine|pelicula|film|documental|proyeccion|museo|exposicion|galeria|audiovisual|literatura|poesia)'
      )
    returning id, name, city, event_type
  `;

  const conciertoRows = await sql`
    update events
    set event_type = 'concierto',
        updated_at = now()
    where status = 'active'
      and event_type <> 'concierto'
      and event_type = 'otro'
      and (
        lower(name) ~ '(concierto|banda\\s+en\\s+vivo|musica\\s+en\\s+vivo|tour|gira)'
        or lower(coalesce(description, '')) ~ '(concierto|banda\\s+en\\s+vivo|musica\\s+en\\s+vivo|tour|gira)'
      )
    returning id, name, city, event_type
  `;

  console.log(`Reclasificados a fiesta: ${fiestaRows.length}`);
  for (const row of fiestaRows.slice(0, 20)) {
    console.log(`- ${row.name} (${row.city}) -> ${row.event_type}`);
  }

  console.log(`Reclasificados a deportivo: ${deportivoRows.length}`);
  for (const row of deportivoRows.slice(0, 20)) {
    console.log(`- ${row.name} (${row.city}) -> ${row.event_type}`);
  }

  console.log(`Reclasificados a teatro: ${teatroRows.length}`);
  for (const row of teatroRows.slice(0, 20)) {
    console.log(`- ${row.name} (${row.city}) -> ${row.event_type}`);
  }

  console.log(`Reclasificados a cultural: ${culturalRows.length}`);
  for (const row of culturalRows.slice(0, 20)) {
    console.log(`- ${row.name} (${row.city}) -> ${row.event_type}`);
  }

  console.log(`Reclasificados a concierto: ${conciertoRows.length}`);
  for (const row of conciertoRows.slice(0, 20)) {
    console.log(`- ${row.name} (${row.city}) -> ${row.event_type}`);
  }
} catch (error) {
  console.error("Error al reclasificar:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
