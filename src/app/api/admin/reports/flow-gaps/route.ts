import { NextRequest, NextResponse } from "next/server";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawDays = searchParams.get("days") || "90";
  const days = rawDays === "all" ? null : Math.max(1, Number(rawDays || 90));
  const now = Date.now();
  const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : null;

  const db = getDb();
  const [books, physicalBooks, transactions, clicks] = await Promise.all([
    db.select().from(schema.books),
    db.select().from(schema.physicalBooks),
    db.select().from(schema.transactions),
    db.select().from(schema.bookClicks),
  ]);

  const physicalToBookId = new Map<number, number>();
  physicalBooks.forEach((copy) => {
    physicalToBookId.set(copy.pid, copy.bookId);
  });

  const lastBorrowByBook = new Map<number, number>();
  transactions.forEach((transaction: any) => {
    const bookId = physicalToBookId.get(transaction.physicalBookId);
    if (!bookId || !transaction.borrowedDate) return;
    const borrowedAt = new Date(transaction.borrowedDate).getTime();
    if (Number.isNaN(borrowedAt)) return;
    const current = lastBorrowByBook.get(bookId) || 0;
    if (borrowedAt > current) lastBorrowByBook.set(bookId, borrowedAt);
  });

  const lastClickByBook = new Map<number, number>();
  clicks.forEach((click: any) => {
    if (!click.bookId || !click.createdAt) return;
    const clickedAt = new Date(click.createdAt).getTime();
    if (Number.isNaN(clickedAt)) return;
    const current = lastClickByBook.get(click.bookId) || 0;
    if (clickedAt > current) lastClickByBook.set(click.bookId, clickedAt);
  });

  const allBorrowCounts = new Map<number, number>();
  transactions.forEach((transaction: any) => {
    const bookId = physicalToBookId.get(transaction.physicalBookId);
    if (!bookId) return;
    allBorrowCounts.set(bookId, (allBorrowCounts.get(bookId) || 0) + 1);
  });

  const allClickCounts = new Map<number, number>();
  clicks.forEach((click: any) => {
    allClickCounts.set(click.bookId, (allClickCounts.get(click.bookId) || 0) + 1);
  });

  const flowGaps = books
    .filter((book) => {
      const rawBook = book as any;
      const isDigital = rawBook.isDigital ?? rawBook.is_digital ?? false;
      const hasPresence = isDigital || Number(rawBook.totalCopies ?? rawBook.total_copies ?? 0) > 0;
      if (!hasPresence) return false;

      const lastBorrowedAt = lastBorrowByBook.get(book.id) || null;
      const lastClickedAt = lastClickByBook.get(book.id) || null;
      if (!cutoff) {
        return !lastBorrowedAt && !lastClickedAt;
      }
      return (!lastBorrowedAt || lastBorrowedAt < cutoff) && (!lastClickedAt || lastClickedAt < cutoff);
    })
    .map((book) => {
      const rawBook = book as any;
      const lastBorrowedAt = lastBorrowByBook.get(book.id) || null;
      const lastClickAt = lastClickByBook.get(book.id) || null;
      const lastMovementAt = Math.max(lastBorrowedAt || 0, lastClickAt || 0) || null;
      return {
        id: book.id,
        title: book.title ?? "N/D",
        author: book.author ?? "N/D",
        genre: book.genre ?? "",
        catalogCode: rawBook.catalogCode ?? rawBook.catalog_code ?? null,
        armario: book.armario ?? null,
        prateleira: book.prateleira ?? null,
        isDigital: rawBook.isDigital ?? rawBook.is_digital ?? false,
        totalBorrows: allBorrowCounts.get(book.id) || 0,
        totalClicks: allClickCounts.get(book.id) || 0,
        lastBorrowedAt: lastBorrowedAt ? new Date(lastBorrowedAt).toISOString() : null,
        lastClickAt: lastClickAt ? new Date(lastClickAt).toISOString() : null,
        lastMovementAt: lastMovementAt ? new Date(lastMovementAt).toISOString() : null,
      };
    })
    .sort((a, b) => {
      const aTime = a.lastMovementAt ? new Date(a.lastMovementAt).getTime() : 0;
      const bTime = b.lastMovementAt ? new Date(b.lastMovementAt).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" });
    })
    .slice(0, 50);

  return NextResponse.json(flowGaps);
}
