import "dotenv/config";
import pg from "pg";
import OpenAI from "openai";

const { Pool } = pg;

const ALLOWED_EVENT_TYPES = new Set([
  "fiesta",
  "festival",
  "concierto",
  "recital",
  "cultural",
  "deportivo",
  "gastronomico",
  "familiar",
  "feria",
  "taller",
  "club",
  "bar",
  "teatro",
  "otro",
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function classifyWithAi(client, event) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 120,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "Sos un clasificador de eventos sociales en Uruguay.",
          "Respondé JSON puro con campos: eventType, musicGenre, confidence.",
          "eventType válido: fiesta, festival, concierto, recital, cultural, deportivo, gastronomico, familiar, feria, taller, club, bar, teatro, otro.",
          "Reglas: deportivo incluye carrera/trail/mtb/triatlón/travesía a nado; fiesta incluye line-up de DJs y eventos nocturnos tardíos.",
          "Usá 'otro' solo cuando no encaje claramente.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Nombre: ${event.name}`,
          `Descripción: ${event.description ?? ""}`,
          `Venue: ${event.venue_name}`,
          "Responder solo JSON.",
        ].join("\n"),
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const eventType = typeof parsed.eventType === "string" ? parsed.eventType : "otro";
  const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
  const musicGenre = typeof parsed.musicGenre === "string" && parsed.musicGenre.trim() ? parsed.musicGenre.trim() : null;

  if (!ALLOWED_EVENT_TYPES.has(eventType)) return null;

  return {
    eventType,
    confidence: Math.max(0, Math.min(1, confidence)),
    musicGenre,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada en .env");
  }

  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY no está configurada en .env");
  }

  const aiClient = new OpenAI({ apiKey: openAiKey });

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const db = await pool.connect();

  try {
    const { rows } = await db.query(
      `
        SELECT id, name, description, venue_name, event_type
        FROM events
        WHERE status = 'active' AND event_type = 'otro'
        ORDER BY created_at DESC
      `,
    );

    console.log(`[reclassify-otros] candidatos: ${rows.length}`);

    let reviewed = 0;
    let updated = 0;

    for (const row of rows) {
      reviewed += 1;

      const ai = await classifyWithAi(aiClient, row);
      if (!ai) {
        console.log(`[reclassify-otros] ${row.name}: sin respuesta válida IA`);
        await sleep(700);
        continue;
      }

      if (ai.eventType === "otro" || ai.confidence < 0.7) {
        console.log(`[reclassify-otros] ${row.name}: se mantiene 'otro' (${ai.confidence.toFixed(2)})`);
        await sleep(700);
        continue;
      }

      await db.query(
        `
          UPDATE events
          SET event_type = $1,
              music_genre = COALESCE($2, music_genre),
              confidence_score = $3,
              updated_at = NOW()
          WHERE id = $4
        `,
        [ai.eventType, ai.musicGenre, ai.confidence.toFixed(2), row.id],
      );

      updated += 1;
      console.log(
        `[reclassify-otros] ${row.name}: otro -> ${ai.eventType} (${ai.confidence.toFixed(2)})`,
      );

      await sleep(700);
    }

    console.log(`[reclassify-otros] revisados=${reviewed} actualizados=${updated}`);
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[reclassify-otros] error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
