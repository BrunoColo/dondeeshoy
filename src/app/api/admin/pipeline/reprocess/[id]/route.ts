import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { verifyCookie } from "@/lib/admin-auth";
import { reprocessRawEvent } from "@/processing/pipeline";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const isAuthenticated = await verifyCookie();

  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const result = await reprocessRawEvent(id);

    revalidatePath("/");
    revalidatePath("/proximos");
    revalidatePath("/mapa");
    revalidatePath("/admin/pipeline");

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Pipeline reprocess error:", error);
    return NextResponse.json({ error: "Failed to reprocess raw event" }, { status: 500 });
  }
}