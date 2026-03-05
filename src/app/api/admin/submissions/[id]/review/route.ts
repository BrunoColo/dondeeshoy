import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { approveSubmission, rejectSubmission, getSubmissionById } from "@/lib/admin-queries";
import { verifyCookie } from "@/lib/admin-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify admin session
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, notes } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    if (action === "approve") {
      const submission = await getSubmissionById(id);
      if (!submission) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }

      await approveSubmission(id, notes);
      revalidatePath("/");
      revalidatePath("/proximos");
      revalidatePath("/mapa");
      return NextResponse.json({ success: true });
    } else {
      await rejectSubmission(id, notes);
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Error processing submission:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process submission" },
      { status: 500 }
    );
  }
}
