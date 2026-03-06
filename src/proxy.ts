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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
