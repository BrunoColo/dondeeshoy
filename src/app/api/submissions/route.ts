import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { eventSubmissions } from "@/lib/db/schema";
import { getClientIp } from "@/lib/rate-limit";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { notifyNewSubmission } from "@/lib/email";

// Stricter rate limit for submissions: 5 per hour per IP
const submissionRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
  prefix: "rl:submissions",
});

const EVENT_TYPES = [
  "fiesta", "festival", "concierto", "recital", "cultural",
  "deportivo", "gastronomico", "familiar", "feria", "taller",
  "club", "bar", "teatro", "otro",
] as const;

const submissionSchema = z.object({
  // Event
  eventName: z.string().min(3).max(255),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  eventTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  eventType: z.enum(EVENT_TYPES),
  description: z.string().min(10).max(500),
  // Venue
  venueName: z.string().min(2).max(255),
  venueAddress: z.string().min(5).max(512),
  city: z.string().min(2).max(100),
  // Tickets
  isFree: z.boolean(),
  priceRange: z.string().max(100).optional().or(z.literal("")),
  ticketUrl: z.string().url().optional().or(z.literal("")),
  // Media
  imageUrl: z.string().url().optional().or(z.literal("")),
  // Contact
  contactName: z.string().min(2).max(255),
  contactEmail: z.string().email(),
});

export async function POST(request: Request) {
  // Rate limit
  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await submissionRateLimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intentá de nuevo más tarde." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Validate
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  // Honeypot check — if the hidden field is filled, it's a bot
  const bodyObj = body as Record<string, unknown>;
  if (bodyObj.website && String(bodyObj.website).length > 0) {
    // Silently accept to avoid tipping off bots
    return NextResponse.json({ success: true, id: "ok" });
  }

  const data = parsed.data;

  // Insert into DB
  const [inserted] = await db
    .insert(eventSubmissions)
    .values({
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      eventName: data.eventName,
      eventDate: data.eventDate,
      eventTime: data.eventTime || null,
      eventType: data.eventType,
      description: data.description,
      venueName: data.venueName,
      venueAddress: data.venueAddress,
      city: data.city,
      isFree: data.isFree,
      priceRange: data.priceRange || null,
      ticketUrl: data.ticketUrl || null,
      imageUrl: data.imageUrl || null,
    })
    .returning();

  // Send email notification (non-blocking — don't fail the request if email fails)
  try {
    await notifyNewSubmission(inserted);
  } catch (err) {
    console.error("[submissions] Email notification failed:", err);
  }

  return NextResponse.json({ id: inserted.id }, { status: 201 });
}
