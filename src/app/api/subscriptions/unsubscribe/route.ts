import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/subscription-queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=invalid-token", request.url));
  }

  const removed = await unsubscribeByToken(token);

  if (removed) {
    return NextResponse.redirect(
      new URL("/suscribirse?unsubscribed=true", request.url),
    );
  }

  return NextResponse.redirect(
    new URL("/suscribirse?unsubscribed=not-found", request.url),
  );
}
