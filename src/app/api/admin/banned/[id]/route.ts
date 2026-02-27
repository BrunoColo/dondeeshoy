import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { unbanEvent } from "@/lib/admin-queries";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await unbanEvent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unbanning event:", error);
    return NextResponse.json({ error: "Failed to unban event" }, { status: 500 });
  }
}
