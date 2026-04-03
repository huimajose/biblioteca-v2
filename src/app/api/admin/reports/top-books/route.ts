import { NextRequest, NextResponse } from "next/server";
import { gte, lte, sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Number(searchParams.get("limit") || 10));
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const db = getDb();
  const borrowedDateOnly = sql<string>`date(${schema.transactions.borrowedDate})`;
  let txQuery = db.select().from(schema.transactions);
  if (start) txQuery = txQuery.where(gte(borrowedDateOnly, start));
  if (end) txQuery = txQuery.where(lte(borrowedDateOnly, end));
  const transactions = await txQuery;
  const physicalBooks = await db.select().from(schema.physicalBooks);
  const books = await db.select().from(schema.books);

  const physicalToBookId = new Map<number, number>();
  physicalBooks.forEach((p) => physicalToBookId.set(p.pid, p.bookId));

  const bookById = new Map<number, typeof books[number]>();
  books.forEach((b) => bookById.set(b.id, b));

  const counts = new Map<number, { count: number; lastBorrowed?: Date | null }>();
  transactions.forEach((t: any) => {
    const bookId = physicalToBookId.get(t.physicalBookId);
    if (!bookId) return;
    const entry = counts.get(bookId) || { count: 0, lastBorrowed: null };
    entry.count += 1;
    const borrowedAt = t.borrowedDate ? new Date(t.borrowedDate) : null;
    if (borrowedAt && (!entry.lastBorrowed || borrowedAt > entry.lastBorrowed)) {
      entry.lastBorrowed = borrowedAt;
    }
    counts.set(bookId, entry);
  });

  const ranked = Array.from(counts.entries())
    .map(([bookId, info]) => {
      const book = bookById.get(bookId);
      return {
        bookId,
        title: book?.title ?? "N/D",
        author: book?.author ?? "N/D",
        isbn: book?.isbn ?? "N/D",
        totalBorrows: info.count,
        lastBorrowed: info.lastBorrowed ? info.lastBorrowed.toISOString() : null,
      };
    })
    .sort((a, b) => b.totalBorrows - a.totalBorrows)
    .slice(0, limit);

  return NextResponse.json(ranked);
}
