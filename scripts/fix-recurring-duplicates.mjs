/**
 * fix-recurring-duplicates.mjs
 *
 * Cleans up duplicate recurring events that accumulated because the deduplicator
 * was matching by date — but recurring events can be re-scraped on different dates,
 * so each scrape cycle created a new row instead of merging into the existing one.
 *
 * Strategy:
 *   1. Find groups of recurring events with the same name + city (ignoring date).
 *   2. Keep the oldest row (lowest createdAt) as the canonical one.
 *   3. Re-link all event_sources from duplicates to the canonical row.
 *   4. Delete the duplicate rows.
 */

import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}
const sql = postgres(url, { ssl: "require" });

try {
  console.log("=== Buscando eventos recurrentes duplicados ===\n");

  // Find recurring events that share the same normalized name + city
  // Group them and pick the oldest as canonical.
  const duplicateGroups = await sql`
    WITH recurring AS (
      SELECT
        id,
        name,
        city,
        venue_name,
        date,
        created_at,
        -- Normalize name for comparison (lower, strip accents via unaccent if available, else just lower)
        lower(regexp_replace(name, '[^a-zA-Z0-9 ]', '', 'g')) AS norm_name
      FROM events
      WHERE status = 'active' AND is_recurring = true
    ),
    grouped AS (
      SELECT
        norm_name,
        city,
        count(*) AS cnt,
        min(created_at) AS oldest_created,
        array_agg(id ORDER BY created_at ASC) AS ids,
        array_agg(name ORDER BY created_at ASC) AS names,
        array_agg(date ORDER BY created_at ASC) AS dates
      FROM recurring
      GROUP BY norm_name, city
      HAVING count(*) > 1
    )
    SELECT * FROM grouped ORDER BY cnt DESC
  `;

  if (duplicateGroups.length === 0) {
    console.log("✅ No se encontraron eventos recurrentes duplicados.");
    await sql.end();
    process.exit(0);
  }

  console.log(`Encontrados ${duplicateGroups.length} grupos de duplicados:\n`);

  let totalDeleted = 0;
  let totalRelinked = 0;

  for (const group of duplicateGroups) {
    const [canonicalId, ...duplicateIds] = group.ids;
    const [canonicalName, ...duplicateNames] = group.names;
    const [canonicalDate, ...duplicateDates] = group.dates;

    console.log(`📌 "${canonicalName}" (${group.city}) — ${group.cnt} copias`);
    console.log(`   Canónico: ${canonicalId} (fecha: ${canonicalDate})`);
    console.log(`   Duplicados a eliminar:`);
    for (let i = 0; i < duplicateIds.length; i++) {
      console.log(`     - ${duplicateIds[i]} (fecha: ${duplicateDates[i]}, nombre: "${duplicateNames[i]}")`);
    }

    // Re-link event_sources from duplicates to canonical, avoiding duplicates
    for (const dupId of duplicateIds) {
      // Get sources linked to this duplicate
      const sources = await sql`
        SELECT id, raw_event_id, source, source_url
        FROM event_sources
        WHERE event_id = ${dupId}
      `;

      for (const src of sources) {
        // Check if this raw_event_id is already linked to the canonical
        const existing = await sql`
          SELECT id FROM event_sources
          WHERE event_id = ${canonicalId} AND raw_event_id = ${src.raw_event_id}
          LIMIT 1
        `;

        if (existing.length === 0) {
          await sql`
            UPDATE event_sources
            SET event_id = ${canonicalId}
            WHERE id = ${src.id}
          `;
          totalRelinked++;
        } else {
          // Already linked — just delete the orphan source
          await sql`DELETE FROM event_sources WHERE id = ${src.id}`;
        }
      }
    }

    // Delete the duplicate events (event_sources cascade or were already re-linked)
    const deleted = await sql`
      DELETE FROM events
      WHERE id = ANY(${duplicateIds}::uuid[])
      RETURNING id, name
    `;
    totalDeleted += deleted.length;
    console.log(`   ✓ Eliminados ${deleted.length} duplicados\n`);
  }

  console.log("=== RESUMEN ===");
  console.log(`  Grupos procesados: ${duplicateGroups.length}`);
  console.log(`  Eventos eliminados: ${totalDeleted}`);
  console.log(`  Sources re-vinculados: ${totalRelinked}`);

  // Final count
  const summary = await sql`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE is_recurring) AS recurring,
      count(*) FILTER (WHERE NOT is_recurring) AS one_time
    FROM events WHERE status = 'active'
  `;
  const s = summary[0];
  console.log(`\n  Total eventos activos: ${s.total}`);
  console.log(`  Recurrentes: ${s.recurring}`);
  console.log(`  Únicos: ${s.one_time}`);
} finally {
  await sql.end();
}
