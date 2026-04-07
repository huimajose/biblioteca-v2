import { NextResponse } from "next/server";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const [books, physicalBooks, transactions] = await Promise.all([
    db.select().from(schema.books),
    db.select().from(schema.physicalBooks),
    db.select().from(schema.transactions),
  ]);

  const physicalToBookId = new Map<number, number>();
  physicalBooks.forEach((copy) => {
    physicalToBookId.set(copy.pid, copy.bookId);
  });

  const borrowedBookIds = new Set<number>();
  transactions.forEach((transaction: any) => {
    const bookId = physicalToBookId.get(transaction.physicalBookId);
    if (bookId) borrowedBookIds.add(bookId);
  });

  const neverBorrowed = books
    .filter((book) => !borrowedBookIds.has(book.id))
    .map((book) => {
      const rawBook = book as any;
      return {
        id: book.id,
        title: book.title ?? "N/D",
        author: book.author ?? "N/D",
        genre: book.genre ?? "",
        isbn: book.isbn ?? "N/D",
        catalogCode: rawBook.catalogCode ?? rawBook.catalog_code ?? null,
        armario: book.armario ?? null,
        prateleira: book.prateleira ?? null,
        totalCopies: rawBook.totalCopies ?? rawBook.total_copies ?? 0,
        availableCopies: rawBook.availableCopies ?? rawBook.available_copies ?? 0,
        isDigital: rawBook.isDigital ?? rawBook.is_digital ?? false,
      };
    })
    .sort((a, b) => {
      const genreCompare = String(a.genre || "").localeCompare(String(b.genre || ""), undefined, { sensitivity: "base" });
      if (genreCompare !== 0) return genreCompare;

      const armarioCompare = String(a.armario || "").localeCompare(String(b.armario || ""), undefined, { numeric: true, sensitivity: "base" });
      if (armarioCompare !== 0) return armarioCompare;

      const shelfA = Number.isFinite(Number(a.prateleira)) ? Number(a.prateleira) : Number.MAX_SAFE_INTEGER;
      const shelfB = Number.isFinite(Number(b.prateleira)) ? Number(b.prateleira) : Number.MAX_SAFE_INTEGER;
      if (shelfA !== shelfB) return shelfA - shelfB;

      return String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" });
    });

  return NextResponse.json(neverBorrowed);
}
