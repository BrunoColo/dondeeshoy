import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { createToken, setAdminCookie } from "@/lib/admin-auth";
import { redis } from "@/lib/redis";
import { getClientIp } from "@/lib/rate-limit";

const adminLoginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "rl:admin-login",
});

function secureStringEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success, limit, remaining, reset } = await adminLoginRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intentá nuevamente más tarde." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const body = await request.json();
    const { password } = body;

    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminSecret = process.env.ADMIN_SECRET;

    // Validate environment variables
    if (!adminPassword || !adminSecret) {
      console.error("Admin credentials not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Validate password
    if (typeof password !== "string" || !secureStringEquals(password, adminPassword)) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Create and set the admin session cookie
    const token = createToken(adminSecret);
    await setAdminCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
