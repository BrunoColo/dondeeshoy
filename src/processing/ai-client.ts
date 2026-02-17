import OpenAI from "openai";
import type { EventType } from "@/types/events";

let client: OpenAI | null = null;

const ALLOWED_EVENT_TYPES: EventType[] = [
  "fiesta",
  "baile",
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
];

export interface AiClassificationResult {
  eventType: EventType;
  musicGenre: string | null;
  confidence: number;
}

export function getOpenAIClient(): OpenAI {
  if (client) {
    return client;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está configurada");
  }

  client = new OpenAI({ apiKey });
  return client;
}

export async function classifyEventWithAi(input: {
  name: string;
  description: string | null;
  venueName: string;
  fallbackType: EventType;
}): Promise<AiClassificationResult | null> {
  try {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 120,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content:
            "Sos un clasificador de eventos sociales en Uruguay. Respondé JSON puro con campos: eventType, musicGenre, confidence. eventType debe ser uno de esta lista exacta: fiesta, baile, festival, concierto, recital, cultural, deportivo, gastronomico, familiar, feria, taller, club, bar, teatro, otro. 'baile' es para eventos de boliche/nightclub/dance que arrancan tarde en la noche (23h+). musicGenre puede ser null. confidence debe ser un número entre 0 y 1.",
        },
        {
          role: "user",
          content: [
            `Nombre: ${input.name}`,
            `Descripción: ${input.description ?? ""}`,
            `Venue: ${input.venueName}`,
            `Si no estás seguro, usá fallbackType=${input.fallbackType}`,
          ].join("\n"),
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      eventType?: string;
      musicGenre?: string | null;
      confidence?: number;
    };

    const eventType = (parsed.eventType ?? input.fallbackType) as EventType;
    if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
      return null;
    }

    const confidenceRaw = typeof parsed.confidence === "number" ? parsed.confidence : 0.6;
    const confidence = Math.max(0, Math.min(1, confidenceRaw));

    return {
      eventType,
      musicGenre: typeof parsed.musicGenre === "string" && parsed.musicGenre.trim() ? parsed.musicGenre.trim() : null,
      confidence,
    };
  } catch {
    return null;
  }
}
