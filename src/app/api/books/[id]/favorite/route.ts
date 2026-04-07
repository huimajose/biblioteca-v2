import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { ensureUserShelfFavoriteColumn } from "@/app/api/_utils/userShelf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const userId = req.headers.get("x-user-id") || "";
    const { id } = await params;
    const bookId = Number(id);
    const body = (await req.json().catch(() => ({}))) as { favorite?: boolean };

    if (!userId) {
      return NextResponse.json({ success: false, message: "Nao autorizado" }, { status: 401 });
    }

    if (!bookId) {
      return NextResponse.json({ success: false, message: "Livro invalido" }, { status: 400 });
    }

    const db = getDb();
    await ensureUserShelfFavoriteColumn(db);

    const [existing] = await db
      .select()
      .from(schema.userDigitalBooks)
      .where(
        and(
          eq(schema.userDigitalBooks.userId, userId),
          eq(schema.userDigitalBooks.bookId, bookId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Adicione primeiro o livro a estante." },
        { status: 400 }
      );
    }

    const nextFavorite =
      typeof body.favorite === "boolean" ? body.favorite : !Boolean(existing.favorite);

    await db
      .update(schema.userDigitalBooks)
      .set({ favorite: nextFavorite })
      .where(eq(schema.userDigitalBooks.id, existing.id));

    return NextResponse.json({
      success: true,
      favorite: nextFavorite,
      message: nextFavorite ? "Livro marcado como favorito." : "Livro removido dos favoritos.",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Nao foi possivel atualizar favorito." },
      { status: 500 }
    );
  }
}
