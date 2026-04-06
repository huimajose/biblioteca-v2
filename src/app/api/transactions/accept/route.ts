import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_DAYS = 15;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      tid?: number;
      userId?: string;
    };
    const tid = Number(body.tid);
    const userId = body.userId || "";

    if (!tid || !userId) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
    }

    const adminId = req.headers.get("x-admin-id") || req.headers.get("x-user-id") || "system";
    const db = getDb();

    const tx = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.tid, tid))
      .limit(1);

    if (!tx[0]) {
      return NextResponse.json({ error: "Transacao nao encontrada" }, { status: 404 });
    }

    if (tx[0].status !== "PENDING") {
      return NextResponse.json(
        { error: "Transacao nao esta pendente" },
        { status: 400 }
      );
    }

    const physicalRef = await db
      .select()
      .from(schema.physicalBooks)
      .where(eq(schema.physicalBooks.pid, tx[0].physicalBookId))
      .limit(1);

    if (!physicalRef[0]) {
      return NextResponse.json(
        { error: "Exemplar fisico nao encontrado" },
        { status: 400 }
      );
    }

    const bookId = physicalRef[0].bookId;
    const book = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1);

    if (!book[0]) {
      return NextResponse.json({ error: "Livro nao encontrado" }, { status: 404 });
    }

    if ((book[0].availableCopies ?? 0) <= 0) {
      return NextResponse.json(
        { error: "Sem exemplares disponiveis" },
        { status: 400 }
      );
    }

    const availablePhysical = await db
      .select()
      .from(schema.physicalBooks)
      .where(
        and(
          eq(schema.physicalBooks.bookId, bookId),
          eq(schema.physicalBooks.borrowed, false)
        )
      )
      .limit(1);

    if (!availablePhysical[0]) {
      return NextResponse.json(
        { error: "Sem exemplares disponiveis" },
        { status: 400 }
      );
    }

    const now = new Date();
    const expectedReturnDate = new Date(
      now.getTime() + DEFAULT_MAX_DAYS * 24 * 60 * 60 * 1000
    );

    await db
      .update(schema.transactions)
      .set({
        status: "BORROWED",
        adminId,
        borrowedDate: now,
        physicalBookId: availablePhysical[0].pid,
      })
      .where(eq(schema.transactions.tid, tid));

    await db
      .update(schema.physicalBooks)
      .set({
        borrowed: true,
        userId,
        currTransactionId: tid,
        returnDate: expectedReturnDate,
      })
      .where(eq(schema.physicalBooks.pid, availablePhysical[0].pid));

    await db
      .update(schema.books)
      .set({ availableCopies: Math.max((book[0].availableCopies ?? 0) - 1, 0) })
      .where(eq(schema.books.id, bookId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
