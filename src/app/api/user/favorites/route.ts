import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { ensureUserFavoritesTable } from "@/app/api/_utils/userShelf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const db = getDb();
  await ensureUserFavoritesTable(db);
  const favorites = await db
    .select()
    .from(schema.userBookFavorites)
    .where(eq(schema.userBookFavorites.userId, userId));

  const items = await Promise.all(
    favorites.map(async (entry) => {
      const [book] = await db
        .select()
        .from(schema.books)
        .where(eq(schema.books.id, entry.bookId))
        .limit(1);

      return book
        ? {
            id: entry.id,
            createdAt: entry.createdAt,
            book,
          }
        : null;
    })
  );

  return NextResponse.json({
    bookIds: favorites.map((entry) => entry.bookId),
    items: items.filter(Boolean),
  });
}
