import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { ensureUserShelfFavoriteColumn } from "@/app/api/_utils/userShelf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const db = getDb();
  await ensureUserShelfFavoriteColumn(db);

  const shelfRows = await db
    .select()
    .from(schema.userDigitalBooks)
    .where(eq(schema.userDigitalBooks.userId, userId))
    .orderBy(desc(schema.userDigitalBooks.favorite), desc(schema.userDigitalBooks.addedAt));

  const entries = await Promise.all(
    shelfRows.map(async (entry) => {
      const [book] = await db
        .select()
        .from(schema.books)
        .where(eq(schema.books.id, entry.bookId))
        .limit(1);

      return book
        ? {
            id: entry.id,
            bookId: entry.bookId,
            userId: entry.userId,
            favorite: entry.favorite,
            addedAt: entry.addedAt,
            book,
          }
        : null;
    })
  );

  return NextResponse.json(entries.filter(Boolean));
}
