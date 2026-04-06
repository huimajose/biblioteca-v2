import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalizeStatus = (status: string | null | undefined) => {
  if (!status) return "";
  return String(status).toLowerCase();
};

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const db = getDb();
  const transactions = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, userId));

  const activeRows = await Promise.all(
    transactions
      .filter((tx) => {
        const status = normalizeStatus(tx.status);
        return status === "pending" || status === "borrowed";
      })
      .map(async (tx) => {
        const physical = await db
          .select()
          .from(schema.physicalBooks)
          .where(eq(schema.physicalBooks.pid, tx.physicalBookId))
          .limit(1);
        return {
          tid: tx.tid,
          status: normalizeStatus(tx.status),
          bookId: physical[0]?.bookId ?? null,
        };
      })
  );

  const byBookId = activeRows.reduce<Record<number, { tid: number; status: string }>>((acc, row) => {
    if (!row.bookId) return acc;
    acc[row.bookId] = { tid: row.tid, status: row.status };
    return acc;
  }, {});

  return NextResponse.json({
    activeBookIds: Object.keys(byBookId).map(Number),
    byBookId,
  });
}
