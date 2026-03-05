import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { emailSubscribers } from "@/lib/db/schema/subscribers";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Basic UUID validation
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const result = await db
      .delete(emailSubscribers)
      .where(eq(emailSubscribers.id, id))
      .returning({ id: emailSubscribers.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    return NextResponse.json({ error: "Failed to delete subscriber" }, { status: 500 });
  }
}
