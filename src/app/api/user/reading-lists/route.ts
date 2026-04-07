import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { ensureUserReadingListsTables } from "@/app/api/_utils/userReadingLists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readLists(userId: string) {
  const db = getDb();
  await ensureUserReadingListsTables(db);

  const lists = await db
    .select()
    .from(schema.userReadingLists)
    .where(eq(schema.userReadingLists.userId, userId))
    .orderBy(desc(schema.userReadingLists.createdAt));

  const items = await db.select().from(schema.userReadingListItems);

  return Promise.all(
    lists.map(async (list) => {
      const listItems = items.filter((item) => item.listId === list.id);
      const books = await Promise.all(
        listItems.map(async (item) => {
          const [book] = await db
            .select()
            .from(schema.books)
            .where(eq(schema.books.id, item.bookId))
            .limit(1);
          return book
            ? {
                id: item.id,
                createdAt: item.createdAt,
                book,
              }
            : null;
        })
      );

      return {
        ...list,
        items: books.filter(Boolean),
      };
    })
  );
}

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const lists = await readLists(userId);
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
  };
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Nome da lista obrigatorio" }, { status: 400 });
  }

  const db = getDb();
  await ensureUserReadingListsTables(db);
  await db.insert(schema.userReadingLists).values({
    userId,
    name,
    description: description || null,
  });

  const lists = await readLists(userId);
  return NextResponse.json({ success: true, lists });
}
