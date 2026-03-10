import { NextRequest, NextResponse } from "next/server";
import { verifyCookie } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { emailSubscribers } from "@/lib/db/schema/subscribers";
import { desc, sql, ilike, eq } from "drizzle-orm";
import { escapeLikePattern } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const offset = (page - 1) * limit;

  try {
    const whereClause = search
      ? ilike(emailSubscribers.email, `%${escapeLikePattern(search)}%`)
      : undefined;

    const [subscribers, [{ count }]] = await Promise.all([
      db
        .select()
        .from(emailSubscribers)
        .where(whereClause)
        .orderBy(desc(emailSubscribers.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailSubscribers)
        .where(whereClause),
    ]);

    // Stats (only on first page without search — avoids extra queries on paginate)
    let stats = null;
    if (page === 1 && !search) {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(emailSubscribers);
      const [{ verified }] = await db
        .select({ verified: sql<number>`count(*)::int` })
        .from(emailSubscribers)
        .where(eq(emailSubscribers.verified, true));
      const [{ daily }] = await db
        .select({ daily: sql<number>`count(*)::int` })
        .from(emailSubscribers)
        .where(eq(emailSubscribers.frequency, "daily"));

      stats = { total, verified, unverified: total - verified, daily, weekly: total - daily };
    }

    return NextResponse.json({
      subscribers,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
      stats,
    });
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    return NextResponse.json({ error: "Failed to fetch subscribers" }, { status: 500 });
  }
}
