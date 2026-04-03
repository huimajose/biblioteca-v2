import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }

  const db = getDb();
  const settings = await db
    .select()
    .from(schema.notificationSettings)
    .where(eq(schema.notificationSettings.userId, userId))
    .limit(1);
  const lastSeen = settings[0]?.lastSeenAt ?? null;

  const query = lastSeen
    ? db
        .select({ count: sql<number>`count(*)` })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.read, false),
            gte(schema.notifications.createdAt, lastSeen)
          )
        )
    : db
        .select({ count: sql<number>`count(*)` })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.read, false)
          )
        );

  const result = await query;
  return NextResponse.json({ count: result[0]?.count ?? 0 });
}
