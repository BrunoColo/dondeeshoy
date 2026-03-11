import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyCookie } from "@/lib/admin-auth";
import {
  getWeekendHighlightEditorState,
  saveWeekendHighlightManualSlugs,
} from "@/lib/weekend-highlights-store";

const payloadSchema = z.object({
  manualSlugs: z.array(z.string().trim().min(1).max(255)).max(12),
});

export async function GET() {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const state = await getWeekendHighlightEditorState();
    return NextResponse.json(state);
  } catch (error) {
    console.error("Error fetching weekend highlights config:", error);
    return NextResponse.json({ error: "Failed to fetch weekend highlights config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await saveWeekendHighlightManualSlugs(parsed.data.manualSlugs);
    const state = await getWeekendHighlightEditorState();

    return NextResponse.json(state);
  } catch (error) {
    console.error("Error saving weekend highlights config:", error);
    return NextResponse.json({ error: "Failed to save weekend highlights config" }, { status: 500 });
  }
}