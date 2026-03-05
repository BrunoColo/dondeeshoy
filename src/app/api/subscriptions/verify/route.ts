import { NextResponse } from "next/server";
import { verifySubscriber } from "@/lib/subscription-queries";
import { sendSubscriptionConfirmedEmail } from "@/lib/subscription-emails";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=invalid-token", request.url));
  }

  const verifiedSubscriber = await verifySubscriber(token);

  if (verifiedSubscriber) {
    try {
      await sendSubscriptionConfirmedEmail(
        verifiedSubscriber.email,
        verifiedSubscriber.name,
        verifiedSubscriber.frequency,
        verifiedSubscriber.unsubscribeToken,
      );
    } catch (error) {
      console.error("[subscriptions/verify] Failed to send confirmed email:", error);
    }

    return NextResponse.redirect(
      new URL("/suscribirse?verified=true", request.url),
    );
  }

  // Token not found or already verified
  return NextResponse.redirect(
    new URL("/suscribirse?verified=already", request.url),
  );
}
