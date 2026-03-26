import "dotenv/config";
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definido.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

const WELLNESS_PATTERN =
  "(meditaci[oó]n|terapia|terap[ée]utic[oa]|yoga|breathwork|respiraci[oó]n[[:space:]]+consciente|sound[[:space:]]*healing|ba[ñn]o[[:space:]]+de[[:space:]]+sonido|chakra|wellness|bienestar|mindfulness|autoconocimiento)";

const COFFEE_PARTY_PATTERN =
  "(coffee[[:space:]]*party|party[[:space:]]*de[[:space:]]*(caf[eé]|coffee)|caf[eé][[:space:]]*party)";

const NIGHTLIFE_PATTERN =
  "(dj|reggaeton|reggeaton|reguet[oó]n|techno|house|electro|boliche|nightclub|nightlife|after[[:space:]]*party|open[[:space:]]*bar|perreo|cumbia|guaracha|discoteca|pista[[:space:]]*de[[:space:]]*baile)";

const POETRY_PATTERN =
  "(po[eé]tic[[:alnum:]_]*|poetry[[:space:]]*slam|batalla[[:space:]]+po[eé]tic[[:alnum:]_]*|batalla[[:space:]]+de[[:space:]]+poetas?|mic[[:space:]]+abierto)";

const SWEET_TABLE_PATTERN =
  "(mesa[[:space:]]+dulce|pasteler[ií]a|reposter[ií]a)";

const WATCH_PARTY_PATTERN =
  "(watch[[:space:]]*party)";

const MILONGA_PATTERN =
  "(milonga|tango)";

const SPORTS_PATTERN =
  "(partido|f[uú]tbol|basket|basquet|selecci[oó]n|vs|versus|copa|liga|champions|libertadores|sudamericana)";

const CANDIDATES_QUERY = `
  WITH base AS (
    SELECT
      e.id,
      e.name,
      e.venue_name,
      e.city,
      e.start_time,
      lower(concat_ws(' ',
        e.name,
        coalesce(e.description, ''),
        coalesce((
          SELECT string_agg(
            concat_ws(' ',
              coalesce(r.raw_data->>'title', ''),
              coalesce(r.raw_data->>'description', ''),
              coalesce(r.raw_data->>'dateText', ''),
              coalesce(r.raw_data->>'category', '')
            ),
            ' '
          )
          FROM event_sources es
          JOIN raw_events r ON r.id = es.raw_event_id
          WHERE es.event_id = e.id
        ), '')
      )) AS text_blob
    FROM events e
    WHERE e.status = 'active'
      AND e.event_type = 'fiesta'
  )
  SELECT
    b.id,
    b.name,
    b.venue_name,
    b.city,
    b.start_time,
    CASE
      WHEN b.text_blob ~* $1 THEN 'taller'
      WHEN b.text_blob ~* $4 THEN 'cultural'
      WHEN b.text_blob ~* $5 THEN 'gastronomico'
      WHEN b.text_blob ~* $6 THEN 'cultural'
      WHEN b.text_blob ~* $7 THEN 'cultural'
      WHEN b.text_blob ~* $2
        AND b.text_blob !~* $3
        AND (
          b.start_time IS NULL
          OR (
            b.start_time::time >= time '06:00:00'
            AND b.start_time::time < time '22:59:00'
          )
        )
      THEN 'bar'
      WHEN b.text_blob ~* $8
        AND b.text_blob !~* $3
        AND b.text_blob !~* $9
      THEN 'cultural'
      ELSE NULL
    END AS suggested_type,
    CASE
      WHEN b.text_blob ~* $1 THEN 'wellness/terapia detectado'
      WHEN b.text_blob ~* $4 THEN 'poesía / batalla poética detectada'
      WHEN b.text_blob ~* $5 THEN 'mesa dulce / pastelería detectada'
      WHEN b.text_blob ~* $6 THEN 'watch party detectada'
      WHEN b.text_blob ~* $7 THEN 'milonga/tango detectado'
      WHEN b.text_blob ~* $2 AND b.text_blob !~* $3 THEN 'coffee party diurna sin señales nightlife'
      WHEN b.text_blob ~* $2 AND b.text_blob ~* $3 THEN 'coffee party con señales nightlife (no se toca)'
      WHEN b.text_blob ~* $8 AND b.text_blob ~* $9 THEN 'watch party deportiva (no se toca)'
      WHEN b.text_blob ~* $8 AND b.text_blob ~* $3 THEN 'watch party nightlife (no se toca)'
      ELSE NULL
    END AS reason
  FROM base b
  WHERE
    b.text_blob ~* $1
    OR b.text_blob ~* $2
    OR b.text_blob ~* $4
    OR b.text_blob ~* $5
    OR b.text_blob ~* $6
    OR b.text_blob ~* $7
    OR b.text_blob ~* $8
  ORDER BY b.name ASC
`;

function logRows(title, rows) {
  console.log(`\n${title}: ${rows.length}`);
  for (const row of rows.slice(0, 200)) {
    console.log(`- [${row.suggested_type ?? "skip"}] ${row.name} @ ${row.venue_name ?? "(sin venue)"} (${row.city ?? "(sin ciudad)"})`);
    console.log(`  motivo: ${row.reason ?? "(sin motivo)"} | hora: ${row.start_time ?? "(sin hora)"}`);
  }
  if (rows.length > 200) {
    console.log(`... y ${rows.length - 200} más`);
  }
}

try {
  const rows = await sql.unsafe(CANDIDATES_QUERY, [
    WELLNESS_PATTERN,
    COFFEE_PARTY_PATTERN,
    NIGHTLIFE_PATTERN,
    POETRY_PATTERN,
    SWEET_TABLE_PATTERN,
    WATCH_PARTY_PATTERN,
    MILONGA_PATTERN,
    WATCH_PARTY_PATTERN,
    SPORTS_PATTERN,
  ]);

  const toUpdate = rows.filter((row) =>
    row.suggested_type === "taller" ||
    row.suggested_type === "bar" ||
    row.suggested_type === "cultural" ||
    row.suggested_type === "gastronomico",
  );
  const skipped = rows.filter((row) => !row.suggested_type);

  logRows("Candidatos a reclasificar", toUpdate);
  if (skipped.length > 0) {
    logRows("Detectados pero sin cambios", skipped);
  }

  const byType = toUpdate.reduce(
    (acc, row) => {
      if (row.suggested_type === "taller") acc.taller += 1;
      if (row.suggested_type === "bar") acc.bar += 1;
      if (row.suggested_type === "cultural") acc.cultural += 1;
      if (row.suggested_type === "gastronomico") acc.gastronomico += 1;
      return acc;
    },
    { taller: 0, bar: 0, cultural: 0, gastronomico: 0 },
  );

  console.log("\nResumen:");
  console.log(`- taller: ${byType.taller}`);
  console.log(`- bar: ${byType.bar}`);
  console.log(`- cultural: ${byType.cultural}`);
  console.log(`- gastronomico: ${byType.gastronomico}`);
  console.log(`- total a actualizar: ${toUpdate.length}`);

  if (!APPLY) {
    console.log("\nDry-run por defecto. Para aplicar cambios ejecutá: node scripts/fix-non-nightlife-fiesta.mjs --apply");
    process.exit(0);
  }

  let updated = 0;
  await sql.begin(async (trx) => {
    for (const row of toUpdate) {
      const result = await trx`
        UPDATE events
        SET event_type = ${row.suggested_type},
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
  console.error("Error en fix-non-nightlife-fiesta:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
