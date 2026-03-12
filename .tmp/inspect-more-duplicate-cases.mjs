import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

async function fetchByTerm(term) {
  return sql`
    select
      e.id,
      e.name,
      e.date,
      e.start_time,
      e.venue_name,
      e.description,
      e.image_url,
      e.ticket_url,
      e.price_min,
      e.price_max,
      e.view_count,
      e.confidence_score,
      e.created_at,
      array_agg(distinct es.source::text) filter (where es.source is not null) as sources,
      array_agg(distinct re.source_id) filter (where re.source_id is not null) as source_ids
    from events e
    left join event_sources es on es.event_id = e.id
    left join raw_events re on re.id = es.raw_event_id
    where e.status = 'active'
      and e.name ilike ${`%${term}%`}
    group by e.id
    order by e.date, e.start_time nulls first, e.created_at
  `;
}

for (const term of ["Feliz dia", "Detectival", "Detrás de la mirada ajena"]) {
  console.log(`\n=== ${term} ===`);
  console.log(JSON.stringify(await fetchByTerm(term), null, 2));
}

await sql.end();
