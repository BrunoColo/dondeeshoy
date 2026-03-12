/**
 * fix-same-day-duplicates.mjs
 *
 * Detecta eventos activos del mismo día que probablemente representan el mismo
 * evento scrapeado más de una vez (a veces desde fuentes distintas) y permite:
 *   - elegir un canónico con mejor información,
 *   - re-vincular `event_sources`,
 *   - bannear SOLO los source+sourceId descartados,
 *   - eliminar la fila duplicada.
 *
 * Uso:
 *   node scripts/fix-same-day-duplicates.mjs           # dry-run
 *   node scripts/fix-same-day-duplicates.mjs --apply   # aplica cambios
 *   node scripts/fix-same-day-duplicates.mjs --apply --min-score=0.84
 */

import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const minScoreArg = process.argv.find((arg) => arg.startsWith("--min-score="));
const MIN_SCORE = minScoreArg ? Number.parseFloat(minScoreArg.split("=")[1] ?? "0.84") : 0.84;
const SUBEVENT_QUALIFIER_REGEX = /(meet\s+and\s+greet|acciones?\s+con\s+invitados|invitados?|guest|vip|upgrade|combo|pack|abono|workshop|taller|charla|firma|foto|foto\s*op|short|gravel|xcm|elite|kids|ni[nñ]os|infantil|acceso|sector|platea|campo|mesa|pista|fan\s*zone|hospitality)/i;
// Optional escape hatch for ambiguous umbrella cases that a human already reviewed.
// Example:
// { keepId: "uuid-canonic", dropId: "uuid-duplicate" }
const MANUAL_FORCE_PAIRS = [];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBanName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toBigrams(value) {
  const compact = normalize(value);
  const grams = new Set();
  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.add(compact.slice(index, index + 2));
  }
  return grams;
}

function similarity(a, b) {
  const aBigrams = toBigrams(a);
  const bBigrams = toBigrams(b);
  if (aBigrams.size === 0 || bBigrams.size === 0) return 0;

  let overlap = 0;
  for (const gram of aBigrams) {
    if (bBigrams.has(gram)) overlap += 1;
  }
  return (2 * overlap) / (aBigrams.size + bBigrams.size);
}

function getTokens(value) {
  return normalize(value).split(/\s+/).filter((token) => token.length > 2);
}

