import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyAdmins, notifyUser } from "@/app/api/_utils/notify";
import { applyLoanSanctions } from "@/app/api/_utils/loanSanctions";

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
    const sanctions = await applyLoanSanctions(db, userId);

    if (sanctions.blocked) {
      return NextResponse.json(
        {
          error: sanctions.reason || "Conta bloqueada por atraso prolongado.",
          blocked: true,
          sanctions,
        },
        { status: 403 }
      );
    }

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

    const activeTransactions = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.status, "PENDING")
        )
      );

    const activeBorrows = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.status, "BORROWED")
        )
      );

    const activeBookIds = new Set<number>();

    for (const tx of [...activeTransactions, ...activeBorrows]) {
      const physical = await db
        .select()
        .from(schema.physicalBooks)
        .where(eq(schema.physicalBooks.pid, tx.physicalBookId))
        .limit(1);
      const currentBookId = physical[0]?.bookId;
      if (currentBookId) activeBookIds.add(currentBookId);
    }

    if (activeBookIds.has(bookId)) {
      return NextResponse.json(
        { error: "Ja existe um pedido ou emprestimo ativo para este livro." },
        { status: 409 }
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
