import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
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
      tid: schema.transactions.tid,
      physicalBookId: schema.transactions.physicalBookId,
      userId: schema.transactions.userId,
      userNameRaw: schema.transactions.user_name,
      adminId: schema.transactions.adminId,
      status: schema.transactions.status,
      borrowedDate: schema.transactions.borrowedDate,
      returnedDate: schema.transactions.returnedDate,
      scoreApplied: schema.transactions.scoreApplied,
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
    return NextResponse.json([]);
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

  const usersMap = new Map<string, any>(
    (await db.select().from(schema.users)).map((u) => [u.clerkId, u])
  );

  const activities = await Promise.all(
    filtered.map(async (t) => {
      const pbook = await db
        .select()
        .from(schema.physicalBooks)
        .where(eq(schema.physicalBooks.pid, t.physicalBookId))
        .limit(1);
      const book = pbook[0]
        ? await db
            .select()
            .from(schema.books)
            .where(eq(schema.books.id, pbook[0].bookId))
            .limit(1)
        : [];
      const userInfo = usersMap.get(t.userId);
      const adminInfo = usersMap.get(t.adminId);
      const isTempUser = String(t.userId || "").startsWith("TEMP-");
      const resolvedUserName = userInfo?.fullName || t.userNameRaw || null;
      return {
        tid: t.tid,
        userId: t.userId,
        userName: resolvedUserName,
        userEmail: userInfo?.primaryEmail || null,
        isTempUser,
        adminId: t.adminId,
        adminName: adminInfo?.fullName || null,
        adminEmail: adminInfo?.primaryEmail || null,
        borrowedDate: t.borrowedDate,
        status: normalizeStatus(t.status),
        physicalBookId: t.physicalBookId,
        bookId: book[0]?.id ?? null,
        bookTitle: book[0]?.title ?? "N/D",
        bookAuthor: book[0]?.author ?? "N/D",
        isbn: book[0]?.isbn ?? "N/D",
        bookGenre: book[0]?.genre ?? null,
        bookCover: book[0]?.cover ?? null,
        bookAvailableCopies: book[0]?.availableCopies ?? 0,
        bookTotalCopies: book[0]?.totalCopies ?? 0,
        bookFileUrl: book[0]?.fileUrl ?? null,
        bookIsDigital: book[0]?.is_digital ?? false,
      };
    })
  );

  return NextResponse.json(activities);
}
