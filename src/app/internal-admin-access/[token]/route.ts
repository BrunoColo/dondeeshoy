import { NextRequest, NextResponse } from "next/server";

import { createAccessToken } from "@/lib/admin-auth";

const ACCESS_COOKIE_NAME = "admin_access";
const ACCESS_MAX_AGE = 60 * 60 * 12;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const adminAccessKey = process.env.ADMIN_ACCESS_KEY;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminAccessKey || !adminSecret || token !== adminAccessKey) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  const accessToken = await createAccessToken(adminSecret);
  const response = NextResponse.redirect(new URL("/admin/login", _request.url));

  response.cookies.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ACCESS_MAX_AGE,
    path: "/",
  });

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  return response;
}