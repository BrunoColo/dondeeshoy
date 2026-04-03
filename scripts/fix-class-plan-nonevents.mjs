import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const APPLY = process.argv.includes("--apply");

function normalizeBanName(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const client = await pool.connect();

  try {
    console.log(`=== Class-plan non-event cleanup (${APPLY ? "APPLY" : "DRY RUN"}) ===`);

    const eventRows = await client.query(`
      SELECT
        e.id,
        e.name,
        e.description,
        e.date,
        e.start_time,
        e.venue_name
      FROM events e
      WHERE e.status = 'active'
        AND (
          lower(e.name) ~ 'clases?\\s+por\\s+semana'
          OR lower(coalesce(e.description, '')) ~ 'clases?\\s+por\\s+semana'
          OR lower(e.name) ~ 'clases?\\s+(regulares?|semanales?|permanentes?)'
          OR lower(coalesce(e.description, '')) ~ 'clases?\\s+(regulares?|semanales?|permanentes?)'
        )
      ORDER BY e.date, e.start_time NULLS FIRST, e.name;
    `);

    if (eventRows.rows.length === 0) {
      console.log("✅ No se encontraron eventos activos con patrón de clases semanales.");
      return;
    }

    console.log(`Encontrados ${eventRows.rows.length} eventos activos con patrón de no-evento:`);
    for (const row of eventRows.rows) {
      console.log(`- ${String(row.date).slice(0, 10)} ${row.start_time ?? "(sin hora)"} | ${row.name} | ${row.id}`);
    }

    const eventIds = eventRows.rows.map((row) => row.id);

    const sourceRows = await client.query(
      `
        SELECT
          es.event_id,
          es.source,
          re.source_id
        FROM event_sources es
        JOIN raw_events re ON re.id = es.raw_event_id
        WHERE es.event_id = ANY($1::uuid[])
      `,
      [eventIds],
    );

    const sourceMap = new Map();
    for (const row of sourceRows.rows) {
      const current = sourceMap.get(row.event_id) ?? [];
      current.push({ source: row.source, sourceId: row.source_id });
      sourceMap.set(row.event_id, current);
    }

    console.log(`\nSource links detectados: ${sourceRows.rows.length}`);

    if (!APPLY) {
      console.log("\nDry-run finalizado. Ejecutá con --apply para aplicar cambios.");
      return;
    }

    let updatedEvents = 0;
    let insertedBans = 0;

    for (const row of eventRows.rows) {
      const updateResult = await client.query(
        `
          UPDATE events
          SET status = 'past', updated_at = NOW()
          WHERE id = $1
            AND status = 'active'
          RETURNING id
        `,
        [row.id],
      );

      updatedEvents += updateResult.rowCount ?? 0;

      const sourceLinks = sourceMap.get(row.id) ?? [];
      const normalizedName = normalizeBanName(row.name);

      for (const link of sourceLinks) {
        const existing = await client.query(
          `
            SELECT 1
            FROM banned_events
            WHERE source = $1
              AND source_id = $2
            LIMIT 1
          `,
          [link.source, link.sourceId],
        );

        if (existing.rowCount && existing.rowCount > 0) {
          continue;
        }

        await client.query(
          `
            INSERT INTO banned_events (normalized_name, original_name, source, source_id, reason)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            normalizedName,
            row.name,
            link.source,
            link.sourceId,
            "Auto-ban non-event: plan de clases semanales",
          ],
        );

        insertedBans += 1;
      }
    }

    console.log("\n=== RESUMEN ===");
    console.log(`Eventos marcados como past: ${updatedEvents}`);
    console.log(`Bans exactos source+sourceId insertados: ${insertedBans}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
