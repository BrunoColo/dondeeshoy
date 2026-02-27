/**
 * Fix events that were misclassified as "gastronomico" but are actually "familiar"
 * (e.g. trampoline parks, adventure parks, etc.) and fix their is_recurring flag.
 *
 * Root cause: CobraTicket sometimes assigns "Gastronomía" to venues that have a
 * restaurant/food area, even when the actual event is a family/adventure activity.
 * The classifier was trusting the source category over the text heuristics.
 *
 * This script:
 * 1. Reclassifies events with familiar keywords from "gastronomico" → "familiar"
 * 2. Marks those events as recurring if their name/description/dateText contains
 *    schedule patterns like "lunes a viernes" or "sábados y domingos"
 */

import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

// Familiar keywords that should override "gastronomico" classification
const familiarKeywords = [
  "trampoline",
  "trampolín",
  "trampolin",
  "parque\\s+(?:de\\s+)?aventura",
  "parque\\s+destrezas",
  "nimbus",
  "paintball",
  "aquapark",
  "aquamanía",
  "aquamania",
  "bungee",
  "parque\\s+acuático",
  "parque\\s+acuatico",
  "gravity",
  "dino\\s*aventura",
  "circo",
  "parque\\s+bioma",
  "la\\s+cuerda",
  "futvolt",
  "tactical\\s+games",
  "ludus",
].join("|");

// Recurrence patterns (same as in classifier.ts)
const recurringPatterns = [
  "todos\\s+los\\s+d[ií]as",
  "todo\\s+el\\s+a[nñ]o",
  "durante\\s+todo\\s+el\\s+a[nñ]o",
  "abierto\\s+todo\\s+el\\s+a[nñ]o",
  "abierto\\s+(?:todos\\s+los\\s+d[ií]as|siempre)",
  "(?:de\\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)\\s+a\\s+(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)",
  "todos\\s+los\\s+fines?\\s*de?\\s*semana",
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

try {
  // Step 1: Reclassify gastronomico → familiar for events with familiar keywords
  const reclassified = await sql`
    update events e
    set event_type = 'familiar',
        updated_at = now()
    where e.status = 'active'
      and e.event_type = 'gastronomico'
      and (
        lower(e.name) ~ ${familiarKeywords}
        or lower(coalesce(e.description, '')) ~ ${familiarKeywords}
        or lower(e.venue_name) ~ ${familiarKeywords}
        or exists (
          select 1
          from event_sources es
          join raw_events r on r.id = es.raw_event_id
          where es.event_id = e.id
            and (
              lower(coalesce(r.raw_data->>'title', '')) ~ ${familiarKeywords}
              or lower(coalesce(r.raw_data->>'description', '')) ~ ${familiarKeywords}
              or lower(coalesce(r.raw_data->>'venueText', '')) ~ ${familiarKeywords}
            )
        )
      )
    returning e.id, e.name, e.venue_name, e.city
  `;

  console.log(`\nReclasificados gastronomico → familiar: ${reclassified.length}`);
  for (const row of reclassified) {
    console.log(`  ✓ ${row.name} @ ${row.venue_name} (${row.city})`);
  }

  // Step 2: Mark familiar events as recurring if they have schedule patterns
  // Check name, description, AND raw dateText
  const markedRecurring = await sql`
    update events e
    set is_recurring = true,
        updated_at = now()
    where e.status = 'active'
      and e.event_type = 'familiar'
      and e.is_recurring = false
      and (
        lower(e.name) ~ ${recurringPatterns}
        or lower(coalesce(e.description, '')) ~ ${recurringPatterns}
        or exists (
          select 1
          from event_sources es
          join raw_events r on r.id = es.raw_event_id
          where es.event_id = e.id
            and (
              lower(coalesce(r.raw_data->>'dateText', '')) ~ ${recurringPatterns}
              or lower(coalesce(r.raw_data->>'description', '')) ~ ${recurringPatterns}
            )
        )
      )
    returning e.id, e.name, e.venue_name, e.city
  `;

  console.log(`\nMarcados como recurrentes (familiar): ${markedRecurring.length}`);
  for (const row of markedRecurring) {
    console.log(`  ✓ ${row.name} @ ${row.venue_name} (${row.city})`);
  }

  // Step 3: Also fix any other event types that should be recurring
  // (in case they were missed by the original fix-recurring-events.mjs)
  const markedRecurringOther = await sql`
    update events e
    set is_recurring = true,
        updated_at = now()
    where e.status = 'active'
      and e.is_recurring = false
      and (
        lower(e.name) ~ ${recurringPatterns}
        or lower(coalesce(e.description, '')) ~ ${recurringPatterns}
        or exists (
          select 1
          from event_sources es
          join raw_events r on r.id = es.raw_event_id
          where es.event_id = e.id
            and lower(coalesce(r.raw_data->>'dateText', '')) ~ ${recurringPatterns}
        )
      )
    returning e.id, e.name, e.event_type, e.venue_name, e.city
  `;

  console.log(`\nMarcados como recurrentes (todos los tipos): ${markedRecurringOther.length}`);
  for (const row of markedRecurringOther) {
    console.log(`  ✓ [${row.event_type}] ${row.name} @ ${row.venue_name} (${row.city})`);
  }

} catch (error) {
  console.error("Error:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
