import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getHeaderUserId = (req: NextRequest) => req.headers.get("x-user-id");

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

  return NextResponse.json(
    settings[0] || { userId, pushEnabled: true, lastSeenAt: null }
  );
}

export async function POST(req: NextRequest) {
  const userId = getHeaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { pushEnabled?: boolean };
  const pushEnabled = !!body?.pushEnabled;

  const db = getDb();
  await db
    .insert(schema.notificationSettings)
    .values({ userId, pushEnabled })
    .onConflictDoUpdate({
      target: schema.notificationSettings.userId,
      set: { pushEnabled },
    });

  return NextResponse.json({ success: true });
}
