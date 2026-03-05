import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";

/**
 * Create a signed HMAC token for admin session
 */
export function createToken(secret: string, payload: string = "admin"): string {
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const token = Buffer.from(JSON.stringify({ payload, signature })).toString("base64");
  return token;
}

/**
 * Verify a signed HMAC token
 * Returns the payload if valid, null otherwise
 */
export function verifyToken(token: string, secret: string): string | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    const expectedSignature = createHmac("sha256", secret)
      .update(decoded.payload)
      .digest("hex");

    const sigBuf = Buffer.from(decoded.signature, "utf8");
    const expBuf = Buffer.from(expectedSignature, "utf8");

    if (sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)) {
      return decoded.payload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the admin session cookie value
 */
export async function getAdminCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

/**
 * Verify if the current request has a valid admin session
 */
export async function verifyCookie(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error("ADMIN_SECRET not configured");
    return false;
  }

  const token = await getAdminCookie();
  if (!token) {
    return false;
  }

  const payload = verifyToken(token, secret);
  return payload === "admin";
}

/**
 * Set the admin session cookie (should be called after successful login)
 */
export async function setAdminCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

/**
 * Delete the admin session cookie
 */
export async function deleteAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
