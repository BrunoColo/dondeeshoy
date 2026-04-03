import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { verifyAdminToken } from "@/lib/admin-token";

const BLOCKED_UA_PATTERNS = [
  /curl\//i,
  /python-requests/i,
  /scrapy/i,
  /wget\//i,
  /httpie/i,
  /Go-http-client/i,
  /java\//i,
  /libwww-perl/i,
  /php\//i,
];

const TRACKING_PARAM_NAMES = new Set([
  "gclid",
  "dclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "igshid",
  "_ga",
  "_gl",
]);

const CANONICAL_HOST = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dondeeshoy.com").host.toLowerCase();

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

function shouldNoindexByHost(request: NextRequest): boolean {
  const hostHeader = request.headers.get("host");
  if (!hostHeader) return false;

  const requestHost = hostHeader.toLowerCase().split(":")[0];

  if (requestHost === CANONICAL_HOST) return false;
  if (requestHost === "localhost" || requestHost === "127.0.0.1") return false;

  return true;
}

function getTrackingCleanUrl(request: NextRequest): URL | null {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }

  const { pathname } = request.nextUrl;
  if (
    matchesPathPrefix(pathname, "/admin")
    || matchesPathPrefix(pathname, "/api")
    || matchesPathPrefix(pathname, "/internal-admin-access")
    || matchesPathPrefix(pathname, "/ingreso-admin")
  ) {
    return null;
  }

  const url = new URL(request.url);
  let changed = false;

  for (const key of Array.from(url.searchParams.keys())) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith("utm_") || TRACKING_PARAM_NAMES.has(normalizedKey)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  return changed ? url : null;
}

function getAllowedAdminIps(): string[] {
  return (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAllowedAdminIp(ip: string, allowedIps: string[]): boolean {
  if (!ip || allowedIps.length === 0) {
    return false;
  }

  return allowedIps.some((allowedIp) => {
    if (allowedIp.endsWith("*")) {
      return ip.startsWith(allowedIp.slice(0, -1));
    }

    return ip === allowedIp;
  });
}

async function hasValidAdminToken(request: NextRequest, cookieName: string, expectedType: "admin-session" | "admin-access") {
  const adminSecret = process.env.ADMIN_SECRET;
  const token = request.cookies.get(cookieName)?.value;

  if (!adminSecret || !token) {
    return false;
  }

  return (await verifyAdminToken(token, adminSecret, expectedType)) !== null;
}

function notFoundResponse(isApiRequest: boolean): NextResponse {
  if (isApiRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") ?? "";
  const isAdminPage = matchesPathPrefix(pathname, "/admin");
  const isAdminApi = matchesPathPrefix(pathname, "/api/admin");

  const trackingCleanUrl = getTrackingCleanUrl(request);
  if (trackingCleanUrl) {
    return NextResponse.redirect(trackingCleanUrl, 308);
  }

  // Block obvious scraping bots on public events API
  if (pathname.startsWith("/api/events")) {
    if (!ua || BLOCKED_UA_PATTERNS.some((p) => p.test(ua))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Admin surface hardening
  if (isAdminPage || isAdminApi) {
    const allowedIps = getAllowedAdminIps();
    const clientIp = getClientIp(request);
    const ipAllowed = isAllowedAdminIp(clientIp, allowedIps);
    const hasValidSession = await hasValidAdminToken(request, "admin_session", "admin-session");
    const hasValidAccess = await hasValidAdminToken(request, "admin_access", "admin-access");
    const requiresStealthGate = allowedIps.length > 0 || Boolean(process.env.ADMIN_ACCESS_KEY);

    if (requiresStealthGate && !ipAllowed && !hasValidSession && !hasValidAccess) {
      return notFoundResponse(isAdminApi);
    }

    if (isAdminPage && pathname !== "/admin/login" && !hasValidSession) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const response = NextResponse.next();

  if (shouldNoindexByHost(request)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
