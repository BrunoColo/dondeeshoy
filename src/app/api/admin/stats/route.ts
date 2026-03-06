import { NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { getAdminDashboardSnapshot } from "@/lib/admin-queries";

export async function GET() {
  // Verify admin session
  const isAuthenticated = await verifyCookie();
  
  if (!isAuthenticated) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { stats, dailyCounts } = await getAdminDashboardSnapshot();

    return NextResponse.json({
      stats,
      dailyCounts,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
