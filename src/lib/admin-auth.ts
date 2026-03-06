import { cookies } from "next/headers";

import { createAdminTokenPayload, signAdminToken, verifyAdminToken } from "./admin-token";

const SESSION_COOKIE_NAME = "admin_session";
const ACCESS_COOKIE_NAME = "admin_access";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const ACCESS_MAX_AGE = 60 * 60 * 12;

/**
 * Create a signed admin session token
 */
export async function createSessionToken(secret: string): Promise<string> {
  return signAdminToken(secret, createAdminTokenPayload("admin-session", SESSION_MAX_AGE));
}

/**
 * Create a short-lived admin access token used to reveal the login screen.
 */
export async function createAccessToken(secret: string): Promise<string> {
  return signAdminToken(secret, createAdminTokenPayload("admin-access", ACCESS_MAX_AGE));
}

/**
 * Get the admin session cookie value
 */
export async function getAdminCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Get the admin access cookie value
 */
export async function getAdminAccessCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE_NAME)?.value;
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

  const payload = await verifyAdminToken(token, secret, "admin-session");
  return payload?.sub === "admin";
}

/**
 * Verify if the current request has a valid admin access cookie.
 */
export async function verifyAdminAccessCookie(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return false;
  }

  const token = await getAdminAccessCookie();
  if (!token) {
    return false;
  }

  const payload = await verifyAdminToken(token, secret, "admin-access");
  return payload?.sub === "admin";
}

/**
 * Set the admin session cookie (should be called after successful login)
 */
export async function setAdminCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Set the admin access cookie.
 */
export async function setAdminAccessCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ACCESS_MAX_AGE,
    path: "/",
  });
}

/**
 * Delete the admin session cookie
 */
export async function deleteAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Delete the admin access cookie
 */
export async function deleteAdminAccessCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
}
