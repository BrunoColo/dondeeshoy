/**
 * fix-recurring-duplicates.mjs
 *
 * Cleans up duplicate recurring events that accumulated because the deduplicator
 * was not always receiving the same recurrence signal that the classifier used.
 * Some listings only expose schedule patterns via raw `dateText` (e.g. search cards),
 * so the pipeline correctly marked them as recurring, but deduplication sometimes
 * treated them as one-off events and created a new row on later re-scrapes.
 *
 * Strategy:
 *   1. Backfill `is_recurring` using the same kind of schedule patterns used by the classifier.
 *   2. Find recurring groups with the same normalized name + location + venue (ignoring date).
 *   3. Keep the oldest row as the canonical one.
 *   4. Re-link all event_sources from duplicates to the canonical row.
 *   5. Delete the duplicate rows.
 */

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
  "abierto\\s+(?:todos\\s+los\\s+d[ií]as|siempre)",
  "(?:de\\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\\s+a\\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)",
  "todos\\s+los\\s+fines?\\s*de\\s*semana",
  "cada\\s+fin\\s*de\\s*semana",
  "todos?\\s+los?\\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)",
  "cada\\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)",
  "s[aá]bados?\\s+y\\s+domingos?",
  "viernes\\s+y\\s+s[aá]bados?",
  "jueves\\s+y\\s+viernes",
  "martes\\s+y\\s+jueves",
  "lun(?:es)?\\.?\\s*a\\s*vie(?:rnes)?\\.?",
  "s[aá]b\\.?\\s*y\\s*dom\\.?",
].join("|");

const placeholderVenueRegex = "^(venue por confirmar|por confirmar|tba)?$";

try {
  console.log("=== Buscando eventos recurrentes duplicados ===\n");

  const backfilledRecurring = await sql`
    UPDATE events e
    SET is_recurring = true,
        updated_at = now()
    WHERE e.status = 'active'
      AND e.is_recurring = false
      AND (
        lower(e.name) ~ ${recurringRegex}
        OR lower(coalesce(e.description, '')) ~ ${recurringRegex}
        OR EXISTS (
          SELECT 1
          FROM event_sources es
          JOIN raw_events r ON r.id = es.raw_event_id
          WHERE es.event_id = e.id
            AND (
              lower(coalesce(r.raw_data->>'dateText', '')) ~ ${recurringRegex}
              OR lower(coalesce(r.raw_data->>'description', '')) ~ ${recurringRegex}
            )
        )
      )
    RETURNING e.id, e.name
  `;

  console.log(`Marcados como recurrentes antes de deduplicar: ${backfilledRecurring.length}`);

  // Find recurring events that share the same normalized name + location + venue.
  // Group them and pick the oldest as canonical.
  const duplicateGroups = await sql`
    WITH recurring AS (
      SELECT
        id,
        name,
        city,
        department,
        venue_name,
        date,
        created_at,
        lower(regexp_replace(name, '[^a-zA-Z0-9 ]', '', 'g')) AS norm_name,
        coalesce(nullif(trim(city), ''), nullif(trim(department), ''), '__sin_ubicacion__') AS location_key,
        CASE
          WHEN lower(trim(coalesce(venue_name, ''))) ~ ${placeholderVenueRegex} THEN '__placeholder__'
          ELSE lower(regexp_replace(coalesce(venue_name, ''), '[^a-zA-Z0-9 ]', '', 'g'))
        END AS norm_venue
      FROM events
      WHERE status = 'active' AND is_recurring = true
    ),
    grouped AS (
      SELECT
        norm_name,
        location_key,
        norm_venue,
        count(*) AS cnt,
        min(created_at) AS oldest_created,
        array_agg(id ORDER BY created_at ASC) AS ids,
        array_agg(name ORDER BY created_at ASC) AS names,
        array_agg(date ORDER BY created_at ASC) AS dates,
        array_agg(venue_name ORDER BY created_at ASC) AS venues
      FROM recurring
      GROUP BY norm_name, location_key, norm_venue
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
    const [canonicalVenue, ...duplicateVenues] = group.venues;

    console.log(`📌 "${canonicalName}" (${group.location_key}) — ${group.cnt} copias`);
    console.log(`   Canónico: ${canonicalId} (fecha: ${canonicalDate}, venue: "${canonicalVenue}")`);
    console.log(`   Duplicados a eliminar:`);
    for (let i = 0; i < duplicateIds.length; i++) {
      console.log(`     - ${duplicateIds[i]} (fecha: ${duplicateDates[i]}, nombre: "${duplicateNames[i]}", venue: "${duplicateVenues[i]}")`);
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
