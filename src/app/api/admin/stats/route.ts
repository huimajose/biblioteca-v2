import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const booksCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.books);
  const usersCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.users);
  const borrowsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.transactions)
    .where(eq(schema.transactions.status, "BORROWED"));
  const pendingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.transactions)
    .where(eq(schema.transactions.status, "PENDING"));

  return NextResponse.json({
    books: booksCount[0]?.count ?? 0,
    users: usersCount[0]?.count ?? 0,
    borrows: borrowsCount[0]?.count ?? 0,
    pending: pendingCount[0]?.count ?? 0,
  });
}
