import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { getClientIp } from "@/lib/rate-limit";
import {
  createSubscriber,
  findSubscriberByEmail,
} from "@/lib/subscription-queries";
import { sendVerificationEmail } from "@/lib/subscription-emails";

const subscriptionRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
  prefix: "rl:subscribe",
});

const subscribeSchema = z.object({
  email: z.string().email("Email inválido").max(255),
  name: z.string().max(255).optional(),
  departments: z.array(z.string().max(100)).max(19).optional(),
  eventTypes: z.array(z.string().max(50)).max(14).optional(),
  frequency: z.enum(["weekly", "daily"]).default("weekly"),
});

export async function POST(request: Request) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const { success, limit, remaining, reset } =
      await subscriptionRateLimit.limit(ip);

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
        },
      );
    }

    // Parse body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Body inválido" },
        { status: 400 },
      );
    }

    // Validate
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }

    const data = parsed.data;
    const email = data.email.toLowerCase().trim();

    // Check existing
    const existing = await findSubscriberByEmail(email);
    if (existing) {
      if (existing.verified) {
        return NextResponse.json(
          { error: "Este email ya está suscripto." },
          { status: 409 },
        );
      }
      // Re-send verification — but don't leak that it exists
      try {
        await sendVerificationEmail(email, existing.verificationToken);
      } catch {
        // Swallow email errors — don't block the response
      }
      return NextResponse.json(
        { message: "Te enviamos un email de verificación. Revisá tu bandeja de entrada." },
        { status: 200 },
      );
    }

    // Create
    const verificationToken = randomUUID();
    const unsubscribeToken = randomUUID();

    await createSubscriber({
      email,
      name: data.name || null,
      departments: data.departments && data.departments.length > 0 ? data.departments : null,
      eventTypes: data.eventTypes && data.eventTypes.length > 0 ? data.eventTypes : null,
      frequency: data.frequency,
      verified: false,
      verificationToken,
      unsubscribeToken,
    });

    // Send verification email (non-blocking)
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (err) {
      console.error("[subscribe] Failed to send verification email:", err);
    }

    return NextResponse.json(
      { message: "Te enviamos un email de verificación. Revisá tu bandeja de entrada." },
      { status: 201 },
    );
  } catch (err) {
    console.error("[subscribe] Error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
