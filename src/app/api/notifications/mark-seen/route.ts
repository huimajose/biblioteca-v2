import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getHeaderUserId = (req: NextRequest) => req.headers.get("x-user-id");

export async function POST(req: NextRequest) {
  const userId = getHeaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  await db
    .update(schema.notifications)
    .set({ read: true })
    .where(eq(schema.notifications.userId, userId));

  await db
    .insert(schema.notificationSettings)
    .values({ userId, lastSeenAt: now, pushEnabled: true })
    .onConflictDoUpdate({
      target: schema.notificationSettings.userId,
      set: { lastSeenAt: now },
    });

  return NextResponse.json({ success: true });
}
