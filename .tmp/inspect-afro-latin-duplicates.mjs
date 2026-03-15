import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

const term = "%afro latin fest%";

const rows = await sql`
  select
    e.id,
    e.name,
    e.date,
    e.start_time,
    e.venue_name,
    e.department,
    e.is_recurring,
    e.created_at,
    array_agg(distinct es.source::text) filter (where es.source is not null) as sources,
    array_agg(distinct re.source_id) filter (where re.source_id is not null) as source_ids
  from events e
  left join event_sources es on es.event_id = e.id
  left join raw_events re on re.id = es.raw_event_id
  where e.status = 'active'
    and lower(e.name) like ${term}
  group by e.id
  order by e.date, e.start_time nulls first, e.created_at
`;

console.log("=== EVENTS ===");
console.log(JSON.stringify(rows, null, 2));

if (rows.length >= 2) {
  const [a, b] = rows;
  const normalize = (value) =>
    String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const toBigrams = (value) => {
    const compact = value.replace(/\s+/g, " ");
    const grams = new Set();
    for (let i = 0; i < compact.length - 1; i += 1) {
      grams.add(compact.slice(i, i + 2));
    }
    return grams;
  };

  const similarity = (x, y) => {
    if (!x || !y) return 0;
    if (x === y) return 1;
    const xg = toBigrams(x);
    const yg = toBigrams(y);
    let overlap = 0;
    for (const g of xg) {
      if (yg.has(g)) overlap += 1;
    }
    return (2 * overlap) / (xg.size + yg.size);
  };

  const n1 = normalize(a.name);
  const n2 = normalize(b.name);
  const v1 = normalize(a.venue_name);
  const v2 = normalize(b.venue_name);

  console.log("\n=== QUICK COMPARE (first 2 rows) ===");
  console.log({
    nameA: a.name,
    nameB: b.name,
    nameSimilarity: similarity(n1, n2),
    startTimeA: a.start_time,
    startTimeB: b.start_time,
    sameStartTime: a.start_time && b.start_time ? a.start_time === b.start_time : false,
    venueA: a.venue_name,
    venueB: b.venue_name,
    venueSimilarity: similarity(v1, v2),
    sameDepartment: a.department === b.department,
    dateA: a.date,
    dateB: b.date,
  });
}

await sql.end();
