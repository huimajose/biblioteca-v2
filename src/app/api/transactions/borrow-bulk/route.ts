import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyUser } from "@/app/api/_utils/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_DAYS = 15;

const normalizeStatus = (status: string | null | undefined) => {
  if (!status) return status;
  return status.toLowerCase();
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    bookIds?: number[];
    userId?: string;
    userName?: string;
  };
  const bookIds = Array.isArray(body?.bookIds) ? body.bookIds : null;
  const userId = body?.userId;
  const fallbackUserName = String(body?.userName || "").trim();
  const adminId = "system";

  if (!bookIds || !userId) {
    return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
  }

  const db = getDb();

  const userRecord = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, userId))
    .limit(1);
  let userName = userRecord[0]?.fullName || null;
  const userEmail = userRecord[0]?.primaryEmail || null;
  if (!userName) {
    const verification = await db
      .select()
      .from(schema.studentVerifications)
      .where(eq(schema.studentVerifications.clerkId, userId))
      .limit(1);
    userName = verification[0]?.fullName || null;
  }
  if (!userName && fallbackUserName) {
    userName = fallbackUserName;
  }

  const results: any[] = [];
  const errors: any[] = [];
  const now = new Date();
  const expectedReturnDate = new Date(
    now.getTime() + DEFAULT_MAX_DAYS * 24 * 60 * 60 * 1000
  );

  for (const bookId of bookIds) {
    const physical = await db
      .select()
      .from(schema.physicalBooks)
      .where(
        and(
          eq(schema.physicalBooks.bookId, bookId),
          eq(schema.physicalBooks.borrowed, false)
        )
      )
      .limit(1);

    if (!physical[0]) {
      errors.push({ bookId, error: "Sem exemplares disponiveis" });
      continue;
    }

    const transaction = await db
      .insert(schema.transactions)
      .values({
        physicalBookId: physical[0].pid,
        userId,
        adminId,
        status: "BORROWED",
        borrowedDate: now,
        returnedDate: null,
        scoreApplied: false,
        user_name: userName || userId,
      })
      .returning();

    await db
      .update(schema.physicalBooks)
      .set({
        borrowed: true,
        userId,
        currTransactionId: transaction[0].tid,
        returnDate: expectedReturnDate,
      })
      .where(eq(schema.physicalBooks.pid, physical[0].pid));

    const book = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1);
    if (book[0]) {
      await db
        .update(schema.books)
        .set({
          availableCopies: Math.max((book[0].availableCopies ?? 0) - 1, 0),
        })
        .where(eq(schema.books.id, bookId));
    }

    results.push({
      tid: transaction[0].tid,
      userId: transaction[0].userId,
      userName,
      userEmail,
      borrowedDate: transaction[0].borrowedDate,
      status: normalizeStatus(transaction[0].status),
      bookTitle: book[0]?.title,
      bookAuthor: book[0]?.author,
      isbn: book[0]?.isbn,
    });
  }

  if (results.length > 0) {
    const summary =
      results.length === 1
        ? `O livro "${results[0]?.bookTitle || "selecionado"}" foi emprestado com sucesso.`
        : `${results.length} livros foram emprestados com sucesso.`;
    await notifyUser(db, userId, "Emprestimo concluido", summary);
  }

  return NextResponse.json({ success: results.length > 0, results, errors });
}
