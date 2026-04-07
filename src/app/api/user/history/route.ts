import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalizeStatus = (status: string | null | undefined) => {
  if (!status) return "";
  return String(status).toLowerCase();
};

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const db = getDb();
  const transactions = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, userId))
    .orderBy(desc(schema.transactions.borrowedDate));

  const filtered = transactions.filter((transaction) => {
    const status = normalizeStatus(transaction.status);
    return status === "borrowed" || status === "returned" || status === "rejected";
  });

  const history = await Promise.all(
    filtered.map(async (transaction) => {
      const physical = await db
        .select()
        .from(schema.physicalBooks)
        .where(eq(schema.physicalBooks.pid, transaction.physicalBookId))
        .limit(1);

      const bookId = physical[0]?.bookId ?? null;
      const book = bookId
        ? await db
            .select()
            .from(schema.books)
            .where(eq(schema.books.id, bookId))
            .limit(1)
        : [];

      return {
        tid: transaction.tid,
        status: normalizeStatus(transaction.status),
        borrowedDate: transaction.borrowedDate,
        returnedDate: transaction.returnedDate,
        expectedReturnDate: physical[0]?.returnDate ?? null,
        bookTitle: book[0]?.title ?? "N/D",
        bookAuthor: book[0]?.author ?? "N/D",
        book: book[0] ?? null,
      };
    })
  );

  return NextResponse.json(history);
}
