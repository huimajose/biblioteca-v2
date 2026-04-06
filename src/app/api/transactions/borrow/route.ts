import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyAdmins, notifyUser } from "@/app/api/_utils/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalizeStatus = (status: string | null | undefined) => {
  if (!status) return status;
  return status.toLowerCase();
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      bookId?: number;
      userId?: string;
    };
    const headerUserId = req.headers.get("x-user-id");
    const userId = body.userId || headerUserId || "";
    const bookId = Number(body.bookId);

    if (!userId || !bookId) {
      return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
    }

    const db = getDb();
    const now = new Date();

    const book = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1);

    if (!book[0]) {
      return NextResponse.json({ error: "Livro nao encontrado" }, { status: 404 });
    }

    if (book[0].is_digital) {
      return NextResponse.json(
        { error: "Livro digital nao requer emprestimo" },
        { status: 400 }
      );
    }

    if ((book[0].availableCopies ?? 0) <= 0) {
      return NextResponse.json(
        { error: "Sem exemplares disponiveis" },
        { status: 400 }
      );
    }

    const anyPhysical = await db
      .select()
      .from(schema.physicalBooks)
      .where(eq(schema.physicalBooks.bookId, bookId))
      .limit(1);

    if (!anyPhysical[0] && (book[0].totalCopies ?? 0) > 0) {
      const copies = Array.from({ length: book[0].totalCopies ?? 0 }).map(() => ({
        bookId,
        borrowed: false,
        returnDate: null,
        userId: null,
        currTransactionId: 0,
      }));
      if (copies.length > 0) {
        await db.insert(schema.physicalBooks).values(copies);
      }
    }

    const physicalRef =
      anyPhysical[0] ||
      (
        await db
          .select()
          .from(schema.physicalBooks)
          .where(eq(schema.physicalBooks.bookId, bookId))
          .limit(1)
      )[0];

    if (!physicalRef) {
      return NextResponse.json(
        { error: "Sem exemplares disponiveis" },
        { status: 400 }
      );
    }

    const transaction = await db
      .insert(schema.transactions)
      .values({
        physicalBookId: physicalRef.pid,
        userId,
        adminId: "pending",
        status: "PENDING",
        borrowedDate: now,
        returnedDate: null,
        scoreApplied: false,
        user_name: userId,
      })
      .returning();

    await notifyUser(
      db,
      userId,
      "Pedido enviado",
      `O seu pedido do livro "${book[0].title}" foi enviado para aprovacao.`
    );
    await notifyAdmins(
      db,
      "Novo pedido de emprestimo",
      `Pedido de ${userId} para "${book[0].title}".`
    );

    return NextResponse.json({
      tid: transaction[0].tid,
      status: normalizeStatus(transaction[0].status),
      message: "Pedido enviado para aprovacao.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
