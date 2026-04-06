import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyUser } from "@/app/api/_utils/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      transactionId?: number;
      tid?: number;
    };
    const transactionId = Number(body.transactionId || body.tid);

    if (!transactionId) {
      return NextResponse.json({ error: "Transacao invalida" }, { status: 400 });
    }

    const db = getDb();
    const transaction = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.tid, transactionId))
      .limit(1);

    if (!transaction[0] || transaction[0].status !== "BORROWED") {
      return NextResponse.json({ error: "Transacao invalida" }, { status: 400 });
    }

    await db
      .update(schema.transactions)
      .set({
        status: "RETURNED",
        returnedDate: new Date(),
      })
      .where(eq(schema.transactions.tid, transactionId));

    const physical = await db
      .update(schema.physicalBooks)
      .set({
        borrowed: false,
        userId: null,
        currTransactionId: 0,
        returnDate: null,
      })
      .where(eq(schema.physicalBooks.pid, transaction[0].physicalBookId))
      .returning();

    if (physical[0]?.bookId) {
      const book = await db
        .select()
        .from(schema.books)
        .where(eq(schema.books.id, physical[0].bookId))
        .limit(1);

      if (book[0]) {
        await db
          .update(schema.books)
          .set({ availableCopies: (book[0].availableCopies ?? 0) + 1 })
          .where(eq(schema.books.id, physical[0].bookId));
      }
    }

    await notifyUser(
      db,
      transaction[0].userId,
      "Livro devolvido",
      "A devolucao foi registada com sucesso."
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
