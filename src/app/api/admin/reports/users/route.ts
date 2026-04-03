import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const users = await db.select().from(schema.users);
  const activeTransactions = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.status, "BORROWED"));

  const enriched = await Promise.all(
    activeTransactions.map(async (t) => {
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
      return {
        tid: t.tid,
        userId: t.userId,
        borrowedDate: t.borrowedDate,
        physicalBookId: t.physicalBookId,
        bookTitle: book[0]?.title ?? "N/D",
      };
    })
  );

  const reports = users.map((u) => ({
    clerkId: u.clerkId,
    primaryEmail: u.primaryEmail,
    fullName: u.fullName ?? "",
    status: u.role ?? "member",
    createdAt: null,
    activeBorrows: enriched.filter((t) => t.userId === u.clerkId),
  }));

  return NextResponse.json(reports);
}
