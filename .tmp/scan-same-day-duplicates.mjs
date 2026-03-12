import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value).split(/\s+/).filter((t) => t.length > 2);
}

function tokenContainment(a, b) {
  const aTokens = tokens(a);
  const bTokens = tokens(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens;
  const longerSet = new Set(aTokens.length <= bTokens.length ? bTokens : aTokens);
  const shared = shorter.filter((token) => longerSet.has(token)).length;
  return shared / shorter.length;
}

function bigrams(value) {
  const compact = normalize(value);
  const out = new Set();
  for (let i = 0; i < compact.length - 1; i += 1) out.add(compact.slice(i, i + 2));
  return out;
}

function similarity(a, b) {
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (aa.size === 0 || bb.size === 0) return 0;
  let overlap = 0;
  for (const gram of aa) if (bb.has(gram)) overlap += 1;
  return (2 * overlap) / (aa.size + bb.size);
}

function infoScore(row) {
  return [
    row.description ? 2 : 0,
    row.image_url ? 1 : 0,
    row.ticket_url ? 1 : 0,
    row.price_min != null ? 1 : 0,
    row.price_max != null ? 1 : 0,
    row.view_count > 0 ? 1 : 0,
    row.source_count,
  ].reduce((sum, n) => sum + n, 0);
}

const rows = await sql`
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
    count(distinct es.id) as source_count,
    array_agg(distinct es.source::text) filter (where es.source is not null) as sources
  from events e
  left join event_sources es on es.event_id = e.id
  where e.status = 'active'
    and e.date >= current_date
    and coalesce(e.is_recurring, false) = false
  group by e.id
  order by e.date, e.start_time nulls first, e.venue_name, e.name
`;

const candidates = [];
for (let i = 0; i < rows.length; i += 1) {
  for (let j = i + 1; j < rows.length; j += 1) {
    const a = rows[i];
    const b = rows[j];
    if (String(a.date) !== String(b.date)) continue;
    if ((a.start_time ?? "") !== (b.start_time ?? "")) continue;
    if (normalize(a.venue_name) !== normalize(b.venue_name)) continue;
    const containment = tokenContainment(a.name, b.name);
    const bigram = similarity(a.name, b.name);
    const sameTicketUrl = a.ticket_url && b.ticket_url && a.ticket_url === b.ticket_url;
    const score = Math.max(bigram, containment);
    if (sameTicketUrl || score >= 0.72 || containment >= 0.75) {
      const keep = infoScore(a) >= infoScore(b) ? a : b;
      const drop = keep.id === a.id ? b : a;
      candidates.push({
        date: String(a.date).slice(0, 10),
        start_time: a.start_time,
        venue_name: a.venue_name,
        score: Number(score.toFixed(3)),
        containment: Number(containment.toFixed(3)),
        keep: { id: keep.id, name: keep.name, infoScore: infoScore(keep), sources: keep.sources },
        drop: { id: drop.id, name: drop.name, infoScore: infoScore(drop), sources: drop.sources },
      });
    }
  }
}

candidates.sort((a, b) => b.score - a.score || b.containment - a.containment || a.date.localeCompare(b.date));
console.log(JSON.stringify(candidates.slice(0, 60), null, 2));

await sql.end();
