import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalizeStatus = (status: string | null | undefined) => {
  if (!status) return status;
  return status.toLowerCase();
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start") || undefined;
  const end = searchParams.get("end") || undefined;
  const includePending = searchParams.get("includePending") || undefined;
  const status = searchParams.get("status") || undefined;

  const db = getDb();
  const borrowedDateOnly = sql<string>`date(${schema.transactions.borrowedDate})`;

  let query = db
    .select({
      physicalBookId: schema.transactions.physicalBookId,
      userId: schema.transactions.userId,
      adminId: schema.transactions.adminId,
      status: schema.transactions.status,
      borrowedDate: schema.transactions.borrowedDate,
    })
    .from(schema.transactions)
    .orderBy(desc(schema.transactions.borrowedDate));

  const dateFilters = [
    start ? gte(borrowedDateOnly, start) : undefined,
    end ? lte(borrowedDateOnly, end) : undefined,
  ].filter(Boolean);

  if (dateFilters.length > 0) {
    query = query.where(and(...dateFilters));
  }

  let data: any[] = [];
  try {
    data = await query;
  } catch (error: any) {
    return NextResponse.json({ total: 0, topAdmins: [], topUsers: [], users: [] });
  }

  const normalizedStatus = status ? status.toLowerCase() : "";
  const filtered = (data || []).filter((t) => {
    const current = normalizeStatus(t.status);
    if (normalizedStatus && normalizedStatus !== "all") {
      return current === normalizedStatus;
    }
    if (includePending === "true") return true;
    return t.status !== "PENDING" && t.status !== "REJECTED";
  });

  const users = await db.select().from(schema.users);
  const usersMap = new Map<string, any>(users.map((u) => [u.clerkId, u]));

  const physicalIds = Array.from(
    new Set(filtered.map((t) => t.physicalBookId).filter(Boolean))
  ) as number[];

  const physicals = physicalIds.length
    ? await db
        .select()
        .from(schema.physicalBooks)
        .where(inArray(schema.physicalBooks.pid, physicalIds))
    : [];

  const bookIds = Array.from(new Set(physicals.map((p) => p.bookId))) as number[];
  const books = bookIds.length
    ? await db.select().from(schema.books).where(inArray(schema.books.id, bookIds))
    : [];

  const physicalMap = new Map<number, any>(physicals.map((p) => [p.pid, p]));
  const bookMap = new Map<number, any>(books.map((b) => [b.id, b]));

  const statusCounts = { borrowed: 0, returned: 0, pending: 0 };
  const trendMap = new Map<string, number>();
  const userCounts: Record<string, number> = {};
  const adminCounts: Record<string, number> = {};
  const genreCounts: Record<string, number> = {};

  filtered.forEach((t) => {
    const statusKey = normalizeStatus(t.status);
    if (statusKey === "borrowed") statusCounts.borrowed += 1;
    else if (statusKey === "returned") statusCounts.returned += 1;
    else if (statusKey === "pending") statusCounts.pending += 1;

    const raw = t.borrowedDate;
    if (raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        trendMap.set(key, (trendMap.get(key) || 0) + 1);
      }
    }

    const userInfo = usersMap.get(t.userId);
    const userKey = userInfo?.fullName || userInfo?.primaryEmail || t.userId || "N/D";
    userCounts[userKey] = (userCounts[userKey] || 0) + 1;

    if (statusKey === "borrowed") {
      const adminInfo = usersMap.get(t.adminId);
      const adminKey =
        adminInfo?.fullName || adminInfo?.primaryEmail || t.adminId || "Sistema";
      adminCounts[adminKey] = (adminCounts[adminKey] || 0) + 1;
    }

    const physical = physicalMap.get(t.physicalBookId);
    const book = physical ? bookMap.get(physical.bookId) : null;
    const genre = book?.genre || "Sem curso";
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  });

  const trend = Array.from(trendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([key, value]) => {
      const [y, m] = key.split("-");
      return { label: `${m}/${y}`, value };
    });

  const topGenres = Object.entries(genreCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const sortedUsers = Object.entries(userCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topUsers = sortedUsers.slice(0, 10);

  const topAdmins = Object.entries(adminCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total: filtered.length,
    statusCounts,
    trend,
    topGenres,
    topUsers,
    users: sortedUsers,
    topAdmins,
  });
}
