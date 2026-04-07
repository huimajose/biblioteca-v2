import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { ensureUserReadingListsTables } from "@/app/api/_utils/userReadingLists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

async function findOwnedList(userId: string, listId: number) {
  const db = getDb();
  const [list] = await db
    .select()
    .from(schema.userReadingLists)
    .where(
      and(
        eq(schema.userReadingLists.id, listId),
        eq(schema.userReadingLists.userId, userId)
      )
    )
    .limit(1);
  return list;
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const listId = Number(id);
  const body = (await req.json().catch(() => ({}))) as { bookId?: number };
  const bookId = Number(body.bookId);
  if (!listId || !bookId) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const db = getDb();
  await ensureUserReadingListsTables(db);
  const list = await findOwnedList(userId, listId);
  if (!list) {
    return NextResponse.json({ error: "Lista nao encontrada" }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(schema.userReadingListItems)
    .where(
      and(
        eq(schema.userReadingListItems.listId, listId),
        eq(schema.userReadingListItems.bookId, bookId)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(schema.userReadingListItems).values({ listId, bookId });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const listId = Number(id);
  const { searchParams } = new URL(req.url);
  const bookId = Number(searchParams.get("bookId"));
  if (!listId || !bookId) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const db = getDb();
  await ensureUserReadingListsTables(db);
  const list = await findOwnedList(userId, listId);
  if (!list) {
    return NextResponse.json({ error: "Lista nao encontrada" }, { status: 404 });
  }

  await db
    .delete(schema.userReadingListItems)
    .where(
      and(
        eq(schema.userReadingListItems.listId, listId),
        eq(schema.userReadingListItems.bookId, bookId)
      )
    );

  return NextResponse.json({ success: true });
}
