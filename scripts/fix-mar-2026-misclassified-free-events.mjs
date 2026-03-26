import "dotenv/config";
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

const RULES = [
  {
    pattern: "danza.*oro.*carb[oó]n",
    suggestedType: "cultural",
    reason: "Danza escénica/cultural, no nightlife",
  },
  {
    pattern: "s[áa]bados?\\s+de\\s+rock",
    suggestedType: "concierto",
    reason: "Evento musical de rock",
  },
  {
    pattern: "la\\s+trova\\s+vuelve\\s+a\\s+latir\\s+en\\s+uruguay",
    suggestedType: "concierto",
    reason: "Evento musical / trova",
  },
  {
    pattern: "meet\\s*(?:&|and)\\s*drink",
    suggestedType: "bar",
    reason: "Evento social de bar",
  },
  {
    pattern: "cena\\s+show",
    suggestedType: "bar",
    reason: "Cena show en pub/bar",
  },
];

try {
  const candidates = [];

  for (const rule of RULES) {
    const rows = await sql`
      SELECT
        id,
        name,
        venue_name,
        city,
        start_time,
        event_type,
        is_free
      FROM events
      WHERE status = 'active'
        AND event_type = 'fiesta'
        AND lower(name) ~ ${rule.pattern}
      ORDER BY name ASC
    `;

    for (const row of rows) {
      candidates.push({
        ...row,
        suggestedType: rule.suggestedType,
        reason: rule.reason,
      });
    }
  }

  const dedupedMap = new Map();
  for (const row of candidates) {
    if (!dedupedMap.has(row.id)) {
      dedupedMap.set(row.id, row);
    }
  }

  const deduped = [...dedupedMap.values()];

  console.log(`\nCandidatos detectados: ${deduped.length}`);
  for (const row of deduped) {
    console.log(`- [${row.suggestedType}] ${row.name} @ ${row.venue_name ?? "(sin venue)"}`);
    console.log(`  motivo: ${row.reason} | ciudad: ${row.city ?? "(sin ciudad)"} | hora: ${row.start_time ?? "(sin hora)"}`);
  }

  const byType = deduped.reduce(
    (acc, row) => {
      if (row.suggestedType === "cultural") acc.cultural += 1;
      if (row.suggestedType === "concierto") acc.concierto += 1;
      if (row.suggestedType === "bar") acc.bar += 1;
      return acc;
    },
    { cultural: 0, concierto: 0, bar: 0 },
  );

  console.log("\nResumen:");
  console.log(`- cultural: ${byType.cultural}`);
  console.log(`- concierto: ${byType.concierto}`);
  console.log(`- bar: ${byType.bar}`);
  console.log(`- total a actualizar: ${deduped.length}`);

  if (!APPLY) {
    console.log("\nDry-run por defecto. Para aplicar cambios ejecutá: node scripts/fix-mar-2026-misclassified-free-events.mjs --apply");
    process.exit(0);
  }

  let updated = 0;

  await sql.begin(async (trx) => {
    for (const row of deduped) {
      const result = await trx`
        UPDATE events
        SET event_type = ${row.suggestedType},
            updated_at = now()
        WHERE id = ${row.id}
          AND status = 'active'
          AND event_type = 'fiesta'
        RETURNING id
      `;

      updated += result.length;
    }
  });

  console.log(`\n✅ Cambios aplicados: ${updated}`);
} catch (error) {
  console.error("Error en fix-mar-2026-misclassified-free-events:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