function tokenContainment(a, b) {
  const aTokens = getTokens(a);
  const bTokens = getTokens(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const shorter = aTokens.length <= bTokens.length ? aTokens : bTokens;
  const longerSet = new Set(aTokens.length <= bTokens.length ? bTokens : aTokens);
  let shared = 0;
  for (const token of shorter) {
    if (longerSet.has(token)) shared += 1;
  }
  return shared / shorter.length;
}

function containsSubstring(a, b) {
  const aa = normalize(a);
  const bb = normalize(b);
  const shorter = aa.length <= bb.length ? aa : bb;
  const longer = aa.length > bb.length ? aa : bb;
  return shorter.length >= 4 && longer.includes(shorter);
}

function getExtraQualifierText(a, b) {
  const aa = normalize(a);
  const bb = normalize(b);
  if (aa === bb) return "";

  const shorter = aa.length <= bb.length ? aa : bb;
  const longer = aa.length > bb.length ? aa : bb;
  if (!longer.includes(shorter)) return "";

  return longer.replace(shorter, " ").replace(/\s+/g, " ").trim();
}

function looksLikeSubEventVariant(a, b) {
  const extra = getExtraQualifierText(a, b);
  return extra.length > 0 && SUBEVENT_QUALIFIER_REGEX.test(extra);
}

function getTailSegment(value) {
  const raw = String(value ?? "");
  const segments = raw
    .split(/[:|–-]/)
    .map((part) => normalize(part))
    .filter(Boolean);

  return segments.length > 1 ? segments.at(-1) : normalize(value);
}

function hasCompatibleTail(a, b) {
  const rawA = String(a ?? "");
  const rawB = String(b ?? "");
  const hasStructuredA = /[:|–-]/.test(rawA);
  const hasStructuredB = /[:|–-]/.test(rawB);

  if (!hasStructuredA || !hasStructuredB) {
    return true;
  }

  const tailA = getTailSegment(a);
  const tailB = getTailSegment(b);
  return similarity(tailA, tailB) >= 0.45 || tokenContainment(tailA, tailB) >= 0.5 || containsSubstring(tailA, tailB);
}

function infoScore(row) {
  return [
    row.description ? 3 : 0,
    row.image_url ? 2 : 0,
    row.ticket_url ? 2 : 0,
    row.price_min != null ? 1 : 0,
    row.price_max != null ? 1 : 0,
    Number(row.view_count ?? 0) > 0 ? 1 : 0,
    Number(row.source_count ?? 0),
  ].reduce((sum, value) => sum + value, 0);
}

function chooseCanonical(a, b) {
  const scoreA = infoScore(a);
  const scoreB = infoScore(b);
  if (scoreA !== scoreB) {
    return scoreA > scoreB ? [a, b] : [b, a];
  }

  const createdA = new Date(a.created_at).getTime();
  const createdB = new Date(b.created_at).getTime();
  return createdA <= createdB ? [a, b] : [b, a];
}

function buildCandidate(a, b) {
  if (String(a.date) !== String(b.date)) return null;

  const exactName = normalize(a.name) === normalize(b.name);
  const sameStartTime = (a.start_time ?? null) !== null && a.start_time === b.start_time;
  const venueScore = similarity(a.venue_name, b.venue_name);
  const sameVenue = normalize(a.venue_name) === normalize(b.venue_name);

  // Exact-title duplicates often use venue aliases across sources.
  if (!sameVenue && !sameStartTime && !exactName) {
    return null;
  }

  const bigramScore = similarity(a.name, b.name);
  const containment = tokenContainment(a.name, b.name);
  const substring = containsSubstring(a.name, b.name);
  const sharedTokens = (() => {
    const aTokens = new Set(getTokens(a.name));
    const bTokens = new Set(getTokens(b.name));
    let shared = 0;
    for (const token of aTokens) {
      if (bTokens.has(token)) shared += 1;
    }
    return shared;
  })();

  const compatibleTail = hasCompatibleTail(a.name, b.name);
  if (!compatibleTail && !exactName) {
    return null;
  }

  if (!exactName && (SUBEVENT_QUALIFIER_REGEX.test(normalize(a.name)) || SUBEVENT_QUALIFIER_REGEX.test(normalize(b.name)))) {
    return null;
  }

  if (!exactName && looksLikeSubEventVariant(a.name, b.name)) {
    return null;
  }

  let confidence = Math.max(bigramScore, containment);
  if (substring) confidence = Math.max(confidence, 0.9);
  if (exactName) confidence = 1;
  if (sameStartTime) confidence += 0.06;
  if (sameVenue) confidence += 0.08;
  else if (venueScore >= 0.7) confidence += 0.04;
  if (sharedTokens >= 4) confidence += 0.05;

  confidence = Math.min(confidence, 1);

  const qualifies =
    (exactName && (sameStartTime || sameVenue)) ||
    (sameStartTime && sameVenue && (confidence >= MIN_SCORE || sharedTokens >= 4)) ||
    (confidence >= MIN_SCORE && compatibleTail);

  if (!qualifies) {
    return null;
  }

  const [keep, drop] = chooseCanonical(a, b);

  const forced = MANUAL_FORCE_PAIRS.some(
    (pair) =>
      (pair.keepId === keep.id && pair.dropId === drop.id) ||
      (pair.keepId === drop.id && pair.dropId === keep.id),
  );

  return {
    date: String(a.date).slice(0, 10),
    startTime: a.start_time,
    venueA: a.venue_name,
    venueB: b.venue_name,
    exactName,
    sameStartTime,
    sameVenue,
    venueScore: Number(venueScore.toFixed(3)),
    bigramScore: Number(bigramScore.toFixed(3)),
    containment: Number(containment.toFixed(3)),
    sharedTokens,
    confidence: Number(confidence.toFixed(3)),
    forced,
    keep,
    drop,
  };
}

try {
  console.log(`=== Same-day duplicate cleanup (${APPLY ? "APPLY" : "DRY RUN"}) ===`);
  console.log(`Minimum confidence: ${MIN_SCORE}`);

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
      e.created_at,
      count(distinct es.id) as source_count,
      array_agg(distinct es.source::text) filter (where es.source is not null) as sources,
      array_agg(distinct re.source_id) filter (where re.source_id is not null) as source_ids
    from events e
    left join event_sources es on es.event_id = e.id
    left join raw_events re on re.id = es.raw_event_id
    where e.status = 'active'
      and coalesce(e.is_recurring, false) = false
      and e.date >= current_date
    group by e.id
    order by e.date, e.start_time nulls first, e.name
  `;

  const candidates = [];
  const usedDrops = new Set();

  for (let index = 0; index < rows.length; index += 1) {
    for (let next = index + 1; next < rows.length; next += 1) {
      const candidate = buildCandidate(rows[index], rows[next]);
      if (!candidate) continue;
      if (usedDrops.has(candidate.keep.id) || usedDrops.has(candidate.drop.id)) continue;
      usedDrops.add(candidate.drop.id);
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    console.log("✅ No se encontraron duplicados de alta confianza.");
    process.exit(0);
  }

  console.log(`\nEncontrados ${candidates.length} duplicados de alta confianza:\n`);
  for (const candidate of candidates) {
    console.log(`• ${candidate.date} ${candidate.startTime ?? "sin hora"}`);
    console.log(`  keep: ${candidate.keep.name} [${candidate.keep.id}]`);
    console.log(`  drop: ${candidate.drop.name} [${candidate.drop.id}]`);
    console.log(`  venue: "${candidate.venueA}" <> "${candidate.venueB}"`);
    console.log(`  confidence=${candidate.confidence} bigram=${candidate.bigramScore} containment=${candidate.containment} venueScore=${candidate.venueScore}${candidate.forced ? " [FORZADO]" : ""}`);
    console.log("");
  }

  if (!APPLY) {
    console.log("Dry-run finalizado. Usá --apply para ejecutar cambios.");
    process.exit(0);
  }

  let totalRelinked = 0;
  let totalBans = 0;
  let totalDeleted = 0;

  for (const candidate of candidates) {
    const sources = await sql`
      select es.id, es.raw_event_id, es.source, re.source_id
      from event_sources es
      join raw_events re on re.id = es.raw_event_id
      where es.event_id = ${candidate.drop.id}
    `;

    for (const sourceRow of sources) {
      const existingLink = await sql`
        select id
        from event_sources
        where event_id = ${candidate.keep.id}
          and raw_event_id = ${sourceRow.raw_event_id}
        limit 1
      `;

      if (existingLink.length === 0) {
        await sql`
          update event_sources
          set event_id = ${candidate.keep.id}
          where id = ${sourceRow.id}
        `;
        totalRelinked += 1;
      } else {
        await sql`delete from event_sources where id = ${sourceRow.id}`;
      }

      const existingBan = await sql`
        select id
        from banned_events
        where source = ${sourceRow.source}
          and source_id = ${sourceRow.source_id}
        limit 1
      `;

      if (existingBan.length === 0) {
        await sql`
          insert into banned_events (normalized_name, original_name, source, source_id, reason)
          values (
            ${normalizeBanName(candidate.drop.name)},
            ${candidate.drop.name},
            ${sourceRow.source},
            ${sourceRow.source_id},
            ${`Auto-ban por duplicado mismo día; canónico: ${candidate.keep.id}`}
          )
        `;
        totalBans += 1;
      }
    }

    const deleted = await sql`
      delete from events
      where id = ${candidate.drop.id}
      returning id
    `;
    totalDeleted += deleted.length;
  }

  console.log("\n=== RESUMEN ===");
  console.log(`Duplicados procesados: ${candidates.length}`);
  console.log(`event_sources re-vinculados: ${totalRelinked}`);
  console.log(`bans exactos insertados: ${totalBans}`);
  console.log(`eventos eliminados: ${totalDeleted}`);
} finally {
  await sql.end();
}