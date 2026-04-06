import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { notifyUser } from "@/app/api/_utils/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const userId = req.headers.get("x-user-id") || "";
    const { id } = await params;
    const bookId = Number(id);

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Nao autorizado" },
        { status: 401 }
      );
    }

    if (!bookId) {
      return NextResponse.json(
        { success: false, message: "Livro invalido" },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = await db
      .select()
      .from(schema.userDigitalBooks)
      .where(
        and(
          eq(schema.userDigitalBooks.userId, userId),
          eq(schema.userDigitalBooks.bookId, bookId)
        )
      )
      .limit(1);

    if (existing[0]) {
      return NextResponse.json(
        { success: false, message: "Livro ja existe na sua estante." },
        { status: 400 }
      );
    }

    await db.insert(schema.userDigitalBooks).values({
      userId,
      bookId,
    });

    const book = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1);

    await notifyUser(
      db,
      userId,
      "Livro adicionado a estante",
      `O livro "${book[0]?.title || "selecionado"}" foi adicionado a sua estante digital.`
    );

    return NextResponse.json({
      success: true,
      message: "Livro adicionado a estante.",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Nao foi possivel adicionar." },
      { status: 500 }
    );
  }
}
