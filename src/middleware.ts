import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
