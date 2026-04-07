import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";
import { ensureUserReadingListsTables } from "@/app/api/_utils/userReadingLists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const listId = Number(id);
  if (!listId) {
    return NextResponse.json({ error: "Lista invalida" }, { status: 400 });
  }

  const db = getDb();
  await ensureUserReadingListsTables(db);

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

  if (!list) {
    return NextResponse.json({ error: "Lista nao encontrada" }, { status: 404 });
  }

  await db.delete(schema.userReadingListItems).where(eq(schema.userReadingListItems.listId, listId));
  await db.delete(schema.userReadingLists).where(eq(schema.userReadingLists.id, listId));

  return NextResponse.json({ success: true });
}
