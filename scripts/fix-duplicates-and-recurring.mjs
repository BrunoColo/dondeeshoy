import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL no está definido."); process.exit(1); }
const sql = postgres(url, { ssl: "require" });

try {
  // ═══════════════════════════════════════════════════════
  // STEP 1: Remove "Venue por confirmar" duplicates
  // When the same event name+date exists with a real venue AND with
  // "Venue por confirmar", delete the placeholder version.
  // ═══════════════════════════════════════════════════════
  console.log("\n=== STEP 1: Remove 'Venue por confirmar' duplicates ===");

  // First, find all duplicate pairs
  const dupePairs = await sql`
    WITH dupes AS (
      SELECT name, date, 
             array_agg(id ORDER BY CASE WHEN venue_name = 'Venue por confirmar' THEN 1 ELSE 0 END) as ids,
             array_agg(venue_name ORDER BY CASE WHEN venue_name = 'Venue por confirmar' THEN 1 ELSE 0 END) as venues
      FROM events
      WHERE status = 'active'
      GROUP BY name, date
      HAVING count(*) > 1
        AND bool_or(venue_name = 'Venue por confirmar')
        AND bool_or(venue_name <> 'Venue por confirmar')
    )
    SELECT * FROM dupes
  `;

  console.log(`  Found ${dupePairs.length} duplicate groups with placeholder venues`);

  // Collect IDs to delete (the "Venue por confirmar" versions)
  const idsToDelete = [];
  for (const dupe of dupePairs) {
    for (let i = 0; i < dupe.ids.length; i++) {
      if (dupe.venues[i] === "Venue por confirmar") {
        idsToDelete.push(dupe.ids[i]);
        console.log(`  Will delete: "${dupe.name}" (${dupe.date}) — placeholder ID: ${dupe.ids[i]}`);
      }
    }
  }

  if (idsToDelete.length > 0) {
    // Delete event_sources references first
    const deletedSources = await sql`
      DELETE FROM event_sources WHERE event_id = ANY(${idsToDelete}::uuid[])
      RETURNING id
    `;
    console.log(`  Deleted ${deletedSources.length} event_source links`);

    // Delete the duplicate events
    const deletedEvents = await sql`
      DELETE FROM events WHERE id = ANY(${idsToDelete}::uuid[])
      RETURNING id, name
    `;
    console.log(`  Deleted ${deletedEvents.length} duplicate 'Venue por confirmar' events`);
  } else {
    console.log("  No placeholder duplicates to remove");
  }

  // ═══════════════════════════════════════════════════════
  // STEP 2: Mark events as recurring based on raw_events dateText  
  // ═══════════════════════════════════════════════════════
  console.log("\n=== STEP 2: Mark recurring via dateText patterns ===");

  const recurringByDateText = await sql`
    UPDATE events e
    SET is_recurring = true, updated_at = now()
    FROM event_sources es
    JOIN raw_events re ON es.raw_event_id = re.id
    WHERE e.id = es.event_id
      AND e.status = 'active'
      AND e.is_recurring = false
      AND (
        re.raw_data->>'dateText' ~* '(todo el a[nñ]o|todos los d[ií]as|de lunes a|lunes a|martes a|mi[eé]rcoles a|jueves a|viernes a|s[aá]bados? a|domingos? a|todos los (lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)|cada (lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)|s[aá]bados? y domingos?|viernes y s[aá]bados?|jueves y viernes|martes y jueves|permanente|semanal)'
        OR re.raw_data->>'dateText' ~* '(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\\s+a\\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)'
      )
    RETURNING e.id, e.name
  `;
  console.log(`  Marked ${recurringByDateText.length} events as recurring via dateText`);
  for (const r of recurringByDateText) {
    console.log(`    ✓ "${r.name}"`);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 3: Mark events as recurring via description/name patterns
  // ═══════════════════════════════════════════════════════
  console.log("\n=== STEP 3: Mark recurring via name/description patterns ===");

  const recurringByText = await sql`
    UPDATE events
    SET is_recurring = true, updated_at = now()
    WHERE status = 'active'
      AND is_recurring = false
      AND (
        lower(name) || ' ' || lower(coalesce(description, '')) ~* '(todo el a[nñ]o|todos los d[ií]as|permanente|de lunes a|lunes a viernes|lunes a s[aá]bado|lunes a domingo|martes a viernes|martes a domingo|s[aá]bados? y domingos?|visitas? (a la|al|guiadas?))'
      )
    RETURNING id, name
  `;
  console.log(`  Marked ${recurringByText.length} events as recurring via name/description`);
  for (const r of recurringByText) {
    console.log(`    ✓ "${r.name}"`);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 4: Mark multi-date events as recurring
  // Events that appear on 3+ different dates with same name+venue
  // are theater runs / recurring shows, NOT one-time events
  // ═══════════════════════════════════════════════════════
  console.log("\n=== STEP 4: Mark multi-date events (3+ dates) as recurring ===");

  const multiDate = await sql`
    WITH multi AS (
      SELECT name, venue_name
      FROM events
      WHERE status = 'active' AND venue_name <> 'Venue por confirmar'
      GROUP BY name, venue_name
      HAVING count(DISTINCT date) >= 3
    )
    UPDATE events e
    SET is_recurring = true, updated_at = now()
    FROM multi m
    WHERE e.name = m.name
      AND e.venue_name = m.venue_name
      AND e.status = 'active'
      AND e.is_recurring = false
    RETURNING e.id, e.name, e.date
  `;
  console.log(`  Marked ${multiDate.length} event-dates as recurring (multi-date shows)`);
  const uniqueNames = [...new Set(multiDate.map(r => r.name))];
  for (const name of uniqueNames) {
    const count = multiDate.filter(r => r.name === name).length;
    console.log(`    ✓ "${name}" (${count} dates)`);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 5: Final summary
  // ═══════════════════════════════════════════════════════
  console.log("\n=== FINAL SUMMARY ===");
  const summary = await sql`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE is_recurring) as recurring,
      count(*) FILTER (WHERE NOT is_recurring) as unique_count,
      count(*) FILTER (WHERE venue_name = 'Venue por confirmar') as placeholder_venues
    FROM events WHERE status = 'active'
  `;
  const s = summary[0];
  console.log(`  Total active events: ${s.total}`);
  console.log(`  Recurring: ${s.recurring}`);
  console.log(`  Unique: ${s.unique_count}`);
  console.log(`  Still with 'Venue por confirmar': ${s.placeholder_venues}`);

  // Show today's events after fix
  console.log("\n=== TODAY'S EVENTS AFTER FIX ===");
  const today = await sql`
    SELECT name, venue_name, is_recurring, event_type
    FROM events
    WHERE status = 'active' AND date = '2026-02-17'
    ORDER BY is_recurring, name
  `;
  for (const e of today) {
    console.log(`  ${e.is_recurring ? '🔄' : '⭐'} [${e.event_type}] "${e.name}" @ ${e.venue_name}`);
  }

} finally {
  await sql.end();
}
