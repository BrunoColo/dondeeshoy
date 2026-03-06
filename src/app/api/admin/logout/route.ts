import { NextRequest, NextResponse } from "next/server";
import { deleteAdminAccessCookie, deleteAdminCookie } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    await deleteAdminCookie();
    await deleteAdminAccessCookie();
    return NextResponse.redirect(new URL("/admin/login", request.nextUrl.origin));
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.redirect(new URL("/admin/login", request.nextUrl.origin));
  }
}
