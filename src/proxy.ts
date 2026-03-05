import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") ?? "";

  // Block obvious scraping bots on public events API
  if (pathname.startsWith("/api/events")) {
    if (!ua || BLOCKED_UA_PATTERNS.some((p) => p.test(ua))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Admin pages auth guard
  if (pathname.startsWith("/admin")) {
    // Allow the login page and API routes (they handle their own auth)
    if (
      pathname === "/admin/login" ||
      pathname.startsWith("/api/admin")
    ) {
      return NextResponse.next();
    }

    // Check for admin session cookie
    const adminSession = request.cookies.get("admin_session");
    if (!adminSession?.value) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Add noindex header to all admin pages
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
