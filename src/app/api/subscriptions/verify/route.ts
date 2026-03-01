import { NextResponse } from "next/server";
import { verifySubscriber } from "@/lib/subscription-queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=invalid-token", request.url));
  }

  const verified = await verifySubscriber(token);

  if (verified) {
    return NextResponse.redirect(
      new URL("/suscribirse?verified=true", request.url),
    );
  }

  // Token not found or already verified
  return NextResponse.redirect(
    new URL("/suscribirse?verified=already", request.url),
  );
}
