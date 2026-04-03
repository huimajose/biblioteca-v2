import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import * as schema from "@/db/pgSchema";
import { getDb } from "@/app/api/_utils/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ userId: string }>;

const resolveUserId = async (req: NextRequest, params?: Params) => {
  if (params) {
    const resolved = await params;
    if (resolved?.userId) return resolved.userId;
  }
  const pathname = new URL(req.url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || null;
};

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const userId = await resolveUserId(req, params);
  if (!userId) {
    return NextResponse.json({ error: "User ID missing" }, { status: 400 });
  }

  try {
    const db = getDb();
    const notifications = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt));

    return NextResponse.json(notifications);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error fetching notifications" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const userId = await resolveUserId(req, params);
  if (!userId) {
    return NextResponse.json({ error: "User ID missing" }, { status: 400 });
  }

  try {
    const db = getDb();
    await db
      .update(schema.notifications)
      .set({ read: true })
      .where(eq(schema.notifications.userId, userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Error marking notifications as read" },
      { status: 500 }
    );
  }
}
